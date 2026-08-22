import esbuild from "esbuild";
import path from "node:path";
import fs from "node:fs";

const outDir = path.resolve(process.cwd(), "dist");
fs.mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.resolve("src/server/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  outfile: path.join(outDir, "server.cjs"),
  sourcemap: false,
  minify: false,
  external: ["better-sqlite3"],
  logLevel: "info",
});

console.log("Server built to dist/server.cjs");
