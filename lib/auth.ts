import db from "./db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export function verifyUser(email: string, password: string) {
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as { id: number; email: string; password: string } | undefined;
  if (!user) return false;
  const valid = bcrypt.compareSync(password, user.password);
  return valid ? user : false;
}

export function hasUsers(): boolean {
  const result = db
    .prepare("SELECT COUNT(*) as count FROM users")
    .get() as { count: number };
  return result.count > 0;
}

export function createUser(email: string, password: string): number {
  const hash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare("INSERT INTO users (email, password) VALUES (?, ?)")
    .run(email, hash);
  return result.lastInsertRowid as number;
}

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)"
  ).run(userId, token, expiresAt);
  return token;
}

export function validateSession(
  token: string
): { id: number; email: string } | null {
  const session = db
    .prepare(
      `SELECT u.id, u.email FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as { id: number; email: string } | undefined;
  return session ?? null;
}

export function deleteSession(token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}
