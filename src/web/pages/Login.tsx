import { useState, useEffect } from "react";
import { useAuth } from "../auth-context";
import { useTheme } from "../theme-context";
import { useToast } from "../components/Toast";
import { api } from "../api";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Lock, User, Mail, UserPlus, LogIn } from "lucide-react";

export function Login() {
  const { login, register } = useAuth();
  const { panelName, logoUrl, bgUrl } = useTheme();
  const { show } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  useEffect(() => {
    api.getRegistrationEnabled().then((r) => setRegistrationEnabled(r.enabled)).catch(() => setRegistrationEnabled(true));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      show("Welcome back!", "success");
    } catch (err: any) {
      show(err.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      show("Passwords do not match", "error");
      return;
    }
    if (password.length < 8) {
      show("Password must be at least 8 characters", "error");
      return;
    }
    setLoading(true);
    try {
      await register(username, password, email || undefined);
      show("Account created! Welcome.", "success");
    } catch (err: any) {
      show(err.message || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const bgStyle = bgUrl
    ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : {};

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden" style={bgStyle}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-az-950/30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-az-600/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4 shadow-xl" />
          ) : (
            <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-az-500 to-az-700 items-center justify-center shadow-xl shadow-az-600/30 mb-4">
              <Zap className="w-8 h-8 text-white" fill="white" />
            </div>
          )}
          <h1 className="text-3xl font-bold gradient-text">{panelName}</h1>
          <p className="text-slate-500 mt-2">
            {mode === "login" ? "Sign in to your control panel" : "Create a new account"}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 p-1 bg-slate-900/60 rounded-lg mb-4 border border-slate-800">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
              mode === "login"
                ? "bg-az-600 text-white shadow-lg shadow-az-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LogIn className="w-4 h-4" /> Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            disabled={!registrationEnabled}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              mode === "register"
                ? "bg-az-600 text-white shadow-lg shadow-az-600/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title={registrationEnabled ? "Create a new account" : "Registration is disabled by the administrator"}
          >
            <UserPlus className="w-4 h-4" /> Sign Up
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleLogin}
              className="card bg-slate-900/80 p-8 space-y-5"
            >
              <div>
                <label className="label">Username or Email</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    className="input pl-10"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username or email"
                    autoFocus
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    className="input pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Sign In"
                )}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleRegister}
              className="card bg-slate-900/80 p-8 space-y-5"
            >
              <div>
                <label className="label">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    className="input pl-10"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="3-32 chars, letters/numbers/_"
                    pattern="[a-zA-Z0-9_]{3,32}"
                    title="3-32 characters: letters, numbers, underscore"
                    autoFocus
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Email (optional)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    className="input pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    className="input pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    className="input pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Create Account"
                )}
              </button>
              <p className="text-xs text-slate-500 text-center">
                New accounts get &quot;user&quot; role by default.
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
