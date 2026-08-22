import { useEffect, useState } from "react";
import { api } from "../api";
import { StatCard, ProgressBar, StatusBadge, formatBytes, formatUptime } from "../components/ui";
import { useAuth } from "../auth-context";
import { Link } from "react-router-dom";
import { Server, Cpu, HardDrive, MemoryStick, Activity, Users as UsersIcon, Zap, Shield, Network, Monitor, Lock, Gamepad2, Terminal, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";
import type { Server as ServerType, SystemStats } from "../types";

export function Dashboard() {
  const { user } = useAuth();
  const [servers, setServers] = useState<ServerType[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    Promise.all([
      api.getServers().then((r) => setServers(r.servers)).catch(() => {}),
      isAdmin ? api.getStats().then((r) => setStats(r.stats)).catch(() => {}) : Promise.resolve(),
      isAdmin ? api.getUsers().then((r) => setUserCount(r.users.length)).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoading(false));

    if (isAdmin) {
      const interval = setInterval(() => {
        api.getStats().then((r) => setStats(r.stats)).catch(() => {});
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-az-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const running = servers.filter((s) => s.current_status === "running").length;

  return (
    <div className="space-y-6">
      {/* Hero / Introduction */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{
          background: "radial-gradient(circle, var(--az-500), transparent 70%)",
        }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
              background: "linear-gradient(135deg, var(--az-500), var(--az-700))",
              boxShadow: "0 0 25px rgba(var(--az-glow), 0.3)",
            }}>
              <Zap className="w-6 h-6 text-white" fill="white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold neon-text" style={{ color: "var(--az-300)" }}>AZ Panel V1</h1>
              <p className="text-slate-500 text-sm">Minecraft Server Management Panel</p>
            </div>
          </div>
          <p className="text-slate-400 max-w-2xl">
            Welcome back, <span className="text-slate-200 font-medium">{user?.username}</span>. AZ Panel V1 is a self-hosted
            control panel for managing Minecraft servers with real-time monitoring, file management, mod installation,
            backup tools, and multi-user access control.
          </p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Your Servers" value={servers.length} sublabel={`${running} running`} icon={<Server className="w-5 h-5" />} delay={0} />
        {isAdmin && (
          <StatCard label="Users" value={userCount} icon={<UsersIcon className="w-5 h-5" />} color="emerald" delay={0.05} />
        )}
        {isAdmin && stats && (
          <StatCard label="CPU Usage" value={`${stats.cpuUsage.toFixed(1)}%`} sublabel={`${stats.cpuCores} cores`} icon={<Cpu className="w-5 h-5" />} color="amber" delay={0.1} />
        )}
        {isAdmin && stats && (
          <StatCard label="Uptime" value={formatUptime(stats.uptime)} sublabel={stats.hostname} icon={<Activity className="w-5 h-5" />} color="slate" delay={0.15} />
        )}
      </div>

      {/* System Resources - Admin only */}
      {isAdmin && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-amber-400" />
                <span className="font-medium text-slate-200">CPU</span>
              </div>
              <span className="text-sm text-slate-400">{stats.cpuUsage.toFixed(1)}%</span>
            </div>
            <ProgressBar value={stats.cpuUsage} color="amber" />
            <p className="text-xs text-slate-500 mt-2">Load: {stats.loadAvg.map((l) => l.toFixed(2)).join(", ")}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MemoryStick className="w-5 h-5" style={{ color: "var(--az-400)" }} />
                <span className="font-medium text-slate-200">Memory</span>
              </div>
              <span className="text-sm text-slate-400">{stats.memUsagePercent.toFixed(1)}%</span>
            </div>
            <ProgressBar value={stats.memUsagePercent} color="az" />
            <p className="text-xs text-slate-500 mt-2">{formatBytes(stats.memUsed)} / {formatBytes(stats.memTotal)}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-emerald-400" />
                <span className="font-medium text-slate-200">Disk</span>
              </div>
              <span className="text-sm text-slate-400">{stats.diskUsagePercent.toFixed(1)}%</span>
            </div>
            <ProgressBar value={stats.diskUsagePercent} color="emerald" />
            <p className="text-xs text-slate-500 mt-2">{formatBytes(stats.diskUsed)} / {formatBytes(stats.diskTotal)}</p>
          </div>
        </div>
      )}

      {/* Key Features */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Key Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Server, title: "Server Management", desc: "Create, start, stop, and configure Minecraft servers with full control." },
            { icon: Terminal, title: "Live Console", desc: "Real-time console output with command input and streaming logs." },
            { icon: FolderOpen, title: "File Manager", desc: "Browse, edit, upload, and manage server files directly from the panel." },
            { icon: Gamepad2, title: "Mod Support", desc: "Install mods from Modrinth with automatic version matching." },
            { icon: Shield, title: "Backup & Restore", desc: "Create and restore server backups to keep your worlds safe." },
            { icon: Lock, title: "Access Control", desc: "Role-based permissions with per-server user assignments." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="card card-hover p-5"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{
                background: "rgba(var(--az-glow), 0.1)",
              }}>
                <f.icon className="w-5 h-5" style={{ color: "var(--az-400)" }} />
              </div>
              <h3 className="font-semibold text-slate-100 mb-1">{f.title}</h3>
              <p className="text-sm text-slate-500">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Supported Server Types */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Supported Server Types</h2>
        <div className="card p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: "Vanilla", desc: "Official Minecraft" },
              { name: "Paper", desc: "High performance" },
              { name: "Forge", desc: "Mod loader" },
              { name: "Fabric", desc: "Lightweight mods" },
            ].map((t) => (
              <div key={t.name} className="text-center p-3 rounded-lg" style={{
                background: "rgba(var(--az-glow), 0.05)",
                border: "1px solid rgba(var(--az-glow), 0.1)",
              }}>
                <p className="font-medium text-slate-200 text-sm">{t.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4 text-center">
            Supports multiple Minecraft versions with automatic JAR downloads
          </p>
        </div>
      </div>

      {/* Node Management Info - Admin only */}
      {isAdmin && (
        <div>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Node Management</h2>
          <div className="card p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                background: "rgba(var(--az-glow), 0.1)",
              }}>
                <Network className="w-5 h-5" style={{ color: "var(--az-400)" }} />
              </div>
              <div>
                <p className="text-slate-300 text-sm">
                  AZ Panel V1 supports multi-node architecture. The <span className="badge badge-blue ml-1">[LOCAL]</span> node
                  runs on this machine and is always available. Add <span className="badge badge-slate ml-1">[REMOTE]</span> nodes
                  to manage servers across multiple machines.
                </p>
                <Link to="/nodes" className="text-sm mt-2 inline-flex items-center gap-1" style={{ color: "var(--az-400)" }}>
                  Manage Nodes →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Info */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Security & Permissions</h2>
        <div className="card p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
              background: "rgba(var(--az-glow), 0.1)",
            }}>
              <Shield className="w-5 h-5" style={{ color: "var(--az-400)" }} />
            </div>
            <div className="text-sm text-slate-400 space-y-1">
              <p><span className="text-slate-200 font-medium">Owner:</span> Full control over all servers, users, nodes, and settings.</p>
              <p><span className="text-slate-200 font-medium">Admin:</span> Manage users, servers, and view system resources.</p>
              <p><span className="text-slate-200 font-medium">User:</span> Access only assigned servers and own profile settings.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access - Your Servers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Your Servers</h2>
          <Link to="/servers" className="text-sm" style={{ color: "var(--az-400)" }}>View all →</Link>
        </div>
        {servers.length === 0 ? (
          <div className="card p-8 text-center">
            <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No servers assigned to you yet</p>
            {isAdmin && (
              <Link to="/servers" className="btn btn-primary mt-4 inline-flex">Create your first server</Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.slice(0, 6).map((server) => (
              <Link
                key={server.id}
                to={`/servers/${server.id}`}
                className="card card-hover p-4 group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-slate-100 group-hover:text-az-300 transition-colors">{server.name}</span>
                  <StatusBadge status={server.current_status} />
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Port: {server.port} · RAM: {server.memory_mb}MB</p>
                  <p>Java {server.java_version} · {server.loader || "vanilla"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* About AZ Panel */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">About AZ Panel</h2>
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
              background: "linear-gradient(135deg, var(--az-500), var(--az-700))",
              boxShadow: "0 0 15px rgba(var(--az-glow), 0.2)",
            }}>
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm text-slate-400 space-y-2">
              <p>
                <span className="text-slate-200 font-medium">AZ Panel V1</span> is a self-hosted Minecraft server management panel
                designed for hosting providers and server administrators. It provides a clean, modern interface for managing
                Minecraft server instances with full lifecycle control.
              </p>
              <p>
                Built with a lightweight Node.js backend and a responsive React frontend, AZ Panel V1 runs efficiently on
                minimal hardware while providing professional-grade server management capabilities.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
