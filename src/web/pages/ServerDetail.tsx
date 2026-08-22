import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { StatusBadge, ProgressBar, formatBytes, ConfirmDialog } from "../components/ui";
import {
  Play, Square, RotateCw, Skull, Send, Folder, File, ChevronRight, Upload,
  Download, Trash2, Edit3, FolderPlus, Save, ArrowLeft, HardDrive, Package,
  Archive as ArchiveIcon, Terminal, Settings as SettingsIcon, X,
  Users as UsersIcon, Sliders, Shield, Gavel, UserCheck, UserX, Ban, CircleSlash
} from "lucide-react";
import { useAuth } from "../auth-context";
import type { Server, FileEntry, Backup, ModrinthProject, ModrinthVersion, User, PlayerData, PlayerEntry, ServerProperties } from "../types";

type Tab = "console" | "files" | "backups" | "mods" | "players" | "options" | "settings";

export function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const [server, setServer] = useState<Server | null>(null);
  const [tab, setTab] = useState<Tab>("console");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!id) return;
    api.getServer(id).then((r) => setServer(r)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleAction = async (action: "start" | "stop" | "restart" | "kill") => {
    if (!server) return;
    setBusy(true);
    try {
      if (action === "start") await api.startServer(server.id);
      else if (action === "stop") await api.stopServer(server.id);
      else if (action === "restart") await api.restartServer(server.id);
      else if (action === "kill") await api.killServer(server.id);
      show(`${action} sent`, "success");
      refresh();
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-az-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Server not found</p>
        <Link to="/servers" className="btn btn-primary mt-4 inline-flex">Back to Servers</Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "console", label: "Console", icon: <Terminal className="w-4 h-4" /> },
    { key: "files", label: "Files", icon: <Folder className="w-4 h-4" /> },
    { key: "backups", label: "Backups", icon: <ArchiveIcon className="w-4 h-4" /> },
    { key: "mods", label: "Mods", icon: <Package className="w-4 h-4" /> },
    { key: "players", label: "Players", icon: <UsersIcon className="w-4 h-4" /> },
    { key: "options", label: "Options", icon: <Sliders className="w-4 h-4" /> },
    { key: "settings", label: "Settings", icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/servers" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 mb-3">
          <ArrowLeft className="w-4 h-4" /> Servers
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{server.name}</h1>
            <StatusBadge status={server.current_status} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {server.current_status === "running" ? (
              <>
                <button className="btn btn-secondary" disabled={busy} onClick={() => handleAction("stop")}><Square className="w-4 h-4" /> Stop</button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => handleAction("restart")}><RotateCw className="w-4 h-4" /> Restart</button>
                <button className="btn btn-danger" disabled={busy} onClick={() => handleAction("kill")}><Skull className="w-4 h-4" /> Kill</button>
              </>
            ) : (
              <button className="btn btn-primary" disabled={busy} onClick={() => handleAction("start")}><Play className="w-4 h-4" /> Start</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? "border-az-500 text-az-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "console" && <ConsoleTab serverId={server.id} canSend={server.current_status === "running"} />}
      {tab === "files" && <FilesTab serverId={server.id} />}
      {tab === "backups" && <BackupsTab serverId={server.id} serverName={server.name} />}
      {tab === "mods" && <ModsTab serverId={server.id} gameVersion={server.game_version} loader={server.loader} />}
      {tab === "players" && <PlayersTab serverId={server.id} isRunning={server.current_status === "running"} />}
      {tab === "options" && <OptionsTab serverId={server.id} isRunning={server.current_status === "running"} />}
      {tab === "settings" && <SettingsTab server={server} onUpdate={refresh} />}
    </div>
  );
}

function ConsoleTab({ serverId, canSend }: { serverId: string; canSend: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const consoleRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    api.getConsole(serverId).then((r) => setLines(r.lines)).catch(() => {});

    const token = api.getToken();
    const url = `/api/servers/${serverId}/console/stream?token=${encodeURIComponent(token || "")}`;
    // SSE doesn't support custom headers, so we pass token as query param
    // The server reads it from the auth middleware — but our middleware reads headers only
    // So we'll use a polling fallback instead
    esRef.current = null;

    // Polling fallback for console
    let lastCount = 0;
    const poll = setInterval(async () => {
      try {
        const r = await api.getConsole(serverId);
        if (r.lines.length !== lastCount) {
          setLines(r.lines);
          lastCount = r.lines.length;
        }
      } catch { /* ignore */ }
    }, 2000);

    return () => clearInterval(poll);
  }, [serverId]);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [lines]);

  const sendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      await api.sendCommand(serverId, input);
      setInput("");
    } catch (err: any) {
      // show error
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={consoleRef}
        className="card bg-slate-950/80 p-4 h-[60vh] min-h-[300px] max-h-[480px] overflow-y-auto font-mono text-sm leading-relaxed"
      >
        {lines.length === 0 ? (
          <p className="text-slate-600 italic">No console output yet. Start the server to see logs.</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="text-slate-300 whitespace-pre-wrap break-all">{line}</div>
          ))
        )}
      </div>
      <form onSubmit={sendCommand} className="flex gap-2">
        <input
          className="input flex-1 font-mono"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={canSend ? "Type a command..." : "Server is not running"}
          disabled={!canSend}
        />
        <button type="submit" className="btn btn-primary" disabled={!canSend || !input.trim()}>
          <Send className="w-4 h-4" /> Send
        </button>
      </form>
    </div>
  );
}

function FilesTab({ serverId }: { serverId: string }) {
  const { show } = useToast();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameItem, setRenameItem] = useState<FileEntry | null>(null);
  const [renameName, setRenameName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = (path: string) => {
    setLoading(true);
    api.listFiles(serverId, path).then((r) => {
      setFiles(r.files);
      setCurrentPath(path);
    }).catch((err) => show(err.message, "error")).finally(() => setLoading(false));
  };

  useEffect(() => { loadFiles(""); }, []);

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : [];

  const navigateTo = (path: string) => {
    loadFiles(path);
  };

  const handleEdit = async (file: FileEntry) => {
    try {
      const r = await api.getFileContent(serverId, file.path);
      setEditing({ path: file.path, content: r.content });
      setEditContent(r.content);
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      await api.saveFileContent(serverId, editing.path, editContent);
      show("File saved", "success");
      setEditing(null);
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteFile(serverId, confirmDelete.path);
      show("Deleted", "success");
      setConfirmDelete(null);
      loadFiles(currentPath);
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleMkdir = async () => {
    if (!newFolderName.trim()) return;
    const path = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;
    try {
      await api.mkdir(serverId, path);
      show("Folder created", "success");
      setShowNewFolder(false);
      setNewFolderName("");
      loadFiles(currentPath);
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleRename = async () => {
    if (!renameItem || !renameName.trim()) return;
    try {
      await api.renameFile(serverId, renameItem.path, renameName);
      show("Renamed", "success");
      setRenameItem(null);
      setRenameName("");
      loadFiles(currentPath);
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("files", file, file.name);
    }
    try {
      const token = api.getToken();
      const res = await fetch(api.uploadUrl(serverId, currentPath), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Upload failed");
      }
      show(`${files.length} file(s) uploaded`, "success");
      loadFiles(currentPath);
    } catch (err: any) {
      show(err.message, "error");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 text-sm flex-wrap">
          <button className="text-slate-400 hover:text-az-400" onClick={() => navigateTo("")}>root</button>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <button
                className="text-slate-400 hover:text-az-400"
                onClick={() => navigateTo(breadcrumbs.slice(0, i + 1).join("/"))}
              >
                {crumb}
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary text-sm" onClick={() => setShowNewFolder(true)}>
            <FolderPlus className="w-4 h-4" /> New Folder
          </button>
          <button className="btn btn-secondary text-sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" /> Upload
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-az-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">This folder is empty</div>
      ) : (
        <div className="card divide-y divide-slate-800">
          {files.map((file) => (
            <div key={file.path} className="flex items-center gap-3 p-3 hover:bg-slate-800/30 group">
              {file.isDirectory ? (
                <Folder className="w-5 h-5 text-az-400 flex-shrink-0" />
              ) : (
                <File className="w-5 h-5 text-slate-500 flex-shrink-0" />
              )}
              <button
                className="flex-1 text-left text-sm text-slate-200 hover:text-az-300"
                onClick={() => file.isDirectory ? navigateTo(file.path) : handleEdit(file)}
              >
                {file.name}
              </button>
              <span className="text-xs text-slate-500 hidden sm:block">
                {file.isDirectory ? "—" : formatBytes(file.size)}
              </span>
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {!file.isDirectory && (
                  <a
                    href={api.fileDownloadUrl(serverId, file.path)}
                    onClick={(e) => { e.preventDefault(); window.open(api.fileDownloadUrl(serverId, file.path) + `&token=${api.getToken()}`); }}
                    className="p-1.5 rounded text-slate-400 hover:text-az-400 hover:bg-slate-800"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                {!file.isDirectory && file.extension && ["txt", "json", "yml", "yaml", "properties", "conf", "cfg", "log", "md", "sh"].includes(file.extension) && (
                  <button className="p-1.5 rounded text-slate-400 hover:text-az-400 hover:bg-slate-800" onClick={() => handleEdit(file)} title="Edit">
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                <button className="p-1.5 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800" onClick={() => { setRenameItem(file); setRenameName(file.name); }} title="Rename">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800" onClick={() => setConfirmDelete(file)} title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60" onClick={() => setEditing(null)}>
          <div className="card bg-slate-900 w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-slate-100 text-sm">{editing.path}</h3>
              <div className="flex gap-2">
                <button className="btn btn-primary text-sm py-1.5" onClick={handleSaveEdit}><Save className="w-4 h-4" /> Save</button>
                <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-200 p-1"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <textarea
              className="flex-1 bg-slate-950 text-slate-200 p-4 font-mono text-sm resize-none focus:outline-none min-h-[400px]"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* New folder modal */}
      {showNewFolder && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60" onClick={() => setShowNewFolder(false)}>
          <div className="card bg-slate-900 p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-100 mb-3">New Folder</h3>
            <input className="input mb-4" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="folder-name" autoFocus onKeyDown={(e) => e.key === "Enter" && handleMkdir()} />
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setShowNewFolder(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleMkdir}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60" onClick={() => setRenameItem(null)}>
          <div className="card bg-slate-900 p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-100 mb-3">Rename</h3>
            <input className="input mb-4" value={renameName} onChange={(e) => setRenameName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && handleRename()} />
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setRenameItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRename}>Rename</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete"
        message={`Delete "${confirmDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function BackupsTab({ serverId, serverName }: { serverId: string; serverName: string }) {
  const { show } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<Backup | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Backup | null>(null);

  const load = () => {
    api.getBackups(serverId).then((r) => setBackups(r.backups)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.createBackup(serverId);
      show("Backup created", "success");
      load();
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!confirmRestore) return;
    try {
      await api.restoreBackup(serverId, confirmRestore.id);
      show("Backup restored", "success");
      setConfirmRestore(null);
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteBackup(serverId, confirmDelete.id);
      show("Backup deleted", "success");
      setConfirmDelete(null);
      load();
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">{backups.length} backup(s) for {serverName}</p>
        <button className="btn btn-primary" disabled={creating} onClick={handleCreate}>
          {creating ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><ArchiveIcon className="w-4 h-4" /> Create Backup</>}
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-az-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : backups.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">No backups yet</div>
      ) : (
        <div className="card divide-y divide-slate-800">
          {backups.map((backup) => (
            <div key={backup.id} className="flex items-center gap-3 p-3 group">
              <HardDrive className="w-5 h-5 text-slate-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{backup.filename}</p>
                <p className="text-xs text-slate-500">{formatBytes(backup.size_bytes)} · {new Date(backup.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn btn-secondary text-xs py-1.5 px-3" onClick={() => setConfirmRestore(backup)}>Restore</button>
                <button className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800" onClick={() => setConfirmDelete(backup)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!confirmRestore}
        title="Restore Backup"
        message="This will replace all current server files. The server should be stopped first. Continue?"
        confirmLabel="Restore"
        danger
        onConfirm={handleRestore}
        onCancel={() => setConfirmRestore(null)}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Backup"
        message={`Delete "${confirmDelete?.filename}"?`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function ModsTab({ serverId, gameVersion, loader }: { serverId: string; gameVersion: string | null; loader: string | null }) {
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModrinthProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ModrinthProject | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await api.searchMods(query, gameVersion || undefined, loader || undefined);
      setResults(r.hits);
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setSearching(false);
    }
  };

  const selectProject = async (project: ModrinthProject) => {
    setSelected(project);
    setLoadingVersions(true);
    try {
      const r = await api.getVersions(project.slug, gameVersion || undefined, loader || undefined);
      setVersions(r.versions);
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleInstall = async (version: ModrinthVersion) => {
    const file = version.files.find((f) => f.primary) || version.files[0];
    if (!file) return;
    setInstalling(true);
    try {
      await api.installMod({ serverId, fileUrl: file.url, filename: file.filename, versionId: version.id, modsDir: "mods" });
      show(`Installed ${file.filename}`, "success");
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input className="input flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mods on Modrinth..." />
        <button type="submit" className="btn btn-primary" disabled={searching}>
          {searching ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Search"}
        </button>
      </form>

      {selected ? (
        <div className="space-y-3">
          <button className="text-sm text-az-400 hover:text-az-300" onClick={() => setSelected(null)}>← Back to results</button>
          <div className="card p-4 flex items-center gap-4">
            {selected.icon_url ? (
              <img src={selected.icon_url} alt="" className="w-12 h-12 rounded-lg" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center"><Package className="w-6 h-6 text-slate-500" /></div>
            )}
            <div>
              <h3 className="font-semibold text-slate-100">{selected.name}</h3>
              <p className="text-xs text-slate-500">{selected.downloads.toLocaleString()} downloads</p>
            </div>
          </div>
          {loadingVersions ? (
            <div className="flex justify-center py-4"><div className="w-6 h-6 border-2 border-az-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : versions.length === 0 ? (
            <div className="card p-4 text-center text-slate-500">No compatible versions found</div>
          ) : (
            <div className="card divide-y divide-slate-800">
              {versions.slice(0, 15).map((version) => (
                <div key={version.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{version.name || version.version_number}</p>
                    <p className="text-xs text-slate-500">
                      Game: {version.game_versions.join(", ")} · Loaders: {version.loaders.join(", ")}
                    </p>
                  </div>
                  <button className="btn btn-primary text-xs py-1.5 px-3" disabled={installing} onClick={() => handleInstall(version)}>
                    <Download className="w-3.5 h-3.5" /> Install
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {results.map((project) => (
            <button key={project.id} onClick={() => selectProject(project)} className="card card-hover p-3 flex items-center gap-3 text-left">
              {project.icon_url ? (
                <img src={project.icon_url} alt="" className="w-10 h-10 rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-slate-500" /></div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{project.name}</p>
                <p className="text-xs text-slate-500 truncate">{project.description}</p>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlayersTab({ serverId, isRunning }: { serverId: string; isRunning: boolean }) {
  const { show } = useToast();
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPlayer, setActionPlayer] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"kick" | "ban" | "unban" | "whitelist-add" | "whitelist-remove" | "op" | "deop" | null>(null);
  const [banReason, setBanReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualPlayer, setManualPlayer] = useState("");

  const load = useCallback(() => {
    api.getPlayers(serverId).then((r) => setData(r)).catch(() => {}).finally(() => setLoading(false));
  }, [serverId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const confirmAction = async () => {
    if (!actionPlayer || !actionType) return;
    setBusy(true);
    try {
      switch (actionType) {
        case "kick":
          await api.kickPlayer(serverId, actionPlayer);
          break;
        case "ban":
          await api.banPlayer(serverId, actionPlayer, banReason || undefined);
          break;
        case "unban":
          await api.unbanPlayer(serverId, actionPlayer);
          break;
        case "whitelist-add":
          await api.whitelistAdd(serverId, actionPlayer);
          break;
        case "whitelist-remove":
          await api.whitelistRemove(serverId, actionPlayer);
          break;
        case "op":
          await api.opPlayer(serverId, actionPlayer);
          break;
        case "deop":
          await api.deopPlayer(serverId, actionPlayer);
          break;
      }
      show(`Action "${actionType}" sent for ${actionPlayer}`, "success");
      setActionPlayer(null);
      setActionType(null);
      setBanReason("");
      setTimeout(load, 1000);
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const openAction = (player: string, type: typeof actionType) => {
    setActionPlayer(player);
    setActionType(type);
    setBanReason("");
  };

  const handleManualAction = (type: typeof actionType) => {
    if (!manualPlayer.trim()) return;
    openAction(manualPlayer.trim(), type);
    setManualPlayer("");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-az-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="card p-8 text-center text-slate-500">Failed to load player data</div>;
  }

  const confirmMessage = actionType === "ban"
    ? `Ban "${actionPlayer}"?${banReason ? ` Reason: ${banReason}` : ""}`
    : actionType === "kick"
    ? `Kick "${actionPlayer}" from the server?`
    : `${actionType?.replace("-", " ")} "${actionPlayer}"?`;

  return (
    <div className="space-y-6">
      {!isRunning && (
        <div className="card p-4 flex items-center gap-3 border-amber-700/30 bg-amber-950/20">
          <CircleSlash className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">Server is not running. Player actions require the server to be online. You can still view saved ban/whitelist/OP lists.</p>
        </div>
      )}

      {/* Online players */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <UsersIcon className="w-4 h-4 text-az-400" /> Online Players ({data.online.length})
        </h3>
        {data.online.length === 0 ? (
          <div className="card p-6 text-center text-slate-500 text-sm">No players currently online</div>
        ) : (
          <div className="card divide-y divide-slate-800">
            {data.online.map((player) => (
              <div key={player} className="flex items-center gap-3 p-3 group">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-semibold text-xs">
                  {player[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-200">{player}</p>
                  <p className="text-xs text-green-400">Online</p>
                </div>
                <div className="flex gap-1">
                  <button className="btn btn-secondary text-xs py-1.5 px-3" disabled={!isRunning} onClick={() => openAction(player, "kick")}>
                    <UserX className="w-3.5 h-3.5" /> Kick
                  </button>
                  <button className="btn btn-secondary text-xs py-1.5 px-3" disabled={!isRunning} onClick={() => openAction(player, "ban")}>
                    <Ban className="w-3.5 h-3.5" /> Ban
                  </button>
                  <button className="btn btn-secondary text-xs py-1.5 px-3" disabled={!isRunning} onClick={() => openAction(player, "op")}>
                    <Shield className="w-3.5 h-3.5" /> OP
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual action */}
      <div className="card p-4">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Manage Player by Name</h4>
        <div className="flex gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-[200px]"
            value={manualPlayer}
            onChange={(e) => setManualPlayer(e.target.value)}
            placeholder="Player username"
            pattern="[a-zA-Z0-9_]{3,32}"
          />
          <button className="btn btn-secondary text-xs" disabled={!isRunning || !manualPlayer.trim()} onClick={() => handleManualAction("kick")}>Kick</button>
          <button className="btn btn-secondary text-xs" disabled={!isRunning || !manualPlayer.trim()} onClick={() => handleManualAction("ban")}>Ban</button>
          <button className="btn btn-secondary text-xs" disabled={!isRunning || !manualPlayer.trim()} onClick={() => handleManualAction("unban")}>Unban</button>
          <button className="btn btn-secondary text-xs" disabled={!isRunning || !manualPlayer.trim()} onClick={() => handleManualAction("whitelist-add")}>Whitelist</button>
          <button className="btn btn-secondary text-xs" disabled={!isRunning || !manualPlayer.trim()} onClick={() => handleManualAction("whitelist-remove")}>Remove WL</button>
          <button className="btn btn-secondary text-xs" disabled={!isRunning || !manualPlayer.trim()} onClick={() => handleManualAction("op")}>OP</button>
          <button className="btn btn-secondary text-xs" disabled={!isRunning || !manualPlayer.trim()} onClick={() => handleManualAction("deop")}>De-OP</button>
        </div>
      </div>

      {/* Banned players */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Ban className="w-4 h-4 text-red-400" /> Banned Players ({data.banned.length})
        </h3>
        {data.banned.length === 0 ? (
          <div className="card p-6 text-center text-slate-500 text-sm">No banned players</div>
        ) : (
          <div className="card divide-y divide-slate-800">
            {data.banned.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 font-semibold text-xs">
                  {entry.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-200">{entry.name}</p>
                  {entry.reason && <p className="text-xs text-slate-500">Reason: {entry.reason}</p>}
                </div>
                <button className="btn btn-secondary text-xs py-1.5 px-3" disabled={!isRunning} onClick={() => openAction(entry.name, "unban")}>
                  Unban
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Whitelist */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-az-400" /> Whitelist ({data.whitelist.length})
        </h3>
        {data.whitelist.length === 0 ? (
          <div className="card p-6 text-center text-slate-500 text-sm">No whitelisted players</div>
        ) : (
          <div className="card divide-y divide-slate-800">
            {data.whitelist.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-full bg-az-500/20 flex items-center justify-center text-az-400 font-semibold text-xs">
                  {entry.name[0]?.toUpperCase()}
                </div>
                <p className="text-sm text-slate-200 flex-1">{entry.name}</p>
                <button className="btn btn-secondary text-xs py-1.5 px-3" disabled={!isRunning} onClick={() => openAction(entry.name, "whitelist-remove")}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OPs */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" /> Operators ({data.ops.length})
        </h3>
        {data.ops.length === 0 ? (
          <div className="card p-6 text-center text-slate-500 text-sm">No operators</div>
        ) : (
          <div className="card divide-y divide-slate-800">
            {data.ops.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-semibold text-xs">
                  {entry.name[0]?.toUpperCase()}
                </div>
                <p className="text-sm text-slate-200 flex-1">{entry.name}</p>
                <button className="btn btn-secondary text-xs py-1.5 px-3" disabled={!isRunning} onClick={() => openAction(entry.name, "deop")}>
                  De-OP
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={!!actionType}
        title={actionType === "ban" ? "Ban Player" : actionType === "kick" ? "Kick Player" : "Confirm Action"}
        message={confirmMessage}
        confirmLabel={actionType === "ban" ? "Ban" : actionType === "kick" ? "Kick" : "Confirm"}
        danger={actionType === "ban" || actionType === "kick"}
        onConfirm={confirmAction}
        onCancel={() => { setActionType(null); setActionPlayer(null); setBanReason(""); }}
      >
        {actionType === "ban" && (
          <input
            className="input mt-3 w-full"
            placeholder="Reason (optional)"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            autoFocus
          />
        )}
      </ConfirmDialog>
    </div>
  );
}

function OptionsTab({ serverId, isRunning }: { serverId: string; isRunning: boolean }) {
  const { show } = useToast();
  const [props, setProps] = useState<ServerProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Local form state
  const [motd, setMotd] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [onlineMode, setOnlineMode] = useState(true);
  const [spawnProtection, setSpawnProtection] = useState(16);
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [pvp, setPvp] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [viewDistance, setViewDistance] = useState(10);
  const [simulationDistance, setSimulationDistance] = useState(10);

  const load = useCallback(() => {
    api.getProperties(serverId).then((r) => {
      setProps(r.properties);
      setMotd(r.properties.motd ?? "");
      setDifficulty(r.properties.difficulty ?? "easy");
      setOnlineMode(r.properties.onlineMode ?? true);
      setSpawnProtection(r.properties.spawnProtection ?? 16);
      setWhitelistEnabled(r.properties.whitelistEnabled ?? false);
      setPvp(r.properties.pvp ?? true);
      setMaxPlayers(r.properties.maxPlayers ?? 20);
      setViewDistance(parseInt(r.properties["view-distance"] as string) || 10);
      setSimulationDistance(parseInt(r.properties["simulation-distance"] as string) || 10);
      setDirty(false);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [serverId]);

  useEffect(() => {
    load();
    setIconPreview(api.iconUrl(serverId) + `?t=${Date.now()}`);
  }, [load, serverId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        "motd": motd,
        "difficulty": difficulty,
        "online-mode": onlineMode,
        "spawn-protection": spawnProtection,
        "white-list": whitelistEnabled,
        "pvp": pvp,
        "max-players": maxPlayers,
        "view-distance": viewDistance,
        "simulation-distance": simulationDistance,
      };
      const r = await api.updateProperties(serverId, updates);
      if (r.needsRestart) {
        show("Settings saved. Restart required for some changes to take effect.", "success");
      } else {
        show("Settings saved", "success");
      }
      setDirty(false);
      load();
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    try {
      await api.uploadIcon(serverId, file);
      show("Server icon updated", "success");
      setIconPreview(api.iconUrl(serverId) + `?t=${Date.now()}`);
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setUploadingIcon(false);
    }
    if (e.target) e.target.value = "";
  };

  const handleIconDelete = async () => {
    try {
      await api.deleteIcon(serverId);
      show("Server icon removed", "success");
      setIconPreview(null);
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const markDirty = () => setDirty(true);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-az-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* MOTD Card */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-az-400" /> MOTD
        </h3>
        <p className="text-xs text-slate-500 mb-4">The message shown in the multiplayer server list. Use &amp; for color codes (e.g. &amp;a for green).</p>
        <input
          className="input"
          value={motd}
          onChange={(e) => { setMotd(e.target.value); markDirty(); }}
          placeholder="A Minecraft Server"
        />
        <div className="mt-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
          <p className="text-xs text-slate-500 mb-1">Preview:</p>
          <p className="text-sm text-slate-200 font-mono">{motd || "A Minecraft Server"}</p>
        </div>
      </div>

      {/* Server Icon Card */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
          <Package className="w-4 h-4 text-az-400" /> Server Icon
        </h3>
        <p className="text-xs text-slate-500 mb-4">Upload a PNG or JPEG image. It will be resized to 64x64 pixels for the Minecraft server list.</p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
            {iconPreview ? (
              <img src={iconPreview} alt="Server icon" className="w-full h-full object-cover" />
            ) : (
              <Package className="w-6 h-6 text-slate-600" />
            )}
          </div>
          <div className="flex gap-2">
            <label className="btn btn-secondary cursor-pointer">
              {uploadingIcon ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleIconUpload} disabled={uploadingIcon} />
            </label>
            {iconPreview && (
              <button className="btn btn-secondary text-red-400" onClick={handleIconDelete}>
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Difficulty Card */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
          <Gavel className="w-4 h-4 text-az-400" /> Difficulty
        </h3>
        <p className="text-xs text-slate-500 mb-4">Controls the difficulty of the server (mob damage, hunger, etc.)</p>
        <div className="grid grid-cols-4 gap-2">
          {["peaceful", "easy", "normal", "hard"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { setDifficulty(d); markDirty(); }}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium capitalize transition-all ${
                difficulty === d
                  ? "bg-az-500/20 text-az-300 border border-az-500/50"
                  : "bg-slate-800/30 text-slate-400 border border-slate-700 hover:bg-slate-800/50"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Online Mode Card */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-az-400" /> Online Mode
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          When enabled, the server authenticates players against Minecraft's session servers. Disabling allows cracked/offline players to join but is insecure. <strong className="text-amber-400">Requires restart.</strong>
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => { setOnlineMode(!onlineMode); markDirty(); }}
            className={`relative w-12 h-6 rounded-full transition-colors ${onlineMode ? "bg-az-500" : "bg-slate-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${onlineMode ? "translate-x-6" : ""}`} />
          </button>
          <span className="text-sm text-slate-200">{onlineMode ? "Enabled (Premium)" : "Disabled (Cracked)"}</span>
        </label>
      </div>

      {/* Spawn Protection Card */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-az-400" /> Spawn Protection
        </h3>
        <p className="text-xs text-slate-500 mb-4">Radius (in blocks) around spawn where only OPs can break/place blocks. Set to 0 to disable. <strong className="text-amber-400">Requires restart.</strong></p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="64"
            value={spawnProtection}
            onChange={(e) => { setSpawnProtection(parseInt(e.target.value)); markDirty(); }}
            className="flex-1 accent-az-500"
          />
          <span className="text-sm text-slate-200 w-12 text-right">{spawnProtection} blocks</span>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-az-400" /> Additional Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-200">Whitelist</p>
              <p className="text-xs text-slate-500">Only allow whitelisted players to join</p>
            </div>
            <button
              type="button"
              onClick={() => { setWhitelistEnabled(!whitelistEnabled); markDirty(); }}
              className={`relative w-12 h-6 rounded-full transition-colors ${whitelistEnabled ? "bg-az-500" : "bg-slate-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${whitelistEnabled ? "translate-x-6" : ""}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-200">PvP</p>
              <p className="text-xs text-slate-500">Allow players to damage each other</p>
            </div>
            <button
              type="button"
              onClick={() => { setPvp(!pvp); markDirty(); }}
              className={`relative w-12 h-6 rounded-full transition-colors ${pvp ? "bg-az-500" : "bg-slate-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${pvp ? "translate-x-6" : ""}`} />
            </button>
          </div>
          <div>
            <label className="label">Max Players</label>
            <input type="number" className="input" value={maxPlayers} min="1" onChange={(e) => { setMaxPlayers(parseInt(e.target.value) || 20); markDirty(); }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">View Distance (chunks)</label>
              <input type="number" className="input" value={viewDistance} min="3" max="32" onChange={(e) => { setViewDistance(parseInt(e.target.value) || 10); markDirty(); }} />
            </div>
            <div>
              <label className="label">Simulation Distance (chunks)</label>
              <input type="number" className="input" value={simulationDistance} min="3" max="32" onChange={(e) => { setSimulationDistance(parseInt(e.target.value) || 10); markDirty(); }} />
            </div>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-4 flex items-center gap-3 p-3 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-800 shadow-lg">
        {dirty && <span className="text-xs text-amber-400">Unsaved changes</span>}
        <div className="flex-1" />
        <button className="btn btn-primary" disabled={!dirty || saving} onClick={handleSave}>
          {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Save & Apply
        </button>
      </div>
    </div>
  );
}

function SettingsTab({ server, onUpdate }: { server: Server; onUpdate: () => void }) {
  const { show } = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "owner" || currentUser?.role === "admin";
  const [name, setName] = useState(server.name);
  const [port, setPort] = useState(String(server.port));
  const [memoryMb, setMemoryMb] = useState(String(server.memory_mb));
  const [maxPlayers, setMaxPlayers] = useState(String(server.max_players));
  const [javaVersion, setJavaVersion] = useState(server.java_version);
  const [gameVersion, setGameVersion] = useState(server.game_version || "");
  const [loader, setLoader] = useState(server.loader || "vanilla");
  const [motd, setMotd] = useState(server.motd || "");
  const [autoStart, setAutoStart] = useState(server.auto_start === 1);
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [assignedIds, setAssignedIds] = useState<number[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.getUsers().then((r) => setAllUsers(r.users)).catch(() => {});
      api.getAssignments(server.id).then((r) => setAssignedIds(r.userIds)).catch(() => {});
    }
  }, [isAdmin, server.id]);

  const toggleUser = (uid: number) => {
    setAssignedIds((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);
  };

  const handleSaveAssignments = async () => {
    setSavingAssign(true);
    try {
      await api.setAssignments(server.id, assignedIds);
      show("Assignments saved", "success");
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setSavingAssign(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateServer(server.id, { name, port, memoryMb, maxPlayers, javaVersion, gameVersion, loader, motd, autoStart });
      show("Server updated", "success");
      onUpdate();
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Port</label>
          <input className="input" type="number" value={port} onChange={(e) => setPort(e.target.value)} min="1" max="65535" required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Memory (MB)</label>
          <input className="input" type="number" value={memoryMb} onChange={(e) => setMemoryMb(e.target.value)} min="256" required />
        </div>
        <div>
          <label className="label">Max Players</label>
          <input className="input" type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} min="1" required />
        </div>
        <div>
          <label className="label">Java Version</label>
          <select className="input" value={javaVersion} onChange={(e) => setJavaVersion(e.target.value)}>
            <option value="8">Java 8</option>
            <option value="11">Java 11</option>
            <option value="17">Java 17</option>
            <option value="21">Java 21</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Loader</label>
          <select className="input" value={loader} onChange={(e) => setLoader(e.target.value)}>
            <option value="vanilla">Vanilla</option>
            <option value="forge">Forge</option>
            <option value="fabric">Fabric</option>
            <option value="paper">Paper</option>
            <option value="spigot">Spigot</option>
          </select>
        </div>
        <div>
          <label className="label">Game Version</label>
          <input className="input" value={gameVersion} onChange={(e) => setGameVersion(e.target.value)} placeholder="1.21.1" />
        </div>
      </div>
      <div>
        <label className="label">MOTD</label>
        <input className="input" value={motd} onChange={(e) => setMotd(e.target.value)} placeholder="A Minecraft Server" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
        <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-az-600 focus:ring-az-500" />
        Auto-start when panel starts
      </label>
      <div className="pt-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
        </button>
      </div>

      {isAdmin && (
        <div className="pt-6 border-t border-slate-800">
          <h3 className="font-semibold text-slate-200 mb-3">User Assignments</h3>
          <p className="text-sm text-slate-500 mb-3">Assign users to this server. Assigned users can start, stop, and manage this server.</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {allUsers.filter((u) => u.role === "user").map((u) => (
              <label key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={assignedIds.includes(u.id)}
                  onChange={() => toggleUser(u.id)}
                  className="rounded border-slate-600 bg-slate-900 text-az-600 focus:ring-az-500"
                />
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs" style={{ background: "linear-gradient(135deg, var(--az-500), var(--az-700))" }}>
                  {u.username[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-slate-200">{u.username}</span>
              </label>
            ))}
          </div>
          {allUsers.filter((u) => u.role === "user").length === 0 && (
            <p className="text-sm text-slate-500 italic">No regular users to assign</p>
          )}
          <button type="button" className="btn btn-secondary mt-4" disabled={savingAssign} onClick={handleSaveAssignments}>
            {savingAssign ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Save Assignments
          </button>
        </div>
      )}
    </form>
  );
}
