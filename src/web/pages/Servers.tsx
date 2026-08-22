import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { StatusBadge, Modal, ConfirmDialog } from "../components/ui";
import { Link } from "react-router-dom";
import { Plus, Server, Play, Square, RotateCw, Trash2, Download } from "lucide-react";
import type { Server as ServerType } from "../types";

const SERVER_TYPES = [
  { value: "vanilla", label: "Vanilla" },
  { value: "paper", label: "Paper" },
  { value: "purpur", label: "Purpur" },
  { value: "spigot", label: "Spigot" },
  { value: "fabric", label: "Fabric" },
  { value: "forge", label: "Forge" },
  { value: "neoforge", label: "NeoForge" },
];

export function Servers() {
  const { show } = useToast();
  const [servers, setServers] = useState<ServerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ServerType | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    api.getServers().then((r) => setServers(r.servers)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (server: ServerType, action: "start" | "stop" | "restart" | "kill") => {
    setBusy(server.id);
    try {
      if (action === "start") await api.startServer(server.id);
      else if (action === "stop") await api.stopServer(server.id);
      else if (action === "restart") await api.restartServer(server.id);
      else if (action === "kill") await api.killServer(server.id);
      show(`${action} sent to ${server.name}`, "success");
      refresh();
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteServer(confirmDelete.id);
      show("Server deleted", "success");
      setConfirmDelete(null);
      refresh();
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-az-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Servers</h1>
          <p className="text-slate-500 text-sm mt-1">{servers.length} server(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Server
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="card p-12 text-center">
          <Server className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">No servers yet</h3>
          <p className="text-slate-500 text-sm mb-4">Create a server to get started</p>
          <button className="btn btn-primary inline-flex" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Create Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((server) => (
            <div key={server.id} className="card card-hover p-5">
              <div className="flex items-center justify-between mb-3">
                <Link to={`/servers/${server.id}`} className="font-semibold text-slate-100 hover:text-az-300 transition-colors">
                  {server.name}
                </Link>
                <StatusBadge status={server.current_status} />
              </div>
              <div className="text-xs text-slate-500 space-y-1 mb-4">
                <p>Port: {server.port} · RAM: {server.memory_mb} MB</p>
                <p>Java {server.java_version} · {server.loader || "vanilla"}</p>
                {server.game_version && <p>Game: {server.game_version}</p>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {server.current_status === "running" ? (
                  <>
                    <button className="btn btn-secondary text-sm py-1.5 px-3" disabled={busy === server.id} onClick={() => handleAction(server, "stop")}>
                      <Square className="w-3.5 h-3.5" /> Stop
                    </button>
                    <button className="btn btn-secondary text-sm py-1.5 px-3" disabled={busy === server.id} onClick={() => handleAction(server, "restart")}>
                      <RotateCw className="w-3.5 h-3.5" /> Restart
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary text-sm py-1.5 px-3" disabled={busy === server.id} onClick={() => handleAction(server, "start")}>
                    <Play className="w-3.5 h-3.5" /> Start
                  </button>
                )}
                <button className="btn btn-ghost text-sm py-1.5 px-3 ml-auto" onClick={() => setConfirmDelete(server)}>
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateServerModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refresh(); }} />
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Server"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This will remove all files and cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function CreateServerModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { show } = useToast();
  const [name, setName] = useState("");
  const [port, setPort] = useState("25565");
  const [memoryMb, setMemoryMb] = useState("2048");
  const [maxPlayers, setMaxPlayers] = useState("20");
  const [javaVersion, setJavaVersion] = useState("21");
  const [gameVersion, setGameVersion] = useState("");
  const [loader, setLoader] = useState("vanilla");
  const [runtime, setRuntime] = useState("local");
  const [autoStart, setAutoStart] = useState(false);
  const [autoDownloadJar, setAutoDownloadJar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mcVersions, setMcVersions] = useState<string[]>([]);

  useEffect(() => {
    if (open && mcVersions.length === 0) {
      api.getMinecraftVersions().then((r) => setMcVersions(r.versions)).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createServer({ name, port, memoryMb, maxPlayers, javaVersion, gameVersion, loader, runtime, autoStart, autoDownloadJar });
      show(autoDownloadJar && gameVersion ? "Server created, downloading JAR..." : "Server created", "success");
      setName(""); setPort("25565"); setMemoryMb("2048"); setGameVersion(""); setAutoStart(false); setAutoDownloadJar(true);
      onCreated();
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="Create New Server" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Server Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-server" pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}" required />
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Server Type</label>
            <select className="input" value={loader} onChange={(e) => setLoader(e.target.value)}>
              {SERVER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Minecraft Version</label>
            <select className="input" value={gameVersion} onChange={(e) => setGameVersion(e.target.value)}>
              <option value="">Select version...</option>
              {mcVersions.length > 0 ? (
                mcVersions.filter((v) => !v.includes("w_") && !v.includes("experiment") && !v.includes("rc") && !v.includes("pre") && !v.includes("beta")).slice(0, 100).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))
              ) : (
                <option value="" disabled>Loading versions...</option>
              )}
            </select>
          </div>
          <div>
            <label className="label">Runtime</label>
            <select className="input" value={runtime} onChange={(e) => setRuntime(e.target.value)}>
              <option value="local">Local Process</option>
              <option value="docker">Docker Container</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={autoDownloadJar} onChange={(e) => setAutoDownloadJar(e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-az-600 focus:ring-az-500" disabled={!gameVersion} />
          <span className="flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Auto-download server JAR {gameVersion ? `(${loader} ${gameVersion})` : "(select version first)"}
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-az-600 focus:ring-az-500" />
          Auto-start when panel starts
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus className="w-4 h-4" /> Create</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}
