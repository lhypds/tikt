async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: options.body ? { "Content-Type": "application/json", ...options.headers } : options.headers,
    ...options,
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "请求失败");
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

export const getSession = () => request("/api/session");
export const login = (username) =>
  request("/api/login", { method: "POST", body: JSON.stringify({ username }) });
export const logout = () => request("/api/logout", { method: "POST" });
export const createUser = (user) =>
  request("/api/users", { method: "POST", body: JSON.stringify(user) });
export const getKnots = (limit = 100) => request(`/api/knots?limit=${limit}`);
export const getKnotNames = (limit) =>
  request(limit ? `/api/knot-names?limit=${limit}` : "/api/knot-names");
export const createKnotName = (name) =>
  request("/api/knot-names", { method: "POST", body: JSON.stringify({ name }) });
export const renameKnotName = (nameId, name) =>
  request(`/api/knot-names/${nameId}`, { method: "PATCH", body: JSON.stringify({ name }) });
export const deleteKnotName = (nameId) => request(`/api/knot-names/${nameId}`, { method: "DELETE" });
export const getKnotNameStats = (nameId) => request(`/api/knot-names/${nameId}/stats`);
export const createKnot = (knot) =>
  request("/api/knots", { method: "POST", body: JSON.stringify(knot) });
export const deleteKnot = (knotId) => request(`/api/knots/${knotId}`, { method: "DELETE" });
