# Maze Bank Web3

## Chay nhanh mot lenh

Tren Windows PowerShell, chay lan dau:

```bash
npm.cmd install
```

Sau do bat ca he thong bang mot lenh:

```bash
npm.cmd run demo
```

Lenh nay se tu dong:

1. Mo Hardhat local node o `http://127.0.0.1:8545`
2. Deploy contract `Dcoin`
3. Mo backend o `http://localhost:4000`
4. Mo frontend o `http://localhost:3000`

Khi muon dung, bam `Ctrl + C` trong terminal dang chay `npm.cmd run demo`.

Demo Dcoin ERC-20:

- backend quản lý tài khoản và mật khẩu
- `contracts/Dcoin.sol` là token ERC-20 thật với symbol `DCN`
- số dư được đọc từ smart contract bằng `balanceOf`
- đăng ký/nạp sẽ mint DCN, chuyển tiền sẽ gọi `transferWithMemo`
- Hardhat local chain lưu token balance và lịch sử giao dịch
- mỗi tài khoản được gắn một `walletAddress`
- người dùng vẫn đăng nhập bằng `Account ID + mật khẩu`
- tích hợp ví ngoài như MetaMask có thể làm sau; hiện backend ký giao dịch bằng các account local của Hardhat

## Chạy từng bước

Trên Windows PowerShell, nên dùng `npm.cmd` để tránh lỗi policy của `npm.ps1`.

### 1. Cài dependency

```bash
npm.cmd install
```

### 2. Mở Hardhat local node

Mở terminal thứ nhất và chạy:

```bash
npm.cmd run chain:node
```

Giữ terminal này đang mở.

### 3. Deploy contract

Mở terminal thứ hai và chạy:

```bash
npm.cmd run chain:deploy
```

Lệnh này sẽ deploy token contract `Dcoin` lên Hardhat local node và ghi địa chỉ contract vào `backend/hardhat-contract.json`.

### 4. Chạy backend

Mở terminal thứ ba và chạy:

```bash
npm.cmd run backend
```

Backend chạy ở:

```bash
http://localhost:4000
```

### 5. Chạy frontend

Mở terminal thứ tư và chạy:

```bash
npm.cmd start
```

Frontend mở ở:

```bash
http://localhost:3000
```

## Chạy một lệnh cho cả hệ thống

Nếu muốn bật tất cả cùng lúc:

```bash
npm.cmd run demo
```

## File local runtime

Các file dưới đây được tạo trong lúc chạy local và đã được bỏ qua khỏi git:

- `backend/ledger.json`
- `backend/hardhat-contract.json`

Khi cần chạy test/demo riêng, có thể đổi vị trí hai file này bằng `LEDGER_FILE` và `CONTRACT_FILE`.

## Reset dữ liệu

- Backend lưu tài khoản trong `backend/ledger.json`
- Hardhat deploy lưu metadata contract trong `backend/hardhat-contract.json`

Nếu muốn làm sạch demo:

1. Dừng tất cả terminal đang chạy
2. Xóa `backend/ledger.json`
3. Xóa `backend/hardhat-contract.json`
4. Chạy lại theo thứ tự từ bước 2

## API chính

- `GET /api/health`
- `GET /api/chain`
- `GET /api/blocks/:index`
- `POST /api/register`
- `POST /api/login`
- `POST /api/topup`
- `POST /api/transfer`

## Ghi chú

- UI vẫn dùng backend để đăng nhập và gọi API
- số dư DCN được lấy từ contract ERC-20, không còn chỉ là số trong file JSON
- lịch sử giao dịch được lấy từ event `DcoinTransaction` trên Hardhat local chain
- `contracts/DBank.sol` là contract cũ, hiện backend/deploy dùng `contracts/Dcoin.sol`
