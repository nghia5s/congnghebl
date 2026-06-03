import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { api } from "./api";
import "./App.css";

const formatAmount = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

const formatDate = (value) => new Date(value).toLocaleString("vi-VN");

const shortHash = (value) => (value ? `${value.slice(0, 10)}...${value.slice(-8)}` : "-");
const translateTxType = (type) => {
  if (type === "REGISTER") return "Đăng ký";
  if (type === "TOP_UP") return "Nạp";
  if (type === "TRANSFER") return "Chuyển";
  return type;
};

export default function Dashboard({ session, onLogout }) {
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [health, setHealth] = useState(null);
  const [chain, setChain] = useState(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [sendTo, setSendTo] = useState("");
  const [amount, setAmount] = useState("");
  const [topUp, setTopUp] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [accountData, txData, healthData, chainData] = await Promise.all([
        api.getAccount(session.accountId, session.password),
        api.getTransactions(session.accountId, session.password),
        api.getHealth(),
        api.getChain(),
      ]);

      setAccount(accountData.account);
      setTransactions(txData.transactions);
      setHealth(healthData);
      setChain(chainData);

      const latestIndex = chainData.blocks?.[chainData.blocks.length - 1]?.index ?? null;
      setSelectedBlockIndex(latestIndex);
    } catch (error) {
      toast.error(error.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.accountId]);

  useEffect(() => {
    let isMounted = true;

    const loadBlock = async () => {
      if (selectedBlockIndex === null) {
        setSelectedBlock(null);
        return;
      }

      try {
        const result = await api.getBlock(selectedBlockIndex);
        if (isMounted) {
          setSelectedBlock(result.block);
        }
      } catch (error) {
        if (isMounted) {
          setSelectedBlock(null);
        }
        toast.error(error.message || "Không tải được block");
      }
    };

    loadBlock();

    return () => {
      isMounted = false;
    };
  }, [selectedBlockIndex]);

  const recentBlocks = useMemo(() => chain?.blocks?.slice().reverse() || [], [chain]);

  const handleTransfer = async () => {
    try {
      await api.transfer({
        fromAccountId: session.accountId,
        password: session.password,
        toAccountId: sendTo.trim(),
        amount: Number(amount),
        memo: memo.trim(),
      });
      toast.success("Đã chuyển Dcoin");
      setSendTo("");
      setAmount("");
      setMemo("");
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Chuyển Dcoin thất bại");
    }
  };

  const handleTopUp = async () => {
    try {
      await api.topUp({
        accountId: session.accountId,
        password: session.password,
        amount: Number(topUp),
      });
      toast.success("Đã nạp Dcoin");
      setTopUp("");
      await loadAll();
    } catch (error) {
      toast.error(error.message || "Nạp Dcoin thất bại");
    }
  };

  const copyToClipboard = async (value, label = "giá trị") => {
    await navigator.clipboard.writeText(value);
    toast.info(`Đã sao chép ${label}`);
  };

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <div className="eyebrow">Sổ cái Dcoin nội bộ</div>
          <h1>{session.name}</h1>
          <p>{account?.alias || "Tài khoản demo local"}</p>
        </div>
        <div className="header-actions">
          <button className="secondary" type="button" onClick={loadAll}>
            Làm mới
          </button>
          <button className="secondary" type="button" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      <section className="status-strip">
        <div>
          <span>Mạng</span>
          <strong>{health?.networkName || "Maze Bank Dcoin nội bộ"}</strong>
        </div>
        <div>
          <span>Chiều cao chuỗi</span>
          <strong>{health?.chainHeight ?? "-"}</strong>
        </div>
        <div>
          <span>Chuỗi hợp lệ</span>
          <strong>{health?.isChainValid ? "Có" : "Không"}</strong>
        </div>
        <div>
          <span>Hash mới nhất</span>
          <strong>{shortHash(health?.latestBlockHash)}</strong>
        </div>
      </section>

      <main className="dashboard-grid">
        <article className="card balance-card">
          <h3>Tài khoản</h3>
          <div className="balance-display">
            {loading ? "Đang tải..." : `${formatAmount(account?.balance || 0)} DCN`}
          </div>
          <div className="info-row">
            <span>Account ID</span>
            <div className="address-display">
              <span>{session.accountId}</span>
              <button
                className="link-button"
                type="button"
                onClick={() => copyToClipboard(session.accountId, "Account ID")}
              >
                Sao chép
              </button>
            </div>
          </div>
          <div className="info-row">
            <span>Wallet</span>
            <div className="address-display">
              <span>{account?.walletAddress || session.walletAddress || "-"}</span>
              <button
                className="link-button"
                type="button"
                onClick={() => copyToClipboard(account?.walletAddress || session.walletAddress, "wallet address")}
                disabled={!account?.walletAddress && !session.walletAddress}
              >
                Sao chép
              </button>
            </div>
          </div>
          <div className="info-row">
            <span>Ngày tạo</span>
            <strong>{account?.createdAt ? formatDate(account.createdAt) : "-"}</strong>
          </div>
          <div className="info-row">
            <span>Cập nhật</span>
            <strong>{account?.updatedAt ? formatDate(account.updatedAt) : "-"}</strong>
          </div>
        </article>

        <article className="card">
          <h3>Chuyển Dcoin</h3>
          <p className="card-note">Nhập Account ID người nhận để tạo một block giao dịch mới.</p>
          <input
            placeholder="Account ID người nhận"
            value={sendTo}
            onChange={(event) => setSendTo(event.target.value)}
          />
          <input
            placeholder="Số lượng DCN"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <input placeholder="Ghi chú" value={memo} onChange={(event) => setMemo(event.target.value)} />
          <button type="button" onClick={handleTransfer}>
            Chuyển
          </button>
        </article>

        <article className="card">
          <h3>Nạp Dcoin</h3>
          <p className="card-note">Nạp vẫn đi qua backend, nhưng lịch sử nạp sẽ được ghi lên Hardhat.</p>
          <input
            placeholder="Số lượng DCN"
            type="number"
            min="1"
            step="1"
            value={topUp}
            onChange={(event) => setTopUp(event.target.value)}
          />
          <button type="button" onClick={handleTopUp}>
            Nạp
          </button>
        </article>
      </main>

      <section className="content-grid">
        <article className="card chain-card">
          <div className="section-title">
            <div>
              <h3>Khối gần đây</h3>
              <span>{recentBlocks.length} khối</span>
            </div>
            <span>{health?.isChainValid ? "Đã xác minh" : "Có lỗi chuỗi"}</span>
          </div>

          <div className="block-list">
            {recentBlocks.map((block) => (
              <button
                key={block.index}
                type="button"
                className={`block-item ${selectedBlockIndex === block.index ? "active" : ""}`}
                onClick={() => setSelectedBlockIndex(block.index)}
              >
                <div className="block-item-top">
                  <strong>Khối #{block.index}</strong>
                  <span>{block.transactionCount} giao dịch</span>
                </div>
                <div className="transaction-time">{formatDate(block.timestamp)}</div>
                <div className="block-hash">
                  <span>Hash</span>
                  <strong>{shortHash(block.hash)}</strong>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="card block-detail-card">
          <h3>Chi tiết khối</h3>
          {selectedBlock ? (
            <div className="block-detail">
              <div className="info-row">
                <span>Index</span>
                <strong>{selectedBlock.index}</strong>
              </div>
              <div className="info-row">
                <span>Thời gian</span>
                <strong>{formatDate(selectedBlock.timestamp)}</strong>
              </div>
              <div className="info-row">
                <span>Previous hash</span>
                <strong className="hash-line">{shortHash(selectedBlock.previousHash)}</strong>
              </div>
              <div className="info-row">
                <span>Current hash</span>
                <strong className="hash-line">{shortHash(selectedBlock.hash)}</strong>
              </div>
              <div className="info-row">
                <span>Số giao dịch</span>
                <strong>{selectedBlock.transactionCount}</strong>
              </div>
              <div className="block-tx-list">
                {(selectedBlock.transactions || []).length === 0 ? (
                  <p className="card-note">Khối gốc không có giao dịch.</p>
                ) : (
                  selectedBlock.transactions.map((tx) => (
                    <div key={tx.id} className="transaction-item compact">
                      <div>
                        <div className="transaction-address">{translateTxType(tx.type)}</div>
                        <div className="transaction-time">{tx.memo || "Không có ghi chú"}</div>
                      </div>
                      <div className="transaction-amount in">{formatAmount(tx.amount)} DCN</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <p className="empty-state">Chọn một khối để xem hash và giao dịch bên trong.</p>
          )}
        </article>
      </section>

      <section className="transactions-section">
        <div className="section-title">
          <h3>Lịch sử giao dịch</h3>
          <span>{transactions.length} dòng</span>
        </div>
        <div className="transaction-list">
          {transactions.length === 0 ? (
            <div className="empty-state">
              <p>Chưa có giao dịch nào</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="transaction-item">
                <div>
                  <div className="transaction-address">
                    {translateTxType(tx.type)} {tx.counterparty ? `- ${tx.counterparty}` : ""}
                  </div>
                  <div className="transaction-time">{formatDate(tx.timestamp)}</div>
                  <div className="transaction-time">Khối #{tx.blockIndex}</div>
                  {tx.memo ? <div className="transaction-time">Ghi chú: {tx.memo}</div> : null}
                </div>
                <div className={`transaction-amount ${tx.direction}`}>
                  {tx.direction === "out" ? "-" : "+"}
                  {formatAmount(tx.amount)} DCN
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
