// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DBank {
    enum TxType {
        REGISTER,
        TOP_UP,
        TRANSFER
    }

    struct TransactionRecord {
        uint256 id;
        TxType txType;
        address fromWallet;
        address toWallet;
        uint256 amount;
        uint256 timestamp;
        string accountId;
        string counterpartyAccountId;
        string memo;
    }

    uint256 private nextId;
    TransactionRecord[] private records;

    event TransactionRecorded(
        uint256 indexed id,
        TxType indexed txType,
        address indexed fromWallet,
        address toWallet,
        uint256 amount,
        uint256 timestamp,
        string accountId,
        string counterpartyAccountId,
        string memo
    );

    function recordTransaction(
        TxType txType,
        address fromWallet,
        address toWallet,
        uint256 amount,
        string calldata accountId,
        string calldata counterpartyAccountId,
        string calldata memo
    ) external returns (uint256) {
        uint256 id = nextId++;

        records.push(
            TransactionRecord({
                id: id,
                txType: txType,
                fromWallet: fromWallet,
                toWallet: toWallet,
                amount: amount,
                timestamp: block.timestamp,
                accountId: accountId,
                counterpartyAccountId: counterpartyAccountId,
                memo: memo
            })
        );

        emit TransactionRecorded(
            id,
            txType,
            fromWallet,
            toWallet,
            amount,
            block.timestamp,
            accountId,
            counterpartyAccountId,
            memo
        );

        return id;
    }

    function getTransactionCount() external view returns (uint256) {
        return records.length;
    }

    function getTransaction(uint256 index) external view returns (TransactionRecord memory) {
        require(index < records.length, "Transaction out of bounds");
        return records[index];
    }
}
