import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "./api";

interface ThemeSettings {
  panelName: string;
  themeColor: string;
  logoUrl: string;
  bgUrl: string;
}

interface ThemeContextValue extends ThemeSettings {
  refresh: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m || m.length < 3) return { r: 139, g: 92, b: 246 };
  return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
}

function mix(hex: string, targetR: number, targetG: number, targetB: number, weight: number): string {
  const { r, g, b } = hexToRgb(hex);
  const nr = Math.round(r * (1 - weight) + targetR * weight);
  const ng = Math.round(g * (1 - weight) + targetG * weight);
  const nb = Math.round(b * (1 - weight) + targetB * weight);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amount: number): string {
  return mix(hex, 255, 255, 255, amount);
}

function darken(hex: string, amount: number): string {
  return mix(hex, 0, 0, 0, amount);
}

export function applyThemeColor(hex: string): void {
  const root = document.documentElement;
  root.style.setProperty("--az-50", lighten(hex, 0.92));
  root.style.setProperty("--az-100", lighten(hex, 0.85));
  root.style.setProperty("--az-200", lighten(hex, 0.7));
  root.style.setProperty("--az-300", lighten(hex, 0.5));
  root.style.setProperty("--az-400", lighten(hex, 0.3));
  root.style.setProperty("--az-500", hex);
  root.style.setProperty("--az-600", darken(hex, 0.1));
  root.style.setProperty("--az-700", darken(hex, 0.2));
  root.style.setProperty("--az-800", darken(hex, 0.35));
  root.style.setProperty("--az-900", darken(hex, 0.5));
  root.style.setProperty("--az-950", darken(hex, 0.65));
  // Neon glow variables
  const { r, g, b } = hexToRgb(hex);
  root.style.setProperty("--az-glow", `${r}, ${g}, ${b}`);
  root.style.setProperty("--az-glow-strong", `${r}, ${g}, ${b}`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>({
    panelName: "AZ PANEL",
    themeColor: "#bf00ff",
    logoUrl: "",
    bgUrl: "",
  });

  const refresh = useCallback(async () => {
    try {
      const res = await api.getSettings();
      const s = res.settings;
      setSettings({
        panelName: s.panel_name || "AZ PANEL",
        themeColor: s.theme_color || "#bf00ff",
        logoUrl: s.logo_url || "",
        bgUrl: s.bg_url || "",
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    applyThemeColor(settings.themeColor);
  }, [settings.themeColor]);

  return (
    <ThemeContext.Provider value={{ ...settings, refresh }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
