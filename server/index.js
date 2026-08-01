import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  createKnot,
  createKnotName,
  createUser,
  deleteKnot,
  deleteKnotName,
  getKnotNames,
  getKnots,
  getUser,
  renameKnotName,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

try {
  // real environment variables take precedence over .env entries
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  // no .env file — use the ambient environment as-is
}

const port = Number(process.env.PORT) || 3001;
const isProduction = process.env.NODE_ENV === "production";

const USERNAME_RE =
  /^[a-z0-9_\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Hangul}-]{1,32}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sessions = new Map();
const sessionAgeMs = 30 * 24 * 60 * 60 * 1000;
const sessionCookie = "tikt_session";

function normalizeUsername(value) {
  return String(value ?? "").trim().normalize("NFKC").toLowerCase();
}

function cookieValue(req, name) {
  const prefix = `${name}=`;
  const part = String(req.headers.cookie ?? "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!part) return null;
  try {
    return decodeURIComponent(part.slice(prefix.length));
  } catch {
    return null;
  }
}

function currentSession(req) {
  const token = cookieValue(req, sessionCookie);
  const session = token ? sessions.get(token) : null;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function startSession(user, req, res) {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { userId: user.id, username: user.username, expiresAt: Date.now() + sessionAgeMs });
  res.cookie(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    maxAge: sessionAgeMs,
    path: "/",
  });
}

function clearSession(req, res) {
  const session = currentSession(req);
  if (session) sessions.delete(session.token);
  res.clearCookie(sessionCookie, { httpOnly: true, sameSite: "lax", secure: req.secure, path: "/" });
}

function requireSession(req, res, next) {
  const session = currentSession(req);
  if (!session) return res.status(401).json({ error: "请先登录", code: "LOGIN_REQUIRED" });
  const user = getUser(session.username);
  if (!user) {
    clearSession(req, res);
    return res.status(401).json({ error: "请重新登录", code: "LOGIN_REQUIRED" });
  }
  req.user = user;
  next();
}

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "32kb" }));

app.get("/api/session", (req, res) => {
  const session = currentSession(req);
  const user = session ? getUser(session.username) : null;
  if (!user) return res.status(401).json({ error: "未登录", code: "LOGIN_REQUIRED" });
  res.json({ user });
});

app.post("/api/login", (req, res) => {
  const username = normalizeUsername(req.body?.username);
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: "用户名为 1–32 个字符，可使用中日韩文字、字母、数字、- 和 _" });
  }
  const user = getUser(username);
  if (!user) return res.status(404).json({ error: "用户不存在", code: "USER_NOT_FOUND" });
  startSession(user, req, res);
  res.json({ user });
});

app.post("/api/logout", (req, res) => {
  clearSession(req, res);
  res.status(204).end();
});

app.post("/api/users", (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const age = Number(req.body?.age);
  const email = String(req.body?.email ?? "").trim().toLowerCase();

  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: "用户名为 1–32 个字符，可使用中日韩文字、字母、数字、- 和 _" });
  }
  if (!Number.isInteger(age) || age < 1 || age > 130) {
    return res.status(400).json({ error: "请输入 1–130 之间的年龄" });
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "请输入有效的邮箱地址" });
  }
  if (getUser(username)) return res.status(409).json({ error: "用户名已存在", code: "USER_EXISTS" });

  try {
    const user = createUser({ username, age, email });
    startSession(user, req, res);
    res.status(201).json({ user });
  } catch (error) {
    console.error("create user failed", error);
    res.status(500).json({ error: "创建用户失败" });
  }
});

app.get("/api/me", requireSession, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/knots", requireSession, (req, res) => {
  const parsedLimit = Number(req.query.limit);
  const limit = Number.isInteger(parsedLimit) ? Math.min(500, Math.max(1, parsedLimit)) : 100;
  res.json({ knots: getKnots(req.user.id, limit) });
});

app.get("/api/knot-names", requireSession, (req, res) => {
  const parsedLimit = Number(req.query.limit);
  const limit = Number.isInteger(parsedLimit) ? Math.min(200, Math.max(1, parsedLimit)) : 8;
  res.json({ names: getKnotNames(req.user.id, limit) });
});

app.post("/api/knot-names", requireSession, (req, res) => {
  const name = String(req.body?.name ?? "").trim().normalize("NFKC");
  if (!name || name.length > 48) return res.status(400).json({ error: "记录名称需要 1–48 个字符" });
  const created = createKnotName(req.user.id, name);
  if (!created) return res.status(409).json({ error: "同名的结已存在", code: "NAME_EXISTS" });
  res.status(201).json({ name: created });
});

app.patch("/api/knot-names/:nameId", requireSession, (req, res) => {
  const nameId = Number(req.params.nameId);
  if (!Number.isInteger(nameId) || nameId < 1) return res.status(400).json({ error: "结 ID 无效" });
  const name = String(req.body?.name ?? "").trim().normalize("NFKC");
  if (!name || name.length > 48) return res.status(400).json({ error: "记录名称需要 1–48 个字符" });
  const result = renameKnotName(req.user.id, nameId, name);
  if (result.error === "NOT_FOUND") return res.status(404).json({ error: "结不存在", code: "NAME_NOT_FOUND" });
  if (result.error === "CONFLICT") return res.status(409).json({ error: "同名的结已存在", code: "NAME_EXISTS" });
  res.json({ name: result.name });
});

app.delete("/api/knot-names/:nameId", requireSession, (req, res) => {
  const nameId = Number(req.params.nameId);
  if (!Number.isInteger(nameId) || nameId < 1) return res.status(400).json({ error: "结 ID 无效" });
  if (!deleteKnotName(req.user.id, nameId)) {
    return res.status(404).json({ error: "结不存在", code: "NAME_NOT_FOUND" });
  }
  res.status(204).end();
});

app.post("/api/knots", requireSession, (req, res) => {
  const name = String(req.body?.name ?? "").trim().normalize("NFKC");
  const intensity = Number(req.body?.intensity);
  const suppliedTime = req.body?.time ? new Date(req.body.time) : new Date();

  if (!name || name.length > 48) return res.status(400).json({ error: "记录名称需要 1–48 个字符" });
  if (!Number.isInteger(intensity) || intensity < 1 || intensity > 10) {
    return res.status(400).json({ error: "强度需要在 1–10 之间" });
  }
  if (Number.isNaN(suppliedTime.getTime())) return res.status(400).json({ error: "记录时间无效" });

  const knot = createKnot(req.user.id, {
    name,
    intensity,
    time: suppliedTime.toISOString(),
  });
  res.status(201).json({ knot });
});

app.delete("/api/knots/:knotId", requireSession, (req, res) => {
  const knotId = Number(req.params.knotId);
  if (!Number.isInteger(knotId) || knotId < 1) {
    return res.status(400).json({ error: "记录 ID 无效" });
  }
  if (!deleteKnot(req.user.id, knotId)) {
    return res.status(404).json({ error: "记录不存在", code: "KNOT_NOT_FOUND" });
  }
  res.status(204).end();
});

if (isProduction) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.use((error, req, res, _next) => {
  console.error(error);
  if (res.headersSent) return;
  res.status(500).json({ error: "服务器错误" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`tikt listening on:`);
  console.log(`  Local:   http://localhost:${port}`);
  for (const iface of Object.values(os.networkInterfaces()).flat()) {
    if (iface?.family === "IPv4" && !iface.internal) {
      console.log(`  Network: http://${iface.address}:${port}`);
    }
  }
});
