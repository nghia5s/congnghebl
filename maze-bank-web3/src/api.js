const API_BASE = process.env.REACT_APP_API_BASE || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Request failed");
  }

  return payload;
}

export const api = {
  register: (body) =>
    request("/api/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body) =>
    request("/api/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getAccount: (accountId, password) =>
    request(`/api/accounts/${encodeURIComponent(accountId)}?password=${encodeURIComponent(password)}`),
  getTransactions: (accountId, password) =>
    request(
      `/api/accounts/${encodeURIComponent(accountId)}/transactions?password=${encodeURIComponent(password)}`
    ),
  getHealth: () => request("/api/health"),
  getChain: () => request("/api/chain"),
  getBlock: (index) => request(`/api/blocks/${index}`),
  transfer: (body) =>
    request("/api/transfer", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  topUp: (body) =>
    request("/api/topup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
