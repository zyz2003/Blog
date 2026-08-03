/**
 * Iconify 离线模式：预加载本项目用到的图标集到本地，
 * 不再从 api.unisvg.com 在线拉取（国内经常超时）。
 *
 * 在 providers/index.tsx 顶部 import 本文件即可生效（side-effect）。
 */
import { addCollection } from "@iconify/react";
import ri from "@iconify/json/json/ri.json";
import fa6Solid from "@iconify/json/json/fa6-solid.json";
import fa6Regular from "@iconify/json/json/fa6-regular.json";
import fa6Brands from "@iconify/json/json/fa6-brands.json";
import solar from "@iconify/json/json/solar.json";
import tabler from "@iconify/json/json/tabler.json";
import iconamoon from "@iconify/json/json/iconamoon.json";

addCollection(ri as any);
addCollection(fa6Solid as any);
addCollection(fa6Regular as any);
addCollection(fa6Brands as any);
addCollection(solar as any);
addCollection(tabler as any);
addCollection(iconamoon as any);
