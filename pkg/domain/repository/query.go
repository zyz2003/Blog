/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-21 19:42:38
 * @LastEditTime: 2025-06-21 19:42:46
 * @LastEditors: 安知鱼
 */
package repository

// PageQuery 包含了所有列表查询都通用的分页参数。
// 任何需要分页的查询选项结构体都可以嵌入它。
type PageQuery struct {
	Page     int `form:"page" json:"page"`
	PageSize int `form:"pageSize" json:"pageSize"`
}

// PageResult 包含了所有分页查询返回的通用结构。
// T 代表返回的实体类型列表，可以是 []*model.User, []*model.Album 等。
type PageResult[T any] struct {
	Items []*T  `json:"items"`
	Total int64 `json:"total"`
}
