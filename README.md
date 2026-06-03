<h2 align="center">
    <a href="https://dainam.edu.vn/vi/khoa-cong-nghe-thong-tin">
    🎓 Faculty of Information Technology (DaiNam University)
    </a>
</h2>
<h2 align="center">
   ỨNG DỤNG GIAO DỊCH NỘI BỘ
</h2>
<div align="center">
    <p align="center">
        <img src="docs/aiotlab_logo.png" alt="AIoTLab Logo" width="170"/>
        <img src="docs/fitdnu_logo.png" alt="AIoTLab Logo" width="180"/>
        <img src="docs/dnu_logo.png" alt="DaiNam University Logo" width="200"/>
    </p>

[![AIoTLab](https://img.shields.io/badge/AIoTLab-green?style=for-the-badge)](https://www.facebook.com/DNUAIoTLab)
[![Faculty of Information Technology](https://img.shields.io/badge/Faculty%20of%20Information%20Technology-blue?style=for-the-badge)](https://dainam.edu.vn/vi/khoa-cong-nghe-thong-tin)
[![DaiNam University](https://img.shields.io/badge/DaiNam%20University-orange?style=for-the-badge)](https://dainam.edu.vn)

</div>

## 1. Giới thiệu

Maze Bank Web3 là ứng dụng ngân hàng demo kết hợp backend truyền thống với blockchain local. Người dùng đăng ký và đăng nhập bằng `Account ID` + mật khẩu, sau đó có thể xem số dư, nạp Dcoin, chuyển Dcoin và theo dõi lịch sử giao dịch trên giao diện web.

Dự án sử dụng Hardhat để chạy blockchain cục bộ, smart contract `Dcoin` để quản lý token ERC-20 nội bộ có symbol `DCN`, backend Node.js để quản lý tài khoản và React để hiển thị dashboard. Mỗi tài khoản được gắn một `walletAddress` riêng, còn số dư và lịch sử giao dịch được đồng bộ với smart contract trên Hardhat local chain.

## 2. Công nghệ sử dụng

- Frontend: React, React Toastify, CSS.
- Backend: Node.js HTTP server, file JSON local để lưu thông tin tài khoản.
- Blockchain: Hardhat local node, Solidity.
- Smart contract: `Dcoin.sol` theo mô hình ERC-20 có thêm event `DcoinTransaction`.
- Thư viện Web3: `ethers`.

## 3. Chức năng chính

- Đăng ký tài khoản Maze Bank và tự động cấp `Account ID`.
- Mỗi tài khoản được gắn một địa chỉ ví trên Hardhat local node.
- Đăng nhập bằng `Account ID` và mật khẩu.
- Nạp Dcoin vào tài khoản.
- Chuyển Dcoin giữa các tài khoản bằng `Account ID`.
- Xem số dư DCN từ smart contract.
- Xem lịch sử giao dịch theo từng tài khoản.
- Xem thông tin blockchain local: chiều cao chuỗi, hash mới nhất, danh sách block và giao dịch trong block.

## 4. Cấu trúc thư mục

```text
maze-bank-web3/
├── backend/
│   ├── server.js              # API server và logic tài khoản
│   └── ledger.json            # Dữ liệu runtime được tạo khi chạy local
├── contracts/
│   ├── Dcoin.sol              # Token DCN đang được backend/deploy sử dụng
│   └── DBank.sol              # Contract ghi giao dịch cũ
├── scripts/
│   ├── deploy.js              # Deploy smart contract lên Hardhat local
│   └── dev.js                 # Chạy Hardhat, deploy, backend và frontend cùng lúc
├── src/
│   ├── App.jsx                # Màn hình đăng ký/đăng nhập
│   ├── Dashboard.jsx          # Dashboard tài khoản, giao dịch và block
│   └── api.js                 # Client gọi API backend
├── hardhat.config.js
└── package.json
```

## 5. Cài đặt và chạy nhanh

Di chuyển vào thư mục dự án:

```bash
cd maze-bank-web3
```

Cài dependencies:

```bash
npm.cmd install
```

Chạy toàn bộ hệ thống bằng một lệnh:

```bash
npm.cmd run demo
```

Lệnh này sẽ tự động:

1. Mở Hardhat local node tại `http://127.0.0.1:8545`.
2. Deploy contract `Dcoin`.
3. Mở backend tại `http://localhost:4000`.
4. Mở frontend tại `http://localhost:3000`.

Khi muốn dừng demo, nhấn `Ctrl + C` trong terminal đang chạy.

## 6. Chạy từng bước

Nếu muốn chạy từng thành phần riêng, mở nhiều terminal trong thư mục `maze-bank-web3`.

Terminal 1: chạy Hardhat local node.

```bash
npm.cmd run chain:node
```

Terminal 2: deploy smart contract.

```bash
npm.cmd run chain:deploy
```

Terminal 3: chạy backend.

```bash
npm.cmd run backend
```

Terminal 4: chạy frontend.

```bash
npm.cmd start
```

## 7. API chính

- `GET /api/health`: kiểm tra trạng thái hệ thống và blockchain.
- `GET /api/chain`: lấy snapshot các block trên chain.
- `GET /api/blocks/:index`: lấy chi tiết một block.
- `POST /api/register`: tạo tài khoản mới.
- `POST /api/login`: đăng nhập tài khoản.
- `GET /api/accounts/:accountId?password=...`: lấy thông tin tài khoản.
- `GET /api/accounts/:accountId/transactions?password=...`: lấy lịch sử giao dịch của tài khoản.
- `POST /api/topup`: nạp Dcoin.
- `POST /api/transfer`: chuyển Dcoin sang tài khoản khác.

## 8. File runtime local

Trong quá trình chạy local, dự án có thể tạo các file sau:

- `maze-bank-web3/backend/ledger.json`: lưu tài khoản, hash mật khẩu và dữ liệu backend.
- `maze-bank-web3/backend/hardhat-contract.json`: lưu địa chỉ contract đã deploy.

Hai file này phụ thuộc vào môi trường demo local. Nếu muốn reset dữ liệu, dừng các terminal đang chạy, xóa hai file trên, sau đó chạy lại Hardhat node, deploy contract và backend/frontend.

## 9. Ghi chú

- Đây là dự án demo cho môi trường local, chưa tích hợp MetaMask hay mạng blockchain thật.
- Backend hiện ký giao dịch bằng các account local của Hardhat.
- Số dư DCN được đọc từ smart contract bằng `balanceOf`.
- Lịch sử giao dịch được lấy từ event `DcoinTransaction` trên contract `Dcoin`.
- `DBank.sol` là contract cũ, còn luồng chạy hiện tại dùng `Dcoin.sol`.

## 10. License

Dự án được phát triển phục vụ mục đích học tập và demo Web3.
