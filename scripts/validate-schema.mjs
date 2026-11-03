// 校验 data/v2/client/*.json 的字段结构与评分口径（规则见 src/v2/clientSchema.js、docs/MEASUREMENT.md）。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateClientFigures } from "../src/v2/clientSchema.js";

const dir = new URL("../data/v2/client/", import.meta.url);
const files = readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
const figures = files.map((file) => {
  const figure = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
  if (`${figure.id}.json` !== file) console.error(`error ${join("data/v2/client", file)}: 文件名与 id "${figure.id}" 不一致`);
  return figure;
});
const mismatched = figures.filter((figure, i) => `${figure.id}.json` !== files[i]).length;

const { errors, warnings } = validateClientFigures(figures);
const verbose = process.argv.includes("--verbose");
warnings.slice(0, verbose ? Infinity : 20).forEach((w) => console.warn(`warn  ${w}`));
if (!verbose && warnings.length > 20) console.warn(`warn  ……另有 ${warnings.length - 20} 条，加 --verbose 查看`);
errors.forEach((e) => console.error(`error ${e}`));
console.log(`schema: ${figures.length} 位人物，${errors.length + mismatched} 个错误，${warnings.length} 个提醒`);
if (errors.length || mismatched) process.exit(1);
