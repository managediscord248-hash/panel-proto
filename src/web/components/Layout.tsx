import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth-context";
import { useTheme } from "../theme-context";
import {
  LayoutDashboard, Server, Users, Settings, ScrollText, LogOut, Menu, X, Zap, Network
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../api";
import { FuturisticBackground } from "./FuturisticBackground";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "admin", "user"] },
  { to: "/servers", label: "Servers", icon: Server, roles: ["owner", "admin", "user"] },
  { to: "/users", label: "Users", icon: Users, roles: ["owner", "admin"] },
  { to: "/nodes", label: "Nodes", icon: Network, roles: ["owner", "admin"] },
  { to: "/audit", label: "Audit Log", icon: ScrollText, roles: ["owner", "admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["owner"] },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { panelName, logoUrl, refresh } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return null;
  const items = navItems.filter((item) => item.roles.includes(user.role));

  const logoEl = logoUrl ? (
    <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-cover" />
  ) : (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
      background: "linear-gradient(135deg, var(--az-500), var(--az-700))",
      boxShadow: "0 0 15px rgba(var(--az-glow), 0.3)",
    }}>
      <Zap className="w-5 h-5 text-white" fill="white" />
    </div>
  );

  return (
    <div className="min-h-screen flex relative">
      <FuturisticBackground />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass border-r border-slate-800/80 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ background: "rgba(8, 10, 20, 0.8)" }}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            {logoEl}
            <div>
              <h1 className="font-bold text-slate-100 text-lg leading-none neon-text" style={{ color: "var(--az-300)" }}>{panelName}</h1>
              <p className="text-xs text-slate-500 mt-0.5">Control Panel</p>
            </div>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-slate-200"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-az-300 border"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      background: "rgba(var(--az-glow), 0.1)",
                      borderColor: "rgba(var(--az-glow), 0.2)",
                      boxShadow: "0 0 12px rgba(var(--az-glow), 0.1)",
                    }
                  : undefined
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800/80">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/30">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{
              background: "linear-gradient(135deg, var(--az-500), var(--az-700))",
              boxShadow: "0 0 10px rgba(var(--az-glow), 0.2)",
            }}>
              {user.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user.username}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="lg:hidden glass border-b border-slate-800/80 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-300 hover:text-slate-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-slate-100 neon-text" style={{ color: "var(--az-300)" }}>{panelName}</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
