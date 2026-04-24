// Thin fetch wrapper that always includes credentials (session cookie).
// Throws an Error with { status, detail } on non-2xx.
async function request(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const err = new Error(
      (data && data.detail) || (typeof data === "string" ? data : `HTTP ${res.status}`)
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request("/api/auth/me"),
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),
  register: (username, email, password) =>
    request("/api/auth/register", {
      method: "POST",
      body: { username, email, password },
    }),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  listResults: () => request("/api/results"),
  deleteResult: (fileName) =>
    request(`/api/results/${encodeURIComponent(fileName)}`, { method: "DELETE" }),
  getSource: async (fileName) => {
    const res = await fetch(`/api/source/${encodeURIComponent(fileName)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Failed to load source (${res.status})`);
    return res.text();
  },

  clarify: (userQuery) =>
    request("/api/ai_clarify", {
      method: "POST",
      body: { user_query: userQuery },
    }),

  generate: (userQuery) =>
    request("/api/ai_assistant", {
      method: "POST",
      body: { user_query: userQuery },
    }),
};
