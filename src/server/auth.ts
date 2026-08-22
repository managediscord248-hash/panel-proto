import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb, getUserByUsername, getUserByEmail, getUserById, updateUserLastLogin, isServerAssignedToUser, type UserRow } from "./store.js";
import { config } from "./config.js";
import { audit } from "./db.js";
import type { Request, Response } from "express";

export interface AuthUser {
  id: number;
  username: string;
  role: "owner" | "admin" | "user";
  email: string | null;
  isSuspended: boolean;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    email: row.email,
    isSuspended: row.is_suspended === 1,
  };
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: "12h" }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      id: number; username: string; role: "owner" | "admin" | "user";
    };
    return { id: payload.id, username: payload.username, role: payload.role, email: null, isSuspended: false };
  } catch {
    return null;
  }
}

export async function authenticateUser(usernameOrEmail: string, password: string): Promise<AuthUser | null> {
  let row = getUserByUsername(usernameOrEmail);
  if (!row && usernameOrEmail.includes("@")) {
    row = getUserByEmail(usernameOrEmail);
  }
  if (!row) return null;
  if (row.is_suspended === 1) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  updateUserLastLogin(row.id);
  return toAuthUser(row);
}

export async function createUser(username: string, password: string, role: "owner" | "admin" | "user" = "user", email?: string): Promise<AuthUser> {
  const hash = await bcrypt.hash(password, 12);
  const db = getDb();
  const info = db.prepare("INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)").run(username, hash, email ?? null, role);
  const row = getUserById(Number(info.lastInsertRowid))!;
  return toAuthUser(row);
}

export function requireAuth(req: AuthedRequest, res: Response, next: () => void): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const row = getUserById(payload.id);
  if (!row || row.is_suspended === 1) {
    res.status(401).json({ error: "Account unavailable" });
    return;
  }
  req.user = toAuthUser(row);
  next();
}

export function requireRole(...roles: ("owner" | "admin" | "user")[]) {
  return (req: AuthedRequest, res: Response, next: () => void): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function logAction(req: AuthedRequest, action: string, target?: string, detail?: string): void {
  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || undefined;
  audit(req.user?.id ?? null, req.user?.username ?? null, action, target, detail, ip);
}

export function canAccessServer(user: AuthUser | undefined, serverId: string): boolean {
  if (!user) return false;
  if (user.role === "owner" || user.role === "admin") return true;
  return isServerAssignedToUser(serverId, user.id);
}

export function requireServerAccess(req: AuthedRequest, res: Response): boolean {
  const serverId = req.params.id || req.params.serverId;
  if (!serverId) return false;
  if (!canAccessServer(req.user, serverId)) {
    res.status(403).json({ error: "You do not have access to this server" });
    return false;
  }
  return true;
}
