import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Dashboard from "./Dashboard";
import { api } from "./api";
import "./App.css";

const SESSION_KEY = "maze-bank-session";

function AuthShell({
  mode,
  setMode,
  onRegister,
  onLogin,
  registerForm,
  setRegisterForm,
  loginForm,
  setLoginForm,
}) {
  return (
    <div className="auth-shell">
      <section className="hero-panel">
        <div className="eyebrow">Maze Bank Web3</div>
        <h1>Dcoin nội bộ, backend + blockchain</h1>
        <p>
          Đây là bản hybrid: tài khoản và số dư vẫn do backend quản lý, còn lịch sử giao dịch được
          ghi lên Hardhat local chain. Mỗi tài khoản được gắn một walletAddress để dễ theo dõi.
        </p>
        <div className="hero-stats">
          <div>
            <strong>Account backend</strong>
            <span>Đăng nhập bằng Account ID + mật khẩu như trước</span>
          </div>
          <div>
            <strong>Wallet linked</strong>
            <span>Mỗi tài khoản có một walletAddress riêng</span>
          </div>
          <div>
            <strong>History on-chain</strong>
            <span>Lịch sử giao dịch lấy từ Hardhat</span>
          </div>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Đăng ký
          </button>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Đăng nhập
          </button>
        </div>

        {mode === "register" ? (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              onRegister();
            }}
          >
            <label>
              Tên hiển thị
              <input
                value={registerForm.name}
                onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
                placeholder="Nguyễn An"
              />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm({ ...registerForm, password: event.target.value })
                }
                placeholder="Tạo mật khẩu"
              />
            </label>
            <label>
              Nhãn ví
              <input
                value={registerForm.alias}
                onChange={(event) => setRegisterForm({ ...registerForm, alias: event.target.value })}
                placeholder="Bo trong de tu sinh"
              />
            </label>
            <button type="submit">Tạo tài khoản</button>
          </form>
        ) : (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              onLogin();
            }}
          >
            <label>
              Account ID
              <input
                value={loginForm.accountId}
                onChange={(event) => setLoginForm({ ...loginForm, accountId: event.target.value })}
                placeholder="DCN-..."
              />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                placeholder="Nhập mật khẩu"
              />
            </label>
            <button type="submit">Đăng nhập</button>
          </form>
        )}
      </section>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("register");
  const [session, setSession] = useState(null);
  const [registerForm, setRegisterForm] = useState({ name: "", password: "", alias: "" });
  const [loginForm, setLoginForm] = useState({ accountId: "", password: "" });

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;

    try {
      setSession(JSON.parse(raw));
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const persistSession = (nextSession) => {
    setSession(nextSession);
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  };

  const handleRegister = async () => {
    if (!registerForm.name.trim() || !registerForm.password.trim()) {
      toast.error("Vui lòng nhập tên hiển thị và mật khẩu");
      return;
    }

    try {
      const result = await api.register({
        name: registerForm.name.trim(),
        password: registerForm.password,
        alias: registerForm.alias.trim(),
      });

      persistSession({
        accountId: result.account.accountId,
        name: result.account.name,
        password: registerForm.password,
        alias: result.account.alias,
        walletAddress: result.account.walletAddress,
      });
      setLoginForm({ accountId: result.account.accountId, password: registerForm.password });
      toast.success("Đã tạo tài khoản");
    } catch (error) {
      toast.error(error.message || "Đăng ký thất bại");
    }
  };

  const handleLogin = async () => {
    if (!loginForm.accountId.trim() || !loginForm.password.trim()) {
      toast.error("Vui lòng nhập Account ID và mật khẩu");
      return;
    }

    try {
      const result = await api.login({
        accountId: loginForm.accountId.trim(),
        password: loginForm.password,
      });

      persistSession({
        accountId: result.account.accountId,
        name: result.account.name,
        password: loginForm.password,
        alias: result.account.alias,
        walletAddress: result.account.walletAddress,
      });
      toast.success("Đăng nhập thành công");
    } catch (error) {
      toast.error(error.message || "Đăng nhập thất bại");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    toast.info("Đã đăng xuất");
  };

  return (
    <>
      {session ? (
        <Dashboard session={session} onLogout={handleLogout} />
      ) : (
        <AuthShell
          mode={mode}
          setMode={setMode}
          onRegister={handleRegister}
          onLogin={handleLogin}
          registerForm={registerForm}
          setRegisterForm={setRegisterForm}
          loginForm={loginForm}
          setLoginForm={setLoginForm}
        />
      )}
      <ToastContainer position="top-right" autoClose={2200} />
    </>
  );
}
