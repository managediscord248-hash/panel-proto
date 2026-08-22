import { Router } from "express";
import { authenticateUser, signToken, toAuthUser, requireAuth, createUser, type AuthedRequest, logAction } from "../auth.js";
import { getUserById, getUserByUsername, updateUserPassword, getSettings } from "../store.js";
import bcrypt from "bcryptjs";
import { validateUsername } from "../paths.js";

export const authRoutes = Router();

authRoutes.post("/login", async (req: AuthedRequest, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const user = await authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken(user);
  req.user = user;
  logAction(req, "login", undefined, `User ${user.username} logged in`);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
});

authRoutes.get("/registration-enabled", (_req, res) => {
  const settings = getSettings();
  res.json({ enabled: settings["registration_enabled"] === "1" });
});

authRoutes.post("/register", async (req, res) => {
  const settings = getSettings();
  if (settings["registration_enabled"] !== "1") {
    return res.status(403).json({ error: "Registration is disabled" });
  }
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  if (!validateUsername(username)) {
    return res.status(400).json({ error: "Username must be 3-32 chars, alphanumeric/underscore" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  if (getUserByUsername(username)) {
    return res.status(409).json({ error: "Username already exists" });
  }
  const user = await createUser(username, password, "user", email || undefined);
  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
});

authRoutes.post("/change-password", async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  const row = getUserById(req.user.id);
  if (!row) return res.status(404).json({ error: "User not found" });
  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Current password incorrect" });
  }
  const hash = await bcrypt.hash(newPassword, 12);
  updateUserPassword(req.user.id, hash);
  logAction(req, "change_password", req.user.username);
  res.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

authRoutes.post("/logout", (req: AuthedRequest, res) => {
  logAction(req, "logout", req.user?.username);
  res.json({ ok: true });
});
