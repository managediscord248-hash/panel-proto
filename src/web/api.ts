import type { User, Server, FileEntry, Backup, ModrinthProject, ModrinthVersion, SystemStats, AuditEntry, Node, PlayerData, ServerProperties } from "./types";

const API = "/api";

function getToken(): string | null {
  return localStorage.getItem("az_token");
}

function setToken(token: string | null): void {
  if (token) localStorage.setItem("az_token", token);
  else localStorage.removeItem("az_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Don't set Content-Type for FormData - browser sets it with boundary
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event("az:unauthorized"));
  }
  if (!res.ok) {
    let error = "Request failed";
    try {
      const body = await res.json();
      error = body.error || error;
    } catch { /* ignore */ }
    throw new Error(error);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => request<{ user: User }>("/auth/me"),
  getRegistrationEnabled: () => request<{ enabled: boolean }>("/auth/registration-enabled"),
  register: (username: string, password: string, email?: string) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, email }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  logout: () => {
    setToken(null);
  },

  // Setup
  getSetupStatus: () => request<{ setupComplete: boolean }>("/setup/status"),
  completeSetup: (data: { panelName: string; username: string; password: string; email?: string; themeColor?: string }) =>
    request<{ ok: boolean }>("/setup/complete", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Servers
  getServers: () => request<{ servers: Server[] }>("/servers"),
  getServer: (id: string) => request<Server>(`/servers/${id}`),
  createServer: (data: any) =>
    request<{ server: Server }>("/servers", { method: "POST", body: JSON.stringify(data) }),
  updateServer: (id: string, data: any) =>
    request<{ server: Server }>(`/servers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteServer: (id: string) =>
    request<{ ok: boolean }>(`/servers/${id}`, { method: "DELETE" }),
  startServer: (id: string) => request<{ ok: boolean }>(`/servers/${id}/start`, { method: "POST" }),
  stopServer: (id: string) => request<{ ok: boolean }>(`/servers/${id}/stop`, { method: "POST" }),
  restartServer: (id: string) => request<{ ok: boolean }>(`/servers/${id}/restart`, { method: "POST" }),
  killServer: (id: string) => request<{ ok: boolean }>(`/servers/${id}/kill`, { method: "POST" }),
  sendCommand: (id: string, command: string) =>
    request<{ ok: boolean }>(`/servers/${id}/command`, { method: "POST", body: JSON.stringify({ command }) }),
  getConsole: (id: string) => request<{ lines: string[] }>(`/servers/${id}/console`),
  getServerStatus: (id: string) => request<{ status: string; isRunning: boolean }>(`/servers/${id}/status`),
  downloadJar: (id: string, serverType: string, gameVersion: string) =>
    request<{ ok: boolean; filename: string; size: number }>(`/servers/${id}/download-jar`, { method: "POST", body: JSON.stringify({ serverType, gameVersion }) }),
  getMinecraftVersions: () => request<{ versions: string[] }>("/servers/meta/versions"),
  getServerTypes: () => request<{ types: { value: string; label: string; needsModsDir: boolean }[] }>("/servers/meta/types"),

  // Files
  listFiles: (serverId: string, path = "") =>
    request<{ files: FileEntry[] }>(`/files/${serverId}/list?path=${encodeURIComponent(path)}`),
  getFileContent: (serverId: string, path: string) =>
    request<{ content: string }>(`/files/${serverId}/content?path=${encodeURIComponent(path)}`),
  saveFileContent: (serverId: string, path: string, content: string) =>
    request<{ ok: boolean }>(`/files/${serverId}/content?path=${encodeURIComponent(path)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  mkdir: (serverId: string, path: string) =>
    request<{ ok: boolean }>(`/files/${serverId}/mkdir`, { method: "POST", body: JSON.stringify({ path }) }),
  deleteFile: (serverId: string, path: string) =>
    request<{ ok: boolean }>(`/files/${serverId}?path=${encodeURIComponent(path)}`, { method: "DELETE" }),
  renameFile: (serverId: string, path: string, newName: string) =>
    request<{ ok: boolean }>(`/files/${serverId}/rename`, { method: "POST", body: JSON.stringify({ path, newName }) }),
  fileDownloadUrl: (serverId: string, path: string) =>
    `${API}/files/${serverId}/download?path=${encodeURIComponent(path)}`,
  uploadUrl: (serverId: string, path: string) =>
    `${API}/files/${serverId}/upload?path=${encodeURIComponent(path)}`,

  // Backups
  getBackups: (serverId: string) => request<{ backups: Backup[] }>(`/backups/${serverId}`),
  createBackup: (serverId: string) =>
    request<{ backup: Backup }>(`/backups/${serverId}`, { method: "POST" }),
  restoreBackup: (serverId: string, backupId: string) =>
    request<{ ok: boolean }>(`/backups/${serverId}/${backupId}/restore`, { method: "POST" }),
  deleteBackup: (serverId: string, backupId: string) =>
    request<{ ok: boolean }>(`/backups/${serverId}/${backupId}`, { method: "DELETE" }),

  // Modrinth
  searchMods: (query: string, gameVersion?: string, loader?: string) =>
    request<{ hits: ModrinthProject[]; total: number }>(
      `/modrinth/search?q=${encodeURIComponent(query)}${gameVersion ? `&game_version=${gameVersion}` : ""}${loader ? `&loader=${loader}` : ""}`
    ),
  getProject: (slug: string) => request<{ project: ModrinthProject }>(`/modrinth/project/${slug}`),
  getVersions: (slug: string, gameVersion?: string, loader?: string) =>
    request<{ versions: ModrinthVersion[] }>(
      `/modrinth/project/${slug}/versions${gameVersion ? `?game_version=${gameVersion}` : ""}${loader ? `${gameVersion ? "&" : "?"}loader=${loader}` : ""}`
    ),
  installMod: (data: { serverId: string; fileUrl: string; filename: string; versionId: string; modsDir?: string }) =>
    request<{ ok: boolean; size: number }>("/modrinth/install", { method: "POST", body: JSON.stringify(data) }),
  getInstalledMods: (serverId: string) => request<{ mods: { filename: string; size: number; modified: string }[] }>(`/modrinth/installed/${serverId}`),
  deleteMod: (serverId: string, filename: string) =>
    request<{ ok: boolean }>(`/files/${serverId}?path=${encodeURIComponent("mods/" + filename)}`, { method: "DELETE" }),

  // System
  getStats: () => request<{ stats: SystemStats }>("/system/stats"),
  getJava: () => request<{ versions: { path: string; version: string }[] }>("/system/java"),
  getAuditLog: (limit = 100, offset = 0) =>
    request<{ logs: AuditEntry[]; total: number }>(`/system/audit?limit=${limit}&offset=${offset}`),

  // Users
  getUsers: () => request<{ users: User[] }>("/users"),
  createUser: (data: { username: string; password: string; role: string; email?: string }) =>
    request<{ user: User }>("/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id: number) => request<{ ok: boolean }>(`/users/${id}`, { method: "DELETE" }),
  suspendUser: (id: number, suspend: boolean) =>
    request<{ ok: boolean }>(`/users/${id}/suspend`, { method: "PATCH", body: JSON.stringify({ suspend }) }),
  updateUserRole: (id: number, role: string) =>
    request<{ ok: boolean }>(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  resetPassword: (id: number, newPassword: string) =>
    request<{ ok: boolean }>(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword }) }),

  // Settings
  getSettings: () => request<{ settings: Record<string, string> }>("/settings"),
  updateSettings: (settings: Record<string, string>) =>
    request<{ ok: boolean }>("/settings", { method: "PATCH", body: JSON.stringify({ settings }) }),
  uploadImage: (type: "logo" | "bg", file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ ok: boolean; url: string }>(`/settings/upload?type=${type}`, { method: "POST", body: formData });
  },
  removeImage: (type: "logo" | "bg") =>
    request<{ ok: boolean }>(`/settings/image/${type}`, { method: "DELETE" }),

  // Server Assignments
  getAssignments: (serverId: string) =>
    request<{ userIds: number[] }>(`/servers/${serverId}/assignments`),
  setAssignments: (serverId: string, userIds: number[]) =>
    request<{ ok: boolean; userIds: number[] }>(`/servers/${serverId}/assignments`, { method: "PUT", body: JSON.stringify({ userIds }) }),

  // Nodes
  getNodes: () => request<{ nodes: Node[] }>("/nodes"),
  createNode: (data: { name: string; host?: string; port?: number }) =>
    request<{ node: Node }>("/nodes", { method: "POST", body: JSON.stringify(data) }),
  updateNode: (id: string, data: { name?: string; host?: string; port?: number; enabled?: boolean }) =>
    request<{ node: Node }>(`/nodes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteNode: (id: string) =>
    request<{ ok: boolean }>(`/nodes/${id}`, { method: "DELETE" }),
  toggleNode: (id: string) =>
    request<{ node: Node }>(`/nodes/${id}/toggle`, { method: "POST" }),

  // Players
  getPlayers: (serverId: string) =>
    request<PlayerData>(`/servers/${serverId}/players`),
  kickPlayer: (serverId: string, player: string) =>
    request<{ ok: boolean }>(`/servers/${serverId}/players/kick`, { method: "POST", body: JSON.stringify({ player }) }),
  banPlayer: (serverId: string, player: string, reason?: string) =>
    request<{ ok: boolean }>(`/servers/${serverId}/players/ban`, { method: "POST", body: JSON.stringify({ player, reason }) }),
  unbanPlayer: (serverId: string, player: string) =>
    request<{ ok: boolean }>(`/servers/${serverId}/players/unban`, { method: "POST", body: JSON.stringify({ player }) }),
  whitelistAdd: (serverId: string, player: string) =>
    request<{ ok: boolean }>(`/servers/${serverId}/players/whitelist/add`, { method: "POST", body: JSON.stringify({ player }) }),
  whitelistRemove: (serverId: string, player: string) =>
    request<{ ok: boolean }>(`/servers/${serverId}/players/whitelist/remove`, { method: "POST", body: JSON.stringify({ player }) }),
  opPlayer: (serverId: string, player: string) =>
    request<{ ok: boolean }>(`/servers/${serverId}/players/op`, { method: "POST", body: JSON.stringify({ player }) }),
  deopPlayer: (serverId: string, player: string) =>
    request<{ ok: boolean }>(`/servers/${serverId}/players/deop`, { method: "POST", body: JSON.stringify({ player }) }),

  // Server Options / Properties
  getProperties: (serverId: string) =>
    request<{ properties: ServerProperties }>(`/servers/${serverId}/properties`),
  updateProperties: (serverId: string, updates: Record<string, any>) =>
    request<{ ok: boolean; needsRestart: boolean; changed: string[] }>(`/servers/${serverId}/properties`, { method: "PATCH", body: JSON.stringify(updates) }),
  uploadIcon: (serverId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ ok: boolean }>(`/servers/${serverId}/icon`, { method: "POST", body: formData });
  },
  iconUrl: (serverId: string) =>
    `${API}/servers/${serverId}/icon`,
  deleteIcon: (serverId: string) =>
    request<{ ok: boolean }>(`/servers/${serverId}/icon`, { method: "DELETE" }),
  toggleWhitelist: (serverId: string, enabled: boolean) =>
    request<{ ok: boolean }>(`/servers/${serverId}/whitelist/toggle`, { method: "POST", body: JSON.stringify({ enabled }) }),

  // Token
  setToken,
  getToken,
};
