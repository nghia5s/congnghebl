const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const Dcoin = await hre.ethers.getContractFactory("Dcoin");
  const dcoin = await Dcoin.deploy();

  await dcoin.waitForDeployment();

  const address = await dcoin.getAddress();
  const payload = {
    name: "Dcoin",
    symbol: "DCN",
    decimals: 18,
    address,
    tokenAddress: address,
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    deployedAt: new Date().toISOString(),
  };

  const outputFile = path.resolve(
    process.env.CONTRACT_FILE || path.join(__dirname, "..", "backend", "hardhat-contract.json")
  );
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2), "utf8");

  console.log("Dcoin deployed to:", address);
  console.log("Wrote contract info to:", outputFile);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
