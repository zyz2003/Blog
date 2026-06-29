package search

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/meilisearch/meilisearch-go"
)

const (
	meiliIndexName = "articles"
)

// MeiliSearchSearcher 使用 MeiliSearch 实现的搜索器
type MeiliSearchSearcher struct {
	client     meilisearch.ServiceManager
	index      meilisearch.IndexManager
	settingSvc setting.SettingService
}

// meiliDocument MeiliSearch 文档结构（索引写入和搜索读取共用）
type meiliDocument struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Content     string   `json:"content"`
	Author      string   `json:"author"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	CoverURL    string   `json:"cover_url"`
	Abbrlink    string   `json:"abbrlink"`
	ViewCount   int      `json:"view_count"`
	WordCount   int      `json:"word_count"`
	ReadingTime int      `json:"reading_time"`
	IsDoc       bool     `json:"is_doc"`
	DocSeriesID string   `json:"doc_series_id"`
	CreatedAt   int64    `json:"created_at"`
	// 搜索结果中的高亮字段（仅读取时存在）
	Formatted *meiliFormattedFields `json:"_formatted,omitempty"`
}

// meiliFormattedFields MeiliSearch 高亮字段
type meiliFormattedFields struct {
	Content string `json:"content"`
	Title   string `json:"title"`
}

// NewMeiliSearchSearcher 创建 MeiliSearch 搜索器
// host 格式: http://localhost:7700
// apiKey 可为空（开发环境）
func NewMeiliSearchSearcher(host, apiKey string, settingSvc setting.SettingService) (*MeiliSearchSearcher, error) {
	if host == "" {
		return nil, fmt.Errorf("MeiliSearch 地址不能为空")
	}

	client := meilisearch.New(host, meilisearch.WithAPIKey(apiKey))

	// 确保索引存在
	_, err := client.GetIndex(meiliIndexName)
	if err != nil {
		log.Printf("MeiliSearch 索引 '%s' 不存在，创建中...", meiliIndexName)
		taskInfo, createErr := client.CreateIndex(&meilisearch.IndexConfig{
			Uid:        meiliIndexName,
			PrimaryKey: "id",
		})
		if createErr != nil {
			return nil, fmt.Errorf("创建 MeiliSearch 索引失败: %w", createErr)
		}
		_, _ = client.WaitForTask(taskInfo.TaskUID, 30*time.Second)
	}

	index := client.Index(meiliIndexName)

	// 仅在新创建索引时配置设置；已存在的索引跳过（MeiliSearch 设置幂等但跳过可节省 API 调用）
	if err != nil {
		if configErr := configureMeiliIndex(client, index); configErr != nil {
			log.Printf("⚠️ 配置 MeiliSearch 索引设置失败: %v", configErr)
		}
	}

	return &MeiliSearchSearcher{
		client:     client,
		index:      index,
		settingSvc: settingSvc,
	}, nil
}

// configureMeiliIndex 配置 MeiliSearch 索引的可搜索属性、过滤属性等
func configureMeiliIndex(client meilisearch.ServiceManager, index meilisearch.IndexManager) error {
	timeout := 30 * time.Second

	waitAndLog := func(taskUID int64, label string) {
		if _, err := client.WaitForTask(taskUID, timeout); err != nil {
			log.Printf("⚠️ MeiliSearch 等待 %s 任务完成超时或失败: %v", label, err)
		}
	}

	taskInfo, err := index.UpdateSearchableAttributes(&[]string{"title", "content", "tags", "category", "author"})
	if err != nil {
		return fmt.Errorf("设置 searchableAttributes 失败: %w", err)
	}
	waitAndLog(taskInfo.TaskUID, "searchableAttributes")

	filterableAttrs := []interface{}{"category", "tags", "is_doc", "created_at"}
	taskInfo, err = index.UpdateFilterableAttributes(&filterableAttrs)
	if err != nil {
		return fmt.Errorf("设置 filterableAttributes 失败: %w", err)
	}
	waitAndLog(taskInfo.TaskUID, "filterableAttributes")

	taskInfo, err = index.UpdateSortableAttributes(&[]string{"created_at", "view_count"})
	if err != nil {
		return fmt.Errorf("设置 sortableAttributes 失败: %w", err)
	}
	waitAndLog(taskInfo.TaskUID, "sortableAttributes")

	taskInfo, err = index.UpdateRankingRules(&[]string{"words", "typo", "proximity", "attribute", "sort", "exactness"})
	if err != nil {
		return fmt.Errorf("设置 rankingRules 失败: %w", err)
	}
	waitAndLog(taskInfo.TaskUID, "rankingRules")

	return nil
}

// Search 执行搜索
func (s *MeiliSearchSearcher) Search(ctx context.Context, query string, page int, size int) (*model.SearchResult, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 10
	} else if size > 100 {
		size = 100
	}

	if query == "" {
		return &model.SearchResult{
			Pagination: &model.SearchPagination{Total: 0, Page: page, Size: size, TotalPages: 0},
			Hits:       []*model.SearchHit{},
		}, nil
	}

	offset := int64((page - 1) * size)
	limit := int64(size)

	searchRes, err := s.index.Search(query, &meilisearch.SearchRequest{
		Offset:               offset,
		Limit:                limit,
		AttributesToRetrieve: []string{"*"},
		AttributesToHighlight: []string{"title", "content"},
		HighlightPreTag:      "<mark>",
		HighlightPostTag:     "</mark>",
		AttributesToCrop:     []string{"content:150"},
		CropMarker:           "...",
		ShowMatchesPosition:  true,
	})
	if err != nil {
		return nil, fmt.Errorf("MeiliSearch 查询失败: %w", err)
	}

	hits := make([]*model.SearchHit, 0, len(searchRes.Hits))
	for _, rawHit := range searchRes.Hits {
		var doc meiliDocument
		if err := rawHit.DecodeInto(&doc); err != nil {
			continue
		}
		hit := s.docToSearchHit(&doc)
		hits = append(hits, hit)
	}

	total := searchRes.EstimatedTotalHits
	totalPages := (int(total) + size - 1) / size

	return &model.SearchResult{
		Pagination: &model.SearchPagination{
			Total:      total,
			Page:       page,
			Size:       size,
			TotalPages: totalPages,
		},
		Hits: hits,
	}, nil
}

// IndexArticle 索引文章到 MeiliSearch
func (s *MeiliSearchSearcher) IndexArticle(ctx context.Context, article *model.Article) error {
	content := reHTMLTags.ReplaceAllString(article.ContentHTML, " ")
	content = strings.TrimSpace(content)

	author := article.CopyrightAuthor
	if author == "" {
		author = s.settingSvc.Get(constant.KeyFrontDeskSiteOwnerName.String())
	}

	category := ""
	if len(article.PostCategories) > 0 {
		category = article.PostCategories[0].Name
	}

	tags := make([]string, len(article.PostTags))
	for i, tag := range article.PostTags {
		tags[i] = tag.Name
	}

	docSeriesID := ""
	if article.DocSeriesID != nil {
		if pid, err := idgen.GeneratePublicID(*article.DocSeriesID, idgen.EntityTypeDocSeries); err == nil {
			docSeriesID = pid
		}
	}

	doc := meiliDocument{
		ID:          article.ID,
		Title:       article.Title,
		Content:     content,
		Author:      author,
		Category:    category,
		Tags:        tags,
		CoverURL:    article.CoverURL,
		Abbrlink:    article.Abbrlink,
		ViewCount:   article.ViewCount,
		WordCount:   article.WordCount,
		ReadingTime: article.ReadingTime,
		IsDoc:       article.IsDoc,
		DocSeriesID: docSeriesID,
		CreatedAt:   article.CreatedAt.Unix(),
	}

	pk := "id"
	_, err := s.index.AddDocuments([]meiliDocument{doc}, &meilisearch.DocumentOptions{PrimaryKey: &pk})
	if err != nil {
		return fmt.Errorf("MeiliSearch 索引文章失败: %w", err)
	}

	return nil
}

// DeleteArticle 从 MeiliSearch 中删除文章索引
func (s *MeiliSearchSearcher) DeleteArticle(ctx context.Context, articleID string) error {
	_, err := s.index.DeleteDocument(articleID, nil)
	if err != nil {
		return fmt.Errorf("MeiliSearch 删除文章索引失败: %w", err)
	}
	return nil
}

// ClearAllDocuments 清除 MeiliSearch 中所有已索引的文档
func (s *MeiliSearchSearcher) ClearAllDocuments(ctx context.Context) error {
	log.Println("清理 MeiliSearch 索引...")
	_, err := s.index.DeleteAllDocuments(nil)
	if err != nil {
		return fmt.Errorf("清理 MeiliSearch 索引失败: %w", err)
	}
	log.Println("MeiliSearch 索引已清理")
	return nil
}

// HealthCheck MeiliSearch 健康检查
func (s *MeiliSearchSearcher) HealthCheck(ctx context.Context) error {
	health, err := s.client.Health()
	if err != nil {
		return fmt.Errorf("MeiliSearch 健康检查失败: %w", err)
	}
	if health.Status != "available" {
		return fmt.Errorf("MeiliSearch 状态异常: %s", health.Status)
	}
	return nil
}

// docToSearchHit 将解码后的文档转换为 SearchHit
func (s *MeiliSearchSearcher) docToSearchHit(doc *meiliDocument) *model.SearchHit {
	snippet := ""
	if doc.Formatted != nil && doc.Formatted.Content != "" {
		snippet = doc.Formatted.Content
	} else {
		contentRunes := []rune(doc.Content)
		if len(contentRunes) > 150 {
			snippet = string(contentRunes[:150]) + "..."
		} else {
			snippet = doc.Content
		}
	}

	var publishDate time.Time
	if doc.CreatedAt > 0 {
		publishDate = time.Unix(doc.CreatedAt, 0)
	}

	return &model.SearchHit{
		ID:          doc.ID,
		Title:       doc.Title,
		Snippet:     snippet,
		Author:      doc.Author,
		Category:    doc.Category,
		Tags:        doc.Tags,
		PublishDate: publishDate,
		CoverURL:    doc.CoverURL,
		Abbrlink:    doc.Abbrlink,
		ViewCount:   doc.ViewCount,
		WordCount:   doc.WordCount,
		ReadingTime: doc.ReadingTime,
		IsDoc:       doc.IsDoc,
		DocSeriesID: doc.DocSeriesID,
	}
}
