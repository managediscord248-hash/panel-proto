import { Router } from "express";
import { requireRole, type AuthedRequest, logAction, createUser } from "../auth.js";
import { getAllUsers, getUserById, deleteUser, setUserSuspended, updateUserRole, updateUserPassword, countUsers } from "../store.js";
import { validateUsername } from "../paths.js";
import bcrypt from "bcryptjs";

function countOwners(): number {
  return getAllUsers().filter(u => u.role === "owner").length;
}

export const userRoutes = Router();

userRoutes.get("/", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const users = getAllUsers().map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    isSuspended: u.is_suspended === 1,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
  }));
  res.json({ users });
});

userRoutes.post("/", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const { username, password, role, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  if (!validateUsername(username)) {
    return res.status(400).json({ error: "Invalid username" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  const validRoles = ["owner", "admin", "user"];
  const finalRole = validRoles.includes(role) ? role : "user";
  if (finalRole === "owner" && req.user?.role !== "owner") {
    return res.status(403).json({ error: "Only owners can create owners" });
  }
  try {
    const user = await createUser(username, password, finalRole, email);
    logAction(req, "create_user", username, `Role: ${finalRole}`);
    res.json({ user: { id: user.id, username: user.username, role: user.role, email: user.email } });
  } catch (err: any) {
    if (err.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "Username already exists" });
    }
    res.status(400).json({ error: err.message });
  }
});

userRoutes.delete("/:id", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const target = getUserById(id);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.role === "owner" && req.user?.role !== "owner") {
    return res.status(403).json({ error: "Cannot delete owner" });
  }
  if (target.id === req.user?.id) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }
  // Prevent deleting the last owner
  if (target.role === "owner" && countOwners() <= 1) {
    return res.status(400).json({ error: "Cannot delete the last owner. Promote another user to owner first." });
  }
  deleteUser(id);
  logAction(req, "delete_user", target.username);
  res.json({ ok: true });
});

userRoutes.patch("/:id/suspend", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const target = getUserById(id);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.role === "owner") {
    return res.status(403).json({ error: "Cannot suspend owner" });
  }
  const suspend = req.body.suspend !== false;
  setUserSuspended(id, suspend);
  logAction(req, "suspend_user", target.username, suspend ? "suspended" : "unsuspended");
  res.json({ ok: true, suspended: suspend });
});

userRoutes.patch("/:id/role", requireRole("owner"), (req: AuthedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const target = getUserById(id);
  if (!target) return res.status(404).json({ error: "User not found" });
  const role = req.body.role;
  if (!["owner", "admin", "user"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  updateUserRole(id, role);
  logAction(req, "update_role", target.username, `New role: ${role}`);
  res.json({ ok: true });
});

userRoutes.post("/:id/reset-password", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const target = getUserById(id);
  if (!target) return res.status(404).json({ error: "User not found" });
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  const hash = await bcrypt.hash(newPassword, 12);
  updateUserPassword(id, hash);
  logAction(req, "reset_password", target.username);
  res.json({ ok: true });
});
