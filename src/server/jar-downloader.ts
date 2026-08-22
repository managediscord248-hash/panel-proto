import fs from "node:fs";
import path from "node:path";
import { serverDir } from "./paths.js";

export type ServerType = "vanilla" | "paper" | "purpur" | "spigot" | "fabric" | "forge" | "neoforge";

export const SERVER_TYPES: { value: ServerType; label: string; needsModsDir: boolean }[] = [
  { value: "vanilla", label: "Vanilla", needsModsDir: false },
  { value: "paper", label: "Paper", needsModsDir: false },
  { value: "purpur", label: "Purpur", needsModsDir: false },
  { value: "spigot", label: "Spigot", needsModsDir: false },
  { value: "fabric", label: "Fabric", needsModsDir: true },
  { value: "forge", label: "Forge", needsModsDir: true },
  { value: "neoforge", label: "NeoForge", needsModsDir: true },
];

const UA = "AZ-PANEL/1.0 (panel@localhost)";

async function fetchJson(url: string, timeout = 15000): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`Download failed: ${res.status} for ${url}`);
  return res.json();
}

async function downloadFile(url: string, target: string, timeout = 120000): Promise<number> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`Download failed: ${res.status} for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(target, buffer);
  return buffer.length;
}

/** Download a Vanilla Minecraft server jar from Mojang's official manifest */
async function downloadVanilla(gameVersion: string, dir: string): Promise<string> {
  const manifest = await fetchJson("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
  let versionData = manifest.versions.find((v: any) => v.id === gameVersion);
  if (!versionData) {
    // Try partial match (e.g. "1.21" matches "1.21")
    versionData = manifest.versions.find((v: any) => v.id === gameVersion || v.id.startsWith(gameVersion));
  }
  if (!versionData) throw new Error(`Minecraft version ${gameVersion} not found`);

  const versionInfo = await fetchJson(versionData.url);
  const serverUrl = versionInfo?.downloads?.server?.url;
  if (!serverUrl) throw new Error(`No server jar available for ${gameVersion}`);

  const target = path.join(dir, "server.jar");
  await downloadFile(serverUrl, target);
  return "server.jar";
}

/** Download a Paper server jar from PaperMC API */
async function downloadPaper(gameVersion: string, dir: string): Promise<string> {
  const builds = await fetchJson(`https://api.papermc.io/v2/projects/paper/versions/${gameVersion}/builds`);
  if (!builds.builds || builds.builds.length === 0) throw new Error(`No Paper builds for ${gameVersion}`);

  const latest = builds.builds.filter((b: any) => b.downloads?.application).pop();
  if (!latest) throw new Error(`No downloadable Paper build for ${gameVersion}`);

  const buildNum = latest.build;
  const fileName = latest.downloads.application.name;
  const url = `https://api.papermc.io/v2/projects/paper/versions/${gameVersion}/builds/${buildNum}/downloads/${fileName}`;
  const target = path.join(dir, "server.jar");
  await downloadFile(url, target);
  return "server.jar";
}

/** Download a Purpur server jar from Purpur API */
async function downloadPurpur(gameVersion: string, dir: string): Promise<string> {
  const builds = await fetchJson(`https://api.purpurmc.org/v2/purpur/${gameVersion}`);
  if (!builds.builds || builds.builds.latest === "") throw new Error(`No Purpur builds for ${gameVersion}`);

  const buildNum = builds.builds.latest;
  const url = `https://api.purpurmc.org/v2/purpur/${gameVersion}/${buildNum}/download`;
  const target = path.join(dir, "server.jar");
  await downloadFile(url, target);
  return "server.jar";
}

/** Download a Spigot server jar from Spiget API (Spigot builds) */
async function downloadSpigot(gameVersion: string, dir: string): Promise<string> {
  // Spigot doesn't have an official direct download API for the jar.
  // Use the Spiget API to find the version, then download from GetBukkit mirror.
  const res = await fetchJson(`https://api.spiget.org/v2/resources/spigot/versions/${gameVersion}`);
  // Spigot jars are hosted at https://download.getbukkit.org/spigot/spigot-<version>.jar
  const url = `https://download.getbukkit.org/spigot/spigot-${gameVersion}.jar`;
  const target = path.join(dir, "server.jar");
  await downloadFile(url, target);
  return "server.jar";
}

/** Download a Fabric server jar using Fabric's meta API */
async function downloadFabric(gameVersion: string, dir: string): Promise<string> {
  // Get loader version
  const loaders = await fetchJson("https://meta.fabricmc.net/v2/versions/loader");
  const loader = loaders.find((l: any) => l.stable) || loaders[0];
  if (!loader) throw new Error("No Fabric loader found");

  // Get installer version
  const installers = await fetchJson("https://meta.fabricmc.net/v2/versions/installer");
  const installer = installers.find((i: any) => i.stable) || installers[0];
  if (!installer) throw new Error("No Fabric installer found");

  const loaderVer = loader.version;
  const installerVer = installer.version;
  const url = `https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVer}/${installerVer}/server/jar`;
  const target = path.join(dir, "server.jar");
  await downloadFile(url, target);
  return "server.jar";
}

/** Download a Forge server jar using Forge's Maven-style API */
async function downloadForge(gameVersion: string, dir: string): Promise<string> {
  const promotions = await fetchJson("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json");
  // Find the latest recommended or latest build for this game version
  let forgeVersion: string | null = null;
  for (const [key, val] of Object.entries(promotions.promos || {})) {
    if (key.startsWith(`${gameVersion}-`) && key.endsWith("-recommended")) {
      forgeVersion = (val as any).version;
      break;
    }
  }
  if (!forgeVersion) {
    for (const [key, val] of Object.entries(promotions.promos || {})) {
      if (key.startsWith(`${gameVersion}-`) && key.endsWith("-latest")) {
        forgeVersion = (val as any).version;
        break;
      }
    }
  }
  if (!forgeVersion) throw new Error(`No Forge build for ${gameVersion}`);

  const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${gameVersion}-${forgeVersion}/forge-${gameVersion}-${forgeVersion}-installer.jar`;
  const target = path.join(dir, "server.jar");
  await downloadFile(url, target);
  return "server.jar";
}

/** Download a NeoForge server jar using NeoForge's API */
async function downloadNeoForge(gameVersion: string, dir: string): Promise<string> {
  // NeoForge uses its own versioning - map game version to NeoForge build
  // API: https://maven.neoforged.net/releases/net/neoforged/neoforge/
  // For newer MC versions, NeoForge uses versions like "21.0.1" for MC 1.21
  // Use the NeoForge maven metadata to find builds
  const versions = await fetchJson("https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml", 15000).catch(() => null);
  
  // The XML parsing approach - find the latest version matching the game version
  // NeoForge version mapping: MC 1.20.4 -> 20.4.x, MC 1.21 -> 21.x.x
  let neoforgeVersion: string | null = null;
  
  // Try the NeoForge API for build list
  try {
    const builds = await fetchJson(`https://api.neoforged.net/v1/neoforge/versions`);
    if (builds?.versions) {
      // Find a build matching our game version
      const match = builds.versions.find((v: any) => v.mcVersion === gameVersion);
      if (match) {
        neoforgeVersion = match.version;
      }
    }
  } catch {}

  if (!neoforgeVersion) {
    // Fallback: try maven metadata XML parsing
    if (versions && typeof versions === "string") {
      const versionMatches = versions.match(/<version>([^<]+)<\/version>/g);
      if (versionMatches) {
        // NeoForge versions for MC 1.21.x start with 21.x
        const majorMatch = gameVersion.match(/^(\d+)\.(\d+)/);
        if (majorMatch) {
          const prefix = `${majorMatch[1]}.${majorMatch[2]}`;
          for (const m of versionMatches) {
            const v = m.replace(/<\/?version>/g, "");
            if (v.startsWith(prefix) && !v.includes("-")) {
              neoforgeVersion = v;
              break;
            }
          }
        }
      }
    }
  }

  if (!neoforgeVersion) throw new Error(`No NeoForge build for ${gameVersion}`);

  const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`;
  const target = path.join(dir, "server.jar");
  await downloadFile(url, target);
  return "server.jar";
}

export async function downloadServerJar(serverType: ServerType, gameVersion: string, serverId: string): Promise<{ filename: string; size: number }> {
  const dir = serverDir(serverId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Create eula.txt
  const eulaPath = path.join(dir, "eula.txt");
  if (!fs.existsSync(eulaPath)) fs.writeFileSync(eulaPath, "eula=true\n");

  // Create mods directory for mod loaders
  if (["fabric", "forge", "neoforge"].includes(serverType)) {
    const modsDir = path.join(dir, "mods");
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
  }

  let filename: string;
  switch (serverType) {
    case "vanilla":
      filename = await downloadVanilla(gameVersion, dir);
      break;
    case "paper":
      filename = await downloadPaper(gameVersion, dir);
      break;
    case "purpur":
      filename = await downloadPurpur(gameVersion, dir);
      break;
    case "spigot":
      filename = await downloadSpigot(gameVersion, dir);
      break;
    case "fabric":
      filename = await downloadFabric(gameVersion, dir);
      break;
    case "forge":
      filename = await downloadForge(gameVersion, dir);
      break;
    case "neoforge":
      filename = await downloadNeoForge(gameVersion, dir);
      break;
    default:
      throw new Error(`Unsupported server type: ${serverType}`);
  }

  const target = path.join(dir, filename);
  const stat = fs.statSync(target);
  return { filename, size: stat.size };
}

/** Get available Minecraft versions from Mojang */
export async function getMinecraftVersions(): Promise<string[]> {
  const manifest = await fetchJson("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
  return manifest.versions.map((v: any) => v.id);
}
