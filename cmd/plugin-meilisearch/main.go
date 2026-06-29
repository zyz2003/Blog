/*
 * @Description: Meilisearch 搜索插件入口 - 编译为独立二进制，放入 data/plugins/ 目录即可热加载
 * @Author: 安知鱼
 * @Date: 2026-04-09
 *
 * 编译方式: go build -o anheyu-plugin-meilisearch ./cmd/plugin-meilisearch
 * 使用方式: 将编译产物放到主程序的 data/plugins/ 目录下，主程序启动时自动发现并加载
 *
 * 环境变量:
 *   ANHEYU_MEILISEARCH_HOST    - Meilisearch 服务地址（如 http://localhost:7700）
 *   ANHEYU_MEILISEARCH_API_KEY - Meilisearch API Key（可选）
 */
package main

import (
	meili "github.com/anzhiyu-c/anheyu-app/pkg/plugin/meilisearch"
)

func main() {
	meili.Serve()
}
