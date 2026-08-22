import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { Modal, ConfirmDialog } from "../components/ui";
import { Plus, Trash2, UserCog, Shield, Ban, KeyRound, Check } from "lucide-react";
import type { User } from "../types";

export function Users() {
  const { show } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const refresh = () => {
    api.getUsers().then((r) => setUsers(r.users)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const handleSuspend = async (user: User) => {
    try {
      await api.suspendUser(user.id, !user.isSuspended);
      show(user.isSuspended ? "User unsuspended" : "User suspended", "success");
      refresh();
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleRoleChange = async (user: User, role: string) => {
    try {
      await api.updateUserRole(user.id, role);
      show("Role updated", "success");
      refresh();
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteUser(confirmDelete.id);
      show("User deleted", "success");
      setConfirmDelete(null);
      refresh();
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser || !newPassword) return;
    if (newPassword.length < 8) {
      show("Password must be at least 8 characters", "error");
      return;
    }
    try {
      await api.resetPassword(resetUser.id, newPassword);
      show("Password reset", "success");
      setResetUser(null);
      setNewPassword("");
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-az-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Users</h1>
          <p className="text-slate-500 text-sm mt-1">{users.length} user(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New User
        </button>
      </div>

      <div className="card divide-y divide-slate-800">
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-3 p-4 group flex-wrap">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-az-500 to-az-700 flex items-center justify-center text-white font-semibold flex-shrink-0">
              {user.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-slate-100">{user.username}</p>
                {user.role === "owner" && <span className="badge badge-blue"><Shield className="w-3 h-3 mr-1" /> Owner</span>}
                {user.role === "admin" && <span className="badge badge-yellow"><UserCog className="w-3 h-3 mr-1" /> Admin</span>}
                {user.isSuspended && <span className="badge badge-red"><Ban className="w-3 h-3 mr-1" /> Suspended</span>}
              </div>
              <p className="text-xs text-slate-500">{user.email || "No email"} · Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</p>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {user.role !== "owner" && (
                <select
                  className="bg-slate-800 text-sm text-slate-300 rounded-lg px-2 py-1.5 border border-slate-700"
                  value={user.role}
                  onChange={(e) => handleRoleChange(user, e.target.value)}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              )}
              {user.role !== "owner" && (
                <button className="btn btn-ghost text-sm py-1.5 px-2" onClick={() => handleSuspend(user)} title={user.isSuspended ? "Unsuspend" : "Suspend"}>
                  <Ban className={`w-4 h-4 ${user.isSuspended ? "text-emerald-400" : "text-amber-400"}`} />
                </button>
              )}
              <button className="btn btn-ghost text-sm py-1.5 px-2" onClick={() => { setResetUser(user); setNewPassword(""); }} title="Reset Password">
                <KeyRound className="w-4 h-4 text-slate-400" />
              </button>
              {user.role !== "owner" && (
                <button className="btn btn-ghost text-sm py-1.5 px-2" onClick={() => setConfirmDelete(user)} title="Delete">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refresh(); }} />
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete User"
        message={`Delete "${confirmDelete?.username}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
      {resetUser && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60" onClick={() => setResetUser(null)}>
          <div className="card bg-slate-900 p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-100 mb-3">Reset Password for {resetUser.username}</h3>
            <input className="input mb-4" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 8 chars)" autoFocus onKeyDown={(e) => e.key === "Enter" && handleResetPassword()} />
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setResetUser(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPassword}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { show } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createUser({ username, password, role, email: email || undefined });
      show("User created", "success");
      setUsername(""); setPassword(""); setEmail(""); setRole("user");
      onCreated();
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="Create New User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} pattern="[a-zA-Z0-9_]{3,32}" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required />
        </div>
        <div>
          <label className="label">Email (optional)</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check className="w-4 h-4" /> Create</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}
