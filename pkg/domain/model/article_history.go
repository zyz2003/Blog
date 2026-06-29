/*
 * @Description: 文章历史版本领域模型
 * @Author: 安知鱼
 * @Date: 2026-01-13
 */
package model

import "time"

// ArticleHistory 文章历史版本领域模型
type ArticleHistory struct {
	ID             string                 `json:"id"`
	ArticleID      string                 `json:"article_id"`
	Version        int                    `json:"version"`
	Title          string                 `json:"title"`
	ContentMd      string                 `json:"content_md,omitempty"`
	ContentHTML    string                 `json:"content_html,omitempty"`
	CoverURL       string                 `json:"cover_url"`
	TopImgURL      string                 `json:"top_img_url"`
	PrimaryColor   string                 `json:"primary_color"`
	Summaries      []string               `json:"summaries"`
	WordCount      int                    `json:"word_count"`
	Keywords       string                 `json:"keywords"`
	EditorID       uint                   `json:"editor_id"`
	EditorNickname string                 `json:"editor_nickname"`
	ChangeNote     string                 `json:"change_note"`
	CreatedAt      time.Time              `json:"created_at"`
	ExtraData      map[string]interface{} `json:"extra_data,omitempty"`
}

// ArticleHistoryListItem 历史版本列表项（不含完整内容）
type ArticleHistoryListItem struct {
	ID             string    `json:"id"`
	Version        int       `json:"version"`
	Title          string    `json:"title"`
	WordCount      int       `json:"word_count"`
	EditorNickname string    `json:"editor_nickname"`
	ChangeNote     string    `json:"change_note"`
	CreatedAt      time.Time `json:"created_at"`
}

// ArticleHistoryListResponse 历史版本列表响应
type ArticleHistoryListResponse struct {
	List     []ArticleHistoryListItem `json:"list"`
	Total    int64                    `json:"total"`
	Page     int                      `json:"page"`
	PageSize int                      `json:"page_size"`
}

// CreateArticleHistoryParams 创建历史版本参数
type CreateArticleHistoryParams struct {
	ArticleDBID    uint
	Version        int
	Title          string
	ContentMd      string
	ContentHTML    string
	CoverURL       string
	TopImgURL      string
	PrimaryColor   string
	Summaries      []string
	WordCount      int
	Keywords       string
	EditorID       uint
	EditorNickname string
	ChangeNote     string
	ExtraData      map[string]interface{}
}

// ArticleHistoryCompareResponse 版本对比响应
type ArticleHistoryCompareResponse struct {
	OldVersion *ArticleHistory `json:"old_version"`
	NewVersion *ArticleHistory `json:"new_version"`
}

// RestoreHistoryRequest 恢复历史版本请求
type RestoreHistoryRequest struct {
	ChangeNote string `json:"change_note"` // 恢复操作的变更说明
}

// ArticleHistoryCountResponse 历史版本数量响应
type ArticleHistoryCountResponse struct {
	Count int `json:"count"`
}
