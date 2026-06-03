const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");

const PORT = Number(process.env.PORT || 4000);
const DATA_FILE = path.resolve(process.env.LEDGER_FILE || path.join(__dirname, "ledger.json"));
const CONTRACT_FILE = path.resolve(process.env.CONTRACT_FILE || path.join(__dirname, "hardhat-contract.json"));
const HARDHAT_RPC_URL = process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";
const NETWORK_NAME = "Maze Bank ERC-20 Dcoin";
const STARTER_BALANCE = 250;
const ZERO_ADDRESS = ethers.ZeroAddress;

const TX_TYPES = {
  REGISTER: 0,
  TOP_UP: 1,
  TRANSFER: 2,
};

const TX_TYPE_LABELS = ["REGISTER", "TOP_UP", "TRANSFER"];

const CONTRACT_ABI = [
  "event DcoinTransaction(uint256 indexed id, uint8 indexed txType, address indexed fromWallet, address toWallet, uint256 amount, uint256 timestamp, string accountId, string counterpartyAccountId, string memo)",
  "function issueAccount(address to, uint256 amount, string accountId, string memo) external returns (uint256)",
  "function topUp(address to, uint256 amount, string accountId, string memo) external returns (uint256)",
  "function transferWithMemo(address to, uint256 amount, string accountId, string counterpartyAccountId, string memo) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
];

const state = {
  accounts: {},
  blocks: [],
  nextSequence: 1,
};

function now() {
  return new Date().toISOString();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createGenesisBlock() {
  return {
    index: 0,
    timestamp: now(),
    previousHash: "0",
    transactions: [],
    hash: sha256("genesis"),
  };
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    salt,
    hash: sha256(`${salt}:${password}`),
  };
}

function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  return sha256(`${record.salt}:${password}`) === record.hash;
}

function createAccountId() {
  return `DCN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function createWalletAlias() {
  const adjectives = ["Prime", "Nova", "Atlas", "Orbit", "Vertex", "Lumen", "Pulse", "Apex"];
  const nouns = ["Vault", "Wallet", "Reserve", "Ledger", "Pocket", "Node", "Safe", "Stack"];
  const adjective = adjectives[crypto.randomInt(adjectives.length)];
  const noun = nouns[crypto.randomInt(nouns.length)];
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${adjective} ${noun} ${suffix}`;
}

function normalizeAddress(value) {
  try {
    return ethers.getAddress(value).toLowerCase();
  } catch {
    return String(value || "").toLowerCase();
  }
}

async function getTokenBalance(walletAddress) {
  if (!walletAddress) return null;
  const { contract, tokenDecimals } = await getBlockchainContext();
  const balance = await contract.balanceOf(walletAddress);
  return Number(ethers.formatUnits(balance, tokenDecimals));
}

async function publicAccount(account) {
  let balance = account.balance;
  try {
    const tokenBalance = await getTokenBalance(account.walletAddress);
    if (tokenBalance !== null) {
      balance = tokenBalance;
    }
  } catch {
    // Keep the local value as a fallback when the local chain is unavailable.
  }

  return {
    accountId: account.accountId,
    name: account.name,
    alias: account.alias,
    walletAddress: account.walletAddress || null,
    balance,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function txTypeLabel(txType) {
  return TX_TYPE_LABELS[Number(txType)] || `TYPE_${txType}`;
}

function accountIdFromWallet(walletAddress) {
  const normalized = normalizeAddress(walletAddress);
  for (const account of Object.values(state.accounts)) {
    if (normalizeAddress(account.walletAddress) === normalized) {
      return account.accountId;
    }
  }
  return null;
}

function findAccountByWallet(walletAddress) {
  const normalized = normalizeAddress(walletAddress);
  return (
    Object.values(state.accounts).find((account) => normalizeAddress(account.walletAddress) === normalized) ||
    null
  );
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Dữ liệu gửi lên quá lớn"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("JSON không hợp lệ"));
      }
    });
    req.on("error", reject);
  });
}

function assertAccountExists(accountId) {
  const account = state.accounts[accountId];
  if (!account) {
    const error = new Error("Không tìm thấy tài khoản");
    error.statusCode = 404;
    throw error;
  }
  return account;
}

function assertPositiveInteger(amount, fieldName = "Số lượng") {
  const parsed = Number(amount);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} phải là số nguyên dương`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function requireAuth(accountId, password) {
  const account = assertAccountExists(accountId);
  if (!verifyPassword(password, account.password)) {
    const error = new Error("Sai Account ID hoặc mật khẩu");
    error.statusCode = 401;
    throw error;
  }
  return account;
}

function queryPassword(url) {
  return url.searchParams.get("password") || "";
}

async function saveState() {
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function loadState() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    state.accounts = parsed.accounts || {};
    state.blocks =
      Array.isArray(parsed.blocks) && parsed.blocks.length > 0 ? parsed.blocks : [createGenesisBlock()];
    state.nextSequence = parsed.nextSequence || 1;
  } catch {
    state.accounts = {};
    state.blocks = [createGenesisBlock()];
    state.nextSequence = 1;
    await saveState();
    return;
  }

  if (state.blocks.length === 0) {
    state.blocks = [createGenesisBlock()];
    await saveState();
  }
}

let blockchainContext = null;
let walletPool = null;

async function getBlockchainContext() {
  if (blockchainContext) return blockchainContext;

  const raw = await fs.readFile(CONTRACT_FILE, "utf8");
  const contractInfo = JSON.parse(raw);
  const contractAddress = contractInfo.tokenAddress || contractInfo.address || process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error("Chưa có địa chỉ token contract. Hãy chạy `npm run demo` hoặc deploy contract trước.");
  }

  const provider = new ethers.JsonRpcProvider(HARDHAT_RPC_URL);
  const signer = await provider.getSigner(0);
  const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
  const tokenDecimals = Number(await contract.decimals());
  const tokenSymbol = await contract.symbol();

  blockchainContext = {
    provider,
    contract,
    contractAddress,
    tokenDecimals,
    tokenSymbol,
  };

  return blockchainContext;
}

async function getWalletPool() {
  if (walletPool) return walletPool;
  const { provider } = await getBlockchainContext();
  const accounts = await provider.send("eth_accounts", []);
  walletPool = accounts.map((address) => ethers.getAddress(address));
  return walletPool;
}

async function allocateWalletAddress() {
  const pool = await getWalletPool();
  const used = new Set(
    Object.values(state.accounts)
      .map((account) => account.walletAddress)
      .filter(Boolean)
      .map((address) => normalizeAddress(address))
  );

  const available = pool.find((address) => !used.has(normalizeAddress(address)));
  if (!available) {
    const error = new Error("Không còn walletAddress trống trên Hardhat node");
    error.statusCode = 500;
    throw error;
  }

  return available;
}

async function recordBlockchainTransaction({
  txType,
  fromWallet,
  toWallet,
  amount,
  accountId,
  counterpartyAccountId,
  memo,
}) {
  const { contract, provider, tokenDecimals } = await getBlockchainContext();
  const tokenAmount = ethers.parseUnits(String(amount), tokenDecimals);
  let tx;

  if (txType === TX_TYPES.REGISTER) {
    tx = await contract.issueAccount(toWallet, tokenAmount, accountId, memo);
  } else if (txType === TX_TYPES.TOP_UP) {
    tx = await contract.topUp(toWallet, tokenAmount, accountId, memo);
  } else if (txType === TX_TYPES.TRANSFER) {
    const sender = await provider.getSigner(fromWallet);
    tx = await contract
      .connect(sender)
      .transferWithMemo(toWallet, tokenAmount, accountId, counterpartyAccountId, memo);
  } else {
    throw Object.assign(new Error("Loại giao dịch không hợp lệ"), { statusCode: 400 });
  }

  await tx.wait();
}

function toIsoFromUnixSeconds(value) {
  return new Date(Number(value) * 1000).toISOString();
}

async function fetchBlockchainEvents() {
  const { contract, provider } = await getBlockchainContext();
  const latestBlockNumber = await provider.getBlockNumber();

  if (latestBlockNumber < 0) {
    return [];
  }

  const events = await contract.queryFilter(contract.filters.DcoinTransaction(), 0, latestBlockNumber);
  return events.sort((left, right) => left.blockNumber - right.blockNumber || left.logIndex - right.logIndex);
}

function formatTokenAmount(value) {
  const decimals = blockchainContext?.tokenDecimals ?? 18;
  return Number(ethers.formatUnits(value || 0, decimals));
}

function mapEventToChainTransaction(event, currentWalletAddress = null) {
  const args = event.args || {};
  const fromWallet = normalizeAddress(args.fromWallet);
  const toWallet = normalizeAddress(args.toWallet);
  const txType = Number(args.txType);
  const accountId = String(args.accountId || "");
  const counterpartyAccountId = String(args.counterpartyAccountId || "");
  const currentWallet = currentWalletAddress ? normalizeAddress(currentWalletAddress) : null;
  const isTransfer = txType === TX_TYPES.TRANSFER;
  const direction = !isTransfer ? "in" : fromWallet === currentWallet ? "out" : "in";
  const counterparty = !isTransfer
    ? "Hệ thống"
    : fromWallet === currentWallet
      ? counterpartyAccountId || accountIdFromWallet(toWallet) || toWallet
      : accountIdFromWallet(fromWallet) || fromWallet;

  return {
    id: `chain-${event.transactionHash}-${event.logIndex}`,
    type: txTypeLabel(txType),
    amount: formatTokenAmount(args.amount),
    timestamp: toIsoFromUnixSeconds(args.timestamp || 0),
    blockIndex: event.blockNumber,
    blockHash: event.blockHash,
    memo: String(args.memo || ""),
    accountId: accountId || null,
    fromAccountId: accountIdFromWallet(fromWallet),
    toAccountId: accountIdFromWallet(toWallet),
    counterparty,
    direction,
  };
}

function mapEventToBlockTransaction(event) {
  const args = event.args || {};
  return {
    id: `chain-${event.transactionHash}-${event.logIndex}`,
    type: txTypeLabel(Number(args.txType)),
    amount: formatTokenAmount(args.amount),
    timestamp: toIsoFromUnixSeconds(args.timestamp || 0),
    memo: String(args.memo || ""),
    accountId: String(args.accountId || "") || null,
    fromAccountId: accountIdFromWallet(args.fromWallet),
    toAccountId: accountIdFromWallet(args.toWallet),
  };
}

async function buildChainSnapshot() {
  const { provider } = await getBlockchainContext();
  const events = await fetchBlockchainEvents();
  const eventsByBlock = new Map();

  for (const event of events) {
    const blockEvents = eventsByBlock.get(event.blockNumber) || [];
    blockEvents.push(event);
    eventsByBlock.set(event.blockNumber, blockEvents);
  }

  const latestBlockNumber = await provider.getBlockNumber();
  const blocks = [];

  for (let index = 0; index <= latestBlockNumber; index += 1) {
    const block = await provider.getBlock(index);
    if (!block) continue;

    const blockEvents = eventsByBlock.get(index) || [];
    blocks.push({
      index: block.number,
      timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
      previousHash: block.parentHash || "0",
      hash: block.hash,
      transactionCount: blockEvents.length,
      transactions: blockEvents.map(mapEventToBlockTransaction),
    });
  }

  return {
    chainHeight: blocks.length,
    blocks,
  };
}

function isChainValid(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return false;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (index === 0) continue;

    const previousBlock = blocks[index - 1];
    if (block.previousHash !== previousBlock.hash) {
      return false;
    }
  }

  return true;
}

async function handleRegister(req, res) {
  const body = await readBody(req);
  const name = String(body.name || "").trim();
  const password = String(body.password || "").trim();
  const alias = String(body.alias || "").trim() || createWalletAlias();

  if (!name || !password) {
    return sendJson(res, 400, { error: "Tên hiển thị và mật khẩu là bắt buộc" });
  }

  let accountId = createAccountId();
  while (state.accounts[accountId]) {
    accountId = createAccountId();
  }

  const walletAddress = await allocateWalletAddress();
  const account = {
    accountId,
    name,
    alias,
    walletAddress,
    password: createPasswordRecord(password),
    balance: STARTER_BALANCE,
    createdAt: now(),
    updatedAt: now(),
  };

  state.accounts[accountId] = account;

  try {
    await saveState();
    await recordBlockchainTransaction({
      txType: TX_TYPES.REGISTER,
      fromWallet: ZERO_ADDRESS,
      toWallet: walletAddress,
      amount: STARTER_BALANCE,
      accountId,
      counterpartyAccountId: "",
      memo: "Tạo tài khoản",
    });
  } catch (error) {
    delete state.accounts[accountId];
    try {
      await saveState();
    } catch {
      // Best-effort rollback only.
    }
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }

  return sendJson(res, 201, {
    account: await publicAccount(account),
    message: "Đã tạo tài khoản",
  });
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const accountId = String(body.accountId || "").trim();
  const password = String(body.password || "").trim();

  try {
    const account = requireAuth(accountId, password);
    return sendJson(res, 200, { account: await publicAccount(account) });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
}

async function handleTopUp(req, res) {
  const body = await readBody(req);
  const accountId = String(body.accountId || "").trim();
  const password = String(body.password || "").trim();

  try {
    const amount = assertPositiveInteger(body.amount);
    const account = requireAuth(accountId, password);
    const snapshot = {
      balance: account.balance,
      updatedAt: account.updatedAt,
    };

    account.balance += amount;
    account.updatedAt = now();

    try {
      await saveState();
      await recordBlockchainTransaction({
        txType: TX_TYPES.TOP_UP,
        fromWallet: ZERO_ADDRESS,
        toWallet: account.walletAddress,
        amount,
        accountId,
        counterpartyAccountId: "",
        memo: "Nạp Dcoin",
      });
    } catch (error) {
      account.balance = snapshot.balance;
      account.updatedAt = snapshot.updatedAt;
      try {
        await saveState();
      } catch {
        // Best-effort rollback only.
      }
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }

    return sendJson(res, 200, {
      account: await publicAccount(account),
      message: "Đã nạp Dcoin",
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
}

async function handleTransfer(req, res) {
  const body = await readBody(req);
  const fromAccountId = String(body.fromAccountId || "").trim();
  const password = String(body.password || "").trim();
  const toAccountId = String(body.toAccountId || "").trim();

  try {
    const amount = assertPositiveInteger(body.amount);
    const memo = String(body.memo || "").trim();

    if (!toAccountId) {
      throw Object.assign(new Error("Cần nhập Account ID người nhận"), { statusCode: 400 });
    }
    if (fromAccountId === toAccountId) {
      throw Object.assign(new Error("Không thể chuyển cho chính tài khoản của mình"), { statusCode: 400 });
    }

    const fromAccount = requireAuth(fromAccountId, password);
    const toAccount = assertAccountExists(toAccountId);

    if (!fromAccount.walletAddress || !toAccount.walletAddress) {
      throw Object.assign(new Error("Tài khoản chưa được gắn walletAddress"), { statusCode: 500 });
    }
    const fromTokenBalance = await getTokenBalance(fromAccount.walletAddress);
    if ((fromTokenBalance ?? fromAccount.balance) < amount) {
      throw Object.assign(new Error("Số dư Dcoin không đủ"), { statusCode: 400 });
    }

    const snapshot = {
      fromBalance: fromAccount.balance,
      fromUpdatedAt: fromAccount.updatedAt,
      toBalance: toAccount.balance,
      toUpdatedAt: toAccount.updatedAt,
    };

    fromAccount.balance -= amount;
    toAccount.balance += amount;
    fromAccount.updatedAt = now();
    toAccount.updatedAt = now();

    try {
      await saveState();
      await recordBlockchainTransaction({
        txType: TX_TYPES.TRANSFER,
        fromWallet: fromAccount.walletAddress,
        toWallet: toAccount.walletAddress,
        amount,
        accountId: fromAccountId,
        counterpartyAccountId: toAccountId,
        memo,
      });
    } catch (error) {
      fromAccount.balance = snapshot.fromBalance;
      fromAccount.updatedAt = snapshot.fromUpdatedAt;
      toAccount.balance = snapshot.toBalance;
      toAccount.updatedAt = snapshot.toUpdatedAt;
      try {
        await saveState();
      } catch {
        // Best-effort rollback only.
      }
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }

    return sendJson(res, 200, {
      fromAccount: await publicAccount(fromAccount),
      toAccount: await publicAccount(toAccount),
      message: "Đã chuyển Dcoin",
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
}

async function handleAccount(req, res, url, accountId) {
  try {
    const password = queryPassword(url);
    const account = requireAuth(accountId, password);
    return sendJson(res, 200, { account: await publicAccount(account) });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
}

async function handleTransactions(req, res, url, accountId) {
  try {
    const password = queryPassword(url);
    const account = requireAuth(accountId, password);
    const events = await fetchBlockchainEvents();
    const walletAddress = normalizeAddress(account.walletAddress);
    const transactions = events
      .filter((event) => {
        const fromWallet = normalizeAddress(event.args?.fromWallet);
        const toWallet = normalizeAddress(event.args?.toWallet);
        return fromWallet === walletAddress || toWallet === walletAddress;
      })
      .map((event) => mapEventToChainTransaction(event, account.walletAddress))
      .reverse();

    return sendJson(res, 200, { transactions });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
}

async function handleHealth(req, res) {
  const snapshot = await buildChainSnapshot();
  const lastBlock = snapshot.blocks[snapshot.blocks.length - 1];
  return sendJson(res, 200, {
    ok: true,
    networkName: NETWORK_NAME,
    contractMode: "erc20-hardhat",
    tokenAddress: blockchainContext?.contractAddress || null,
    tokenSymbol: blockchainContext?.tokenSymbol || "DCN",
    chainHeight: snapshot.chainHeight,
    totalAccounts: Object.keys(state.accounts).length,
    latestBlockHash: lastBlock?.hash || null,
    latestBlockTime: lastBlock?.timestamp || null,
    isChainValid: isChainValid(snapshot.blocks),
  });
}

async function handleChain(req, res) {
  const snapshot = await buildChainSnapshot();
  return sendJson(res, 200, {
    networkName: NETWORK_NAME,
    contractMode: "erc20-hardhat",
    tokenAddress: blockchainContext?.contractAddress || null,
    chainHeight: snapshot.chainHeight,
    isChainValid: isChainValid(snapshot.blocks),
    blocks: snapshot.blocks,
  });
}

async function handleBlockByIndex(req, res, index) {
  const snapshot = await buildChainSnapshot();
  const block = snapshot.blocks.find((item) => item.index === index);
  if (!block) {
    return sendJson(res, 404, { error: "Không tìm thấy khối" });
  }
  return sendJson(res, 200, { block });
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return await handleHealth(req, res);
    }

    if (req.method === "GET" && url.pathname === "/api/chain") {
      return await handleChain(req, res);
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/blocks/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const index = Number(parts[2]);
      if (Number.isInteger(index)) {
        return await handleBlockByIndex(req, res, index);
      }
    }

    if (req.method === "POST" && url.pathname === "/api/register") {
      return await handleRegister(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      return await handleLogin(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/topup") {
      return await handleTopUp(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/transfer") {
      return await handleTransfer(req, res);
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/accounts/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const accountId = decodeURIComponent(parts[2] || "");
      if (parts.length === 3) {
        return await handleAccount(req, res, url, accountId);
      }
      if (parts.length === 4 && parts[3] === "transactions") {
        return await handleTransactions(req, res, url, accountId);
      }
    }

    return sendJson(res, 404, { error: "Không tìm thấy route" });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
}

async function main() {
  await loadState();
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    console.log(`Maze Bank Hybrid Dcoin đang chạy tại http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
