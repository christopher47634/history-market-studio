#!/usr/bin/env node
// 构建后压缩自托管的江山时序脚本（public/atlas 原样拷进 dist，Vite 不处理它们）。
// 这些是普通 <script>，文件之间靠顶层全局变量互相引用，所以只压空白和语法，不改名字。
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { transform } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "dist", "client", "atlas");
let before = 0, after = 0;
for (const file of [...readdirSync(path.join(dir, "js")).map((f) => path.join("js", f)), "embed.js"]) {
  if (!file.endsWith(".js")) continue;
  const full = path.join(dir, file);
  const src = readFileSync(full, "utf8");
  const { code } = await transform(src, { loader: "js", minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false, legalComments: "none", target: "es2020" });
  writeFileSync(full, code);
  before += Buffer.byteLength(src);
  after += Buffer.byteLength(code);
}
console.log(`atlas scripts minified: ${(before / 1048576).toFixed(2)} MB → ${(after / 1048576).toFixed(2)} MB`);
