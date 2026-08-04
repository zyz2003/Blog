/**
 * 扫描 frontend/src 下所有 .tsx/.ts，提取用到的 Iconify 图标引用，
 * 用 @iconify/utils 的 getIcons() 从完整集合中只提取这些图标，
 * 输出精简数据到 frontend/src/lib/iconify-data.ts。
 *
 * 运行：node scripts/extract-icons.mjs
 * 在 next build 前执行（package.json prebuild）。
 *
 * 12MB 全量 -> ~50KB 精简子集，大幅降低客户端 bundle 与 hydration 时间。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";

const ROOT = process.cwd();
// 脚本可能从项目根目录或 frontend/ 目录运行（prebuild）。
// 若 cwd 下有 src/ 则 cwd 即 frontend；否则 cwd/frontend。
const FRONTEND = existsSync(join(ROOT, "src")) ? ROOT : join(ROOT, "frontend");
const SRC = join(FRONTEND, "src");
const OUT = join(SRC, "lib", "iconify-data.ts");

// @iconify/utils 装在 frontend/node_modules，从 frontend 目录用 createRequire 解析
const require = createRequire(join(FRONTEND, "package.json"));
const { getIcons } = require("@iconify/utils");

// 扫描 icon="prefix:name" / icon='prefix:name' / icon={`prefix:name`}
const ICON_RE = /icon\s*=\s*[{"'`]\s*([a-z0-9-]+:[a-z0-9-]+)/gi;

/** 递归收集 src 下所有 .ts/.tsx 文件路径 */
function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectFiles(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

/** 扫描所有文件，收集 { prefix: Set<name> } */
function scanUsedIcons() {
  const used = new Map(); // prefix -> Set<name>
  const files = collectFiles(SRC);
  let total = 0;

  for (const file of files) {
    const code = readFileSync(file, "utf8");
    let m;
    while ((m = ICON_RE.exec(code)) !== null) {
      const [prefix, name] = m[1].split(":");
      if (!prefix || !name) continue;
      if (!used.has(prefix)) used.set(prefix, new Set());
      used.get(prefix).add(name);
      total++;
    }
  }

  console.log(`[extract-icons] 扫描 ${files.length} 文件，发现 ${total} 处图标引用，${used.size} 个集合`);
  return used;
}

/** 从 @iconify/json 加载某个集合的完整 JSON */
function loadCollection(prefix) {
  const candidates = [
    join(FRONTEND, "node_modules", "@iconify", "json", "json", `${prefix}.json`),
    join(ROOT, "node_modules", "@iconify", "json", "json", `${prefix}.json`),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, "utf8"));
    }
  }
  return null;
}

function main() {
  const used = scanUsedIcons();
  const collections = [];

  for (const [prefix, names] of used) {
    const full = loadCollection(prefix);
    if (!full) {
      console.warn(`[extract-icons] ⚠️  集合 "${prefix}" 未找到 (@iconify/json)，跳过`);
      continue;
    }
    const nameArr = [...names];
    const subset = getIcons(full, nameArr);
    if (!subset) {
      console.warn(`[extract-icons] ⚠️  集合 "${prefix}" 提取失败`);
      continue;
    }
    collections.push(subset);
    console.log(`[extract-icons] ✓ ${prefix}: ${nameArr.length}/${Object.keys(full.icons).length} 图标`);
  }

  const code = `// 自动生成，勿手动编辑。由 scripts/extract-icons.mjs 从源码图标引用提取。
// 全量 12MB -> 精简子集，只含实际用到的图标。
import type { IconifyJSON } from "@iconify/react";

export const ICON_COLLECTIONS: IconifyJSON[] = ${JSON.stringify(collections, null, 0)};
`;

  writeFileSync(OUT, code, "utf8");
  const sizeKB = Math.round(Buffer.byteLength(code, "utf8") / 1024);
  console.log(`[extract-icons] 写出 ${OUT} (${sizeKB} KB)`);
}

main();
