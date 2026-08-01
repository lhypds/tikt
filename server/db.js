import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.resolve(__dirname, "..", "db.sqlite");

export const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    age INTEGER NOT NULL CHECK (age BETWEEN 1 AND 130),
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS knots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    time TEXT NOT NULL,
    intensity INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 10),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS knots_user_time_idx ON knots(user_id, time DESC);
  CREATE INDEX IF NOT EXISTS knots_user_name_idx ON knots(user_id, name);

  CREATE TABLE IF NOT EXISTS knot_names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(user_id, name)
  );

  INSERT OR IGNORE INTO knot_names (user_id, name)
  SELECT DISTINCT user_id, name FROM knots;
`);

function withTransaction(run) {
  db.exec("BEGIN");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

const selectUserByName = db.prepare(`
  SELECT id, username, age, email, created_at AS createdAt
  FROM users
  WHERE username = ?
`);

const insertUser = db.prepare(`
  INSERT INTO users (username, age, email)
  VALUES (?, ?, ?)
`);

const insertKnot = db.prepare(`
  INSERT INTO knots (user_id, time, intensity, name)
  VALUES (?, ?, ?, ?)
`);

const selectKnotById = db.prepare(`
  SELECT id, time, intensity, name
  FROM knots
  WHERE id = ? AND user_id = ?
`);

const selectKnots = db.prepare(`
  SELECT id, time, intensity, name
  FROM knots
  WHERE user_id = ?
  ORDER BY time DESC, id DESC
  LIMIT ?
`);

const selectNames = db.prepare(`
  SELECT kn.id, kn.name, COUNT(k.id) AS count, MAX(k.time) AS lastUsed
  FROM knot_names kn
  LEFT JOIN knots k ON k.user_id = kn.user_id AND k.name = kn.name
  WHERE kn.user_id = ?
  GROUP BY kn.id
  ORDER BY COALESCE(MAX(k.time), kn.created_at) DESC
  LIMIT ?
`);

const deleteKnotById = db.prepare(`
  DELETE FROM knots
  WHERE id = ? AND user_id = ?
`);

const insertKnotName = db.prepare(`
  INSERT OR IGNORE INTO knot_names (user_id, name)
  VALUES (?, ?)
`);

const selectKnotNameById = db.prepare(`
  SELECT kn.id, kn.name, COUNT(k.id) AS count, MAX(k.time) AS lastUsed
  FROM knot_names kn
  LEFT JOIN knots k ON k.user_id = kn.user_id AND k.name = kn.name
  WHERE kn.id = ? AND kn.user_id = ?
  GROUP BY kn.id
`);

const selectPlainKnotNameById = db.prepare(`
  SELECT id, name
  FROM knot_names
  WHERE id = ? AND user_id = ?
`);

const selectKnotNameByName = db.prepare(`
  SELECT id, name
  FROM knot_names
  WHERE user_id = ? AND name = ?
`);

const updateKnotNameById = db.prepare(`
  UPDATE knot_names
  SET name = ?
  WHERE id = ? AND user_id = ?
`);

const updateKnotsName = db.prepare(`
  UPDATE knots
  SET name = ?
  WHERE user_id = ? AND name = ?
`);

const deleteKnotNameById = db.prepare(`
  DELETE FROM knot_names
  WHERE id = ? AND user_id = ?
`);

const deleteKnotsByName = db.prepare(`
  DELETE FROM knots
  WHERE user_id = ? AND name = ?
`);

export function getUser(username) {
  return selectUserByName.get(username) ?? null;
}

export function createUser({ username, age, email }) {
  insertUser.run(username, age, email);
  return getUser(username);
}

export function createKnot(userId, { time, intensity, name }) {
  insertKnotName.run(userId, name);
  const result = insertKnot.run(userId, time, intensity, name);
  return selectKnotById.get(Number(result.lastInsertRowid), userId);
}

export function getKnots(userId, limit = 100) {
  return selectKnots.all(userId, limit);
}

export function getKnotNames(userId, limit = 8) {
  return selectNames.all(userId, limit);
}

export function deleteKnot(userId, knotId) {
  return deleteKnotById.run(knotId, userId).changes > 0;
}

export function createKnotName(userId, name) {
  const result = insertKnotName.run(userId, name);
  if (result.changes === 0) return null;
  return selectKnotNameById.get(Number(result.lastInsertRowid), userId);
}

export function renameKnotName(userId, nameId, newName) {
  const existing = selectPlainKnotNameById.get(nameId, userId);
  if (!existing) return { error: "NOT_FOUND" };
  if (existing.name !== newName) {
    if (selectKnotNameByName.get(userId, newName)) return { error: "CONFLICT" };
    withTransaction(() => {
      updateKnotNameById.run(newName, nameId, userId);
      updateKnotsName.run(newName, userId, existing.name);
    });
  }
  return { name: selectKnotNameById.get(nameId, userId) };
}

export function deleteKnotName(userId, nameId) {
  const existing = selectPlainKnotNameById.get(nameId, userId);
  if (!existing) return false;
  withTransaction(() => {
    deleteKnotsByName.run(userId, existing.name);
    deleteKnotNameById.run(nameId, userId);
  });
  return true;
}
