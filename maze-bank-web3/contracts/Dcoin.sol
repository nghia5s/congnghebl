// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Dcoin {
    string public constant name = "Maze Bank Dcoin";
    string public constant symbol = "DCN";
    uint8 public constant decimals = 18;

    enum TxType {
        REGISTER,
        TOP_UP,
        TRANSFER
    }

    address public owner;
    uint256 public totalSupply;
    uint256 private nextTransactionId;

    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed tokenOwner, address indexed spender, uint256 value);
    event DcoinTransaction(
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

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    function allowance(address tokenOwner, address spender) external view returns (uint256) {
        return allowances[tokenOwner][spender];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "Invalid spender");
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowances[from][msg.sender];
        require(currentAllowance >= amount, "Insufficient allowance");
        allowances[from][msg.sender] = currentAllowance - amount;
        emit Approval(from, msg.sender, allowances[from][msg.sender]);
        _transfer(from, to, amount);
        return true;
    }

    function issueAccount(
        address to,
        uint256 amount,
        string calldata accountId,
        string calldata memo
    ) external onlyOwner returns (uint256) {
        _mint(to, amount);
        return _recordTransaction(TxType.REGISTER, address(0), to, amount, accountId, "", memo);
    }

    function topUp(
        address to,
        uint256 amount,
        string calldata accountId,
        string calldata memo
    ) external onlyOwner returns (uint256) {
        _mint(to, amount);
        return _recordTransaction(TxType.TOP_UP, address(0), to, amount, accountId, "", memo);
    }

    function transferWithMemo(
        address to,
        uint256 amount,
        string calldata accountId,
        string calldata counterpartyAccountId,
        string calldata memo
    ) external returns (bool) {
        _transfer(msg.sender, to, amount);
        _recordTransaction(TxType.TRANSFER, msg.sender, to, amount, accountId, counterpartyAccountId, memo);
        return true;
    }

    function _mint(address to, uint256 amount) private {
        require(to != address(0), "Invalid recipient");
        totalSupply += amount;
        balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(from != address(0), "Invalid sender");
        require(to != address(0), "Invalid recipient");
        require(balances[from] >= amount, "Insufficient balance");

        balances[from] -= amount;
        balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _recordTransaction(
        TxType txType,
        address fromWallet,
        address toWallet,
        uint256 amount,
        string memory accountId,
        string memory counterpartyAccountId,
        string memory memo
    ) private returns (uint256) {
        uint256 id = nextTransactionId++;
        emit DcoinTransaction(
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
}
