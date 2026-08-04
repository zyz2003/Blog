/**
 * Iconify 离线模式：只预加载项目实际用到的图标子集。
 *
 * 图标数据由 scripts/extract-icons.mjs 扫描源码自动提取（build 前运行），
 * 而非全量导入集合 JSON。12MB 全量 -> ~29KB 精简子集。
 *
 * 在 providers/index.tsx 顶部 import 本文件即可生效（side-effect）。
 */
import { addCollection } from "@iconify/react";
import { ICON_COLLECTIONS } from "@/lib/iconify-data";

for (const collection of ICON_COLLECTIONS) {
  addCollection(collection);
}
