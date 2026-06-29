/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-26 16:57:56
 * @LastEditTime: 2025-07-03 00:54:15
 * @LastEditors: 安知鱼
 */
// in: internal/app/service/query/helpers.go
package query

import (
	"sort"
	"strconv"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// ApplySorting 对文件列表进行排序
func ApplySorting(files []*model.File, query map[string][]string) []*model.File {
	orderBy := "updated_at" // 默认按更新时间排序
	if len(query["order"]) > 0 {
		orderBy = query["order"][0]
	}
	direction := "desc"
	if len(query["direction"]) > 0 && strings.ToLower(query["direction"][0]) == "asc" {
		direction = "asc"
	}

	sort.Slice(files, func(i, j int) bool {
		// 目录优先显示
		if files[i].Type != files[j].Type {
			return files[i].Type > files[j].Type
		}
		var less bool
		switch orderBy {
		case "name":
			less = strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
		case "size":
			less = files[i].Size < files[j].Size
		case "created_at":
			less = files[i].CreatedAt.Before(files[j].CreatedAt)
		default: // 默认按 updated_at
			less = files[i].UpdatedAt.Before(files[j].UpdatedAt)
		}
		if direction == "desc" {
			return !less
		}
		return less
	})
	return files
}

// ApplyQueryFilters 根据查询参数过滤文件列表
func ApplyQueryFilters(files []*model.File, query map[string][]string) []*model.File {
	if len(query["type"]) == 0 && len(query["name"]) == 0 {
		return files
	}
	var filtered []*model.File
	for _, file := range files {
		keep := true
		if len(query["type"]) > 0 && file.Type.String() != query["type"][0] {
			keep = false
		}
		if keep && len(query["name"]) > 0 && !strings.Contains(strings.ToLower(file.Name), strings.ToLower(query["name"][0])) {
			keep = false
		}
		if keep {
			filtered = append(filtered, file)
		}
	}
	return filtered
}

// GetPaginationParams 从查询参数中解析分页信息
func GetPaginationParams(query map[string][]string) (page, pageSize int) {
	page, pageSize = 1, 100 // 默认值
	if len(query["page"]) > 0 {
		if p, err := strconv.Atoi(query["page"][0]); err == nil && p > 0 {
			page = p
		}
	}
	if len(query["page_size"]) > 0 {
		if ps, err := strconv.Atoi(query["page_size"][0]); err == nil && ps > 0 {
			pageSize = ps
		}
	}
	return
}

// ApplyPagination 对文件列表进行内存分页
func ApplyPagination(files []*model.File, page, pageSize int) []*model.File {
	start := (page - 1) * pageSize
	if start >= len(files) {
		return []*model.File{}
	}
	end := start + pageSize
	if end > len(files) {
		end = len(files)
	}
	return files[start:end]
}
