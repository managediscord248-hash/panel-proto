import { config } from "./config.js";

export interface ModrinthProject {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  project_type: string;
  versions: string[];
  categories: string[];
  server_side: string;
}

export interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: {
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }[];
}

export interface ModrinthSearchResult {
  hits: ModrinthProject[];
  total: number;
  limit: number;
  offset: number;
}

export async function searchModrinth(
  query: string,
  facets: Record<string, string[]> = {},
  limit = 20,
  offset = 0
): Promise<ModrinthSearchResult> {
  const url = new URL("https://api.modrinth.com/v2/search");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("index", "relevance");

  const facetList: string[] = [];
  facetList.push(["project_type:mod"].join(","));
  for (const [key, values] of Object.entries(facets)) {
    if (values.length > 0) {
      facetList.push(values.map((v) => `${key}:${v}`).join(","));
    }
  }
  if (facetList.length > 0) {
    url.searchParams.set("facets", JSON.stringify(facetList.map((f) => [f])));
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "AZ-PANEL/1.0 (panel@localhost)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Modrinth API error: ${res.status}`);
  const data = await res.json();
  return {
    hits: (data.hits || []).map((h: any) => ({
      id: h.project_id,
      slug: h.slug,
      name: h.title,
      description: h.description,
      icon_url: h.icon_url ?? null,
      downloads: h.downloads ?? 0,
      project_type: h.project_type,
      versions: h.versions ?? [],
      categories: h.categories ?? [],
      server_side: h.server_side ?? "unknown",
    })),
    total: data.total_hits ?? 0,
    limit,
    offset,
  };
}

export async function getModrinthProject(slug: string): Promise<ModrinthProject> {
  const res = await fetch(`https://api.modrinth.com/v2/project/${slug}`, {
    headers: { "User-Agent": "AZ-PANEL/1.0 (panel@localhost)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Modrinth API error: ${res.status}`);
  const data = await res.json();
  return {
    id: data.id,
    slug: data.slug,
    name: data.title,
    description: data.description,
    icon_url: data.icon_url ?? null,
    downloads: data.downloads ?? 0,
    project_type: data.project_type,
    versions: data.versions ?? [],
    categories: data.categories ?? [],
    server_side: data.server_side ?? "unknown",
  };
}

export async function getModrinthVersions(projectId: string, gameVersion?: string, loader?: string): Promise<ModrinthVersion[]> {
  const url = new URL(`https://api.modrinth.com/v2/project/${projectId}/version`);
  if (gameVersion) url.searchParams.set("game_versions", JSON.stringify([gameVersion]));
  if (loader) url.searchParams.set("loaders", JSON.stringify([loader]));
  const res = await fetch(url, {
    headers: { "User-Agent": "AZ-PANEL/1.0 (panel@localhost)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Modrinth API error: ${res.status}`);
  const data = await res.json();
  return (data || []).map((v: any) => ({
    id: v.id,
    name: v.name,
    version_number: v.version_number,
    game_versions: v.game_versions ?? [],
    loaders: v.loaders ?? [],
    files: (v.files || []).map((f: any) => ({
      url: f.url,
      filename: f.filename,
      primary: f.primary ?? false,
      size: f.size ?? 0,
    })),
  }));
}

export async function downloadMod(serverId: string, versionId: string, fileUrl: string, filename: string, modsDir: string): Promise<{ size: number }> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { safeServerPath } = await import("./paths.js");

  const dir = safeServerPath(serverId, modsDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const target = path.join(dir, filename);
  const res = await fetch(fileUrl, {
    headers: { "User-Agent": "AZ-PANEL/1.0 (panel@localhost)" },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(target, buffer);
  return { size: buffer.length };
}
