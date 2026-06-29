/*
 * @Description: Redis 搜索器实现，包含基于权重的相关度排序和优化的分词逻辑
 * @Author: 安知鱼
 * @Date: 2025-08-30 14:01:22
 * @LastEditTime: 2025-12-17 16:55:59
 * @LastEditors: 安知鱼
 */

package search

import (
	"context"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// Redis Key 前缀和权重常量
const (
	// Redis Key 命名空间前缀
	KeyNamespace = "anheyu:"

	KeyPrefixArticle       = KeyNamespace + "search:article:"
	KeyPrefixIndex         = KeyNamespace + "search:index:"
	KeyPrefixWords         = KeyNamespace + "search:words:"
	KeyPrefixResultCache   = KeyNamespace + "search:result:"
	ResultCacheTTL         = 10 * time.Minute
	DefaultRedisAddr       = "localhost:6379"
	RedisConnectionTimeout = 5 * time.Second

	WeightTitle   = 10.0 // 标题权重
	WeightContent = 1.0  // 内容权重
)

// 正则表达式预编译
var (
	reHTMLTags        = regexp.MustCompile(`<[^>]*>`)
	reChineseChars    = regexp.MustCompile(`\p{Han}`)
	reAlphanumeric    = regexp.MustCompile(`[a-zA-Z0-9_.-]+`) // 匹配单词、数字及版本号等
	reNonAlphanumeric = regexp.MustCompile(`[^\p{L}\p{N}]+`)
)

// RedisSearcher 使用 Redis 实现的搜索器
type RedisSearcher struct {
	client     *redis.Client
	settingSvc setting.SettingService
}

// NewRedisSearcher 创建新的 Redis 搜索器（支持自动降级）
// 如果 redisClient 为 nil 或连接失败，返回 nil 以便上层降级
func NewRedisSearcher(settingSvc setting.SettingService) (*RedisSearcher, error) {
	redisAddr := os.Getenv("ANHEYU_REDIS_ADDR")
	if redisAddr == "" {
		// Redis 地址未配置，返回 nil 以便降级
		log.Println("⚠️  Redis 地址未配置，搜索功能将降级到数据库模式")
		return nil, nil
	}

	// 从环境变量读取 Redis DB，默认使用 10 号数据库
	redisDB := 10
	if dbStr := os.Getenv("ANHEYU_REDIS_DB"); dbStr != "" {
		if db, err := strconv.Atoi(dbStr); err == nil {
			redisDB = db
		} else {
			log.Printf("⚠️  无效的 ANHEYU_REDIS_DB 值 '%s': %v，使用默认值 10", dbStr, err)
		}
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: os.Getenv("ANHEYU_REDIS_PASSWORD"),
		DB:       redisDB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), RedisConnectionTimeout)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️  Redis 连接失败: %v，搜索功能将降级到数据库模式", err)
		rdb.Close()
		return nil, nil
	}

	log.Printf("✅ Redis 搜索器已连接 (%s, DB %d)", redisAddr, redisDB)
	return &RedisSearcher{
		client:     rdb,
		settingSvc: settingSvc,
	}, nil
}

// NewRedisSearcherWithClient 使用已有的 Redis 客户端创建搜索器
func NewRedisSearcherWithClient(redisClient *redis.Client, settingSvc setting.SettingService) (*RedisSearcher, error) {
	if redisClient == nil {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), RedisConnectionTimeout)
	defer cancel()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️  Redis 不可用: %v，搜索功能将降级到数据库模式", err)
		return nil, nil
	}

	return &RedisSearcher{
		client:     redisClient,
		settingSvc: settingSvc,
	}, nil
}

// tokenizer 是一个优化的分词器
// 规则:
// 1. 文本转为小写。
// 2. 提取所有中文字符作为单个词条（unigram）。
// 3. 提取连续的中文双字组合作为词条（bigram）。
// 4. 提取所有英文单词、数字和包含 `_.-` 的组合（如版本号 "1.18", "go-redis"）作为词条。
// 5. 为英文单词生成多个变体索引，支持大小写不敏感搜索。
func tokenize(text string) []string {
	lowerText := strings.ToLower(text)
	seen := make(map[string]struct{})
	var tokens []string

	// 4. 提取英文、数字及特殊组合
	alphanumericTokens := reAlphanumeric.FindAllString(lowerText, -1)
	for _, token := range alphanumericTokens {
		if _, exists := seen[token]; !exists {
			tokens = append(tokens, token)
			seen[token] = struct{}{}

			// 为英文单词生成多个变体索引
			if isEnglishWord(token) {
				variants := generateWordVariants(token)
				for _, variant := range variants {
					if variant != token {
						if _, exists := seen[variant]; !exists {
							tokens = append(tokens, variant)
							seen[variant] = struct{}{}
						}
					}
				}
			}
		}
	}

	// 2. 提取所有中文字符 (unigram)
	// 按照您的要求，标题和内容都进行单字索引
	runes := []rune(lowerText)
	for _, r := range runes {
		if r >= 0x4E00 && r <= 0x9FFF { // 判断是否为中文字符
			char := string(r)
			if _, exists := seen[char]; !exists {
				tokens = append(tokens, char)
				seen[char] = struct{}{}
			}
		}
	}

	// 3. 提取中文双字组合 (bigram)
	for i := 0; i < len(runes)-1; i++ {
		if (runes[i] >= 0x4E00 && runes[i] <= 0x9FFF) && (runes[i+1] >= 0x4E00 && runes[i+1] <= 0x9FFF) {
			bigram := string(runes[i : i+2])
			if _, exists := seen[bigram]; !exists {
				tokens = append(tokens, bigram)
				seen[bigram] = struct{}{}
			}
		}
	}

	return tokens
}

// isEnglishWord 判断是否为英文单词（包含连字符和下划线）
func isEnglishWord(s string) bool {
	if len(s) == 0 {
		return false
	}

	// 检查是否只包含英文字母、连字符和下划线
	for _, r := range s {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || r == '-' || r == '_') {
			return false
		}
	}
	return true
}

// generateWordVariants 为英文单词生成多个变体索引
func generateWordVariants(word string) []string {
	if len(word) == 0 {
		return []string{}
	}

	var variants []string
	seen := make(map[string]bool)
	lowerWord := strings.ToLower(word)

	// 添加小写形式
	if !seen[lowerWord] {
		variants = append(variants, lowerWord)
		seen[lowerWord] = true
	}

	// 添加首字母大写形式（只有当原始单词不是小写且不是全大写时才添加）
	if len(word) > 0 && word != lowerWord && word != strings.ToUpper(lowerWord) {
		titleCase := strings.Title(lowerWord)
		if titleCase != lowerWord && !seen[titleCase] {
			variants = append(variants, titleCase)
			seen[titleCase] = true
		}
	}

	// 添加原始形式（如果不是小写）
	if word != lowerWord && !seen[word] {
		variants = append(variants, word)
		seen[word] = true
	}

	// 如果包含连字符或下划线，为每个部分生成变体
	if strings.Contains(word, "-") || strings.Contains(word, "_") {
		parts := strings.FieldsFunc(word, func(r rune) bool {
			return r == '-' || r == '_'
		})
		for _, part := range parts {
			if len(part) > 0 {
				partVariants := generateWordVariants(part)
				for _, variant := range partVariants {
					if !seen[variant] {
						variants = append(variants, variant)
						seen[variant] = true
					}
				}
			}
		}
	}

	return variants
}

// Search 执行搜索，结果按相关度排序
func (rs *RedisSearcher) Search(ctx context.Context, query string, page int, size int) (*model.SearchResult, error) {
	if query == "" {
		return &model.SearchResult{
			Pagination: &model.SearchPagination{Total: 0, Page: page, Size: size, TotalPages: 0},
			Hits:       []*model.SearchHit{},
		}, nil
	}

	queryTokens := tokenize(query)
	log.Printf("搜索查询: '%s', 分词结果: %v", query, queryTokens)

	if len(queryTokens) == 0 {
		return &model.SearchResult{
			Pagination: &model.SearchPagination{Total: 0, Page: page, Size: size, TotalPages: 0},
			Hits:       []*model.SearchHit{},
		}, nil
	}

	indexKeys := make([]string, len(queryTokens))
	for i, token := range queryTokens {
		indexKeys[i] = fmt.Sprintf("%s%s", KeyPrefixIndex, token)
	}

	tempResultKey := fmt.Sprintf("%s%s", KeyPrefixResultCache, uuid.New().String())
	defer rs.client.Del(ctx, tempResultKey) // 确保临时 key 被删除

	// 使用 ZINTERSTORE 计算交集，并把分数相加，权重默认为1
	// 得到的结果是按相关度分数从高到低排序的
	if err := rs.client.ZInterStore(ctx, tempResultKey, &redis.ZStore{
		Keys:      indexKeys,
		Aggregate: "SUM",
	}).Err(); err != nil {
		return nil, fmt.Errorf("计算搜索结果交集失败: %w", err)
	}
	rs.client.Expire(ctx, tempResultKey, ResultCacheTTL)

	total, err := rs.client.ZCard(ctx, tempResultKey).Result()
	if err != nil {
		return nil, fmt.Errorf("获取搜索结果总数失败: %w", err)
	}
	log.Printf("搜索结果总数: %d", total)

	if total == 0 {
		return &model.SearchResult{
			Pagination: &model.SearchPagination{Total: 0, Page: page, Size: size, TotalPages: 0},
			Hits:       []*model.SearchHit{},
		}, nil
	}

	// ZREVRANGE 按分数从高到低获取文章ID
	start := int64((page - 1) * size)
	stop := start + int64(size) - 1
	articleIDs, err := rs.client.ZRevRange(ctx, tempResultKey, start, stop).Result()
	if err != nil {
		return nil, fmt.Errorf("分页获取搜索结果失败: %w", err)
	}

	// 使用 pipeline 批量获取文章数据
	pipe := rs.client.Pipeline()
	cmdMap := make(map[string]*redis.MapStringStringCmd, len(articleIDs))
	for _, id := range articleIDs {
		articleKey := fmt.Sprintf("%s%s", KeyPrefixArticle, id)
		cmdMap[id] = pipe.HGetAll(ctx, articleKey)
	}
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, fmt.Errorf("批量获取文章详情失败: %w", err)
	}

	// 组装返回结果
	searchHits := make([]*model.SearchHit, 0, len(articleIDs))
	for _, id := range articleIDs {
		data, err := cmdMap[id].Result()
		if err != nil {
			log.Printf("警告: 获取文章 %s 数据失败: %v", id, err)
			continue
		}

		hit := rs.mapDataToSearchHit(id, data)
		searchHits = append(searchHits, hit)
	}

	totalPages := (int(total) + size - 1) / size
	return &model.SearchResult{
		Pagination: &model.SearchPagination{
			Total:      total,
			Page:       page,
			Size:       size,
			TotalPages: totalPages,
		},
		Hits: searchHits,
	}, nil
}

// IndexArticle 索引文章，带有权重
func (rs *RedisSearcher) IndexArticle(ctx context.Context, article *model.Article) error {
	articleKey := fmt.Sprintf("%s%s", KeyPrefixArticle, article.ID)
	wordsKey := fmt.Sprintf("%s%s", KeyPrefixWords, article.ID)
	pipe := rs.client.Pipeline()

	// 1. 清理旧的索引
	oldWords, _ := rs.client.SMembers(ctx, wordsKey).Result()
	for _, word := range oldWords {
		indexKey := fmt.Sprintf("%s%s", KeyPrefixIndex, word)
		pipe.ZRem(ctx, indexKey, article.ID)
	}
	pipe.Del(ctx, wordsKey)

	// 2. 准备新的文章数据
	category := ""
	if len(article.PostCategories) > 0 {
		category = article.PostCategories[0].Name
	}
	tags := make([]string, len(article.PostTags))
	for i, tag := range article.PostTags {
		tags[i] = tag.Name
	}

	// 转换文档系列ID
	docSeriesIDStr := ""
	if article.DocSeriesID != nil {
		if publicID, err := idgen.GeneratePublicID(*article.DocSeriesID, idgen.EntityTypeDocSeries); err == nil {
			docSeriesIDStr = publicID
		}
	}

	// 获取作者名称：优先使用文章的版权作者，其次使用站点所有者名称
	author := article.CopyrightAuthor
	if author == "" {
		author = rs.settingSvc.Get(constant.KeyFrontDeskSiteOwnerName.String())
	}

	articleData := map[string]interface{}{
		"id":            article.ID,
		"title":         article.Title,
		"content":       article.ContentHTML,
		"author":        author,
		"category":      category,
		"publish_date":  article.CreatedAt.Format(time.RFC3339),
		"cover_url":     article.CoverURL,
		"abbrlink":      article.Abbrlink,
		"view_count":    article.ViewCount,
		"word_count":    article.WordCount,
		"reading_time":  article.ReadingTime,
		"status":        article.Status,
		"is_doc":        article.IsDoc,
		"doc_series_id": docSeriesIDStr,
	}
	if len(tags) > 0 {
		articleData["tags"] = strings.Join(tags, ",")
	}
	pipe.HSet(ctx, articleKey, articleData)

	// 3. 创建新的加权索引
	tokensWithWeights := make(map[string]float64)

	// 处理标题，赋予更高权重
	titleTokens := tokenize(article.Title)
	for _, token := range titleTokens {
		tokensWithWeights[token] = WeightTitle
	}

	// 处理内容，赋予基础权重 (如果词条已在标题中出现，则不覆盖)
	cleanContent := reHTMLTags.ReplaceAllString(article.ContentHTML, " ")
	contentTokens := tokenize(cleanContent)
	for _, token := range contentTokens {
		if _, exists := tokensWithWeights[token]; !exists {
			tokensWithWeights[token] = WeightContent
		}
	}

	// log.Printf("索引文章 %s: 标题='%s', 总词条数: %d", article.ID, article.Title, len(tokensWithWeights))

	// 将新的词条信息写入 pipeline
	newWords := make([]interface{}, 0, len(tokensWithWeights))
	for token, weight := range tokensWithWeights {
		newWords = append(newWords, token)
		indexKey := fmt.Sprintf("%s%s", KeyPrefixIndex, token)
		pipe.ZAdd(ctx, indexKey, redis.Z{Score: weight, Member: article.ID})
	}

	if len(newWords) > 0 {
		pipe.SAdd(ctx, wordsKey, newWords...)
	}

	// 4. 执行 pipeline
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("索引文章 %s 失败: %w", article.ID, err)
	}

	return nil
}

// DeleteArticle 删除文章索引
func (rs *RedisSearcher) DeleteArticle(ctx context.Context, articleID string) error {
	pipe := rs.client.Pipeline()

	articleKey := fmt.Sprintf("%s%s", KeyPrefixArticle, articleID)
	pipe.Del(ctx, articleKey)

	wordsKey := fmt.Sprintf("%s%s", KeyPrefixWords, articleID)
	words, err := rs.client.SMembers(ctx, wordsKey).Result()
	if err != nil && err != redis.Nil {
		log.Printf("警告: 获取文章 %s 的旧索引词失败: %v", articleID, err)
	}
	for _, word := range words {
		indexKey := fmt.Sprintf("%s%s", KeyPrefixIndex, word)
		pipe.ZRem(ctx, indexKey, articleID)
	}
	pipe.Del(ctx, wordsKey)

	_, err = pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("删除文章索引 %s 失败: %w", articleID, err)
	}

	return nil
}

// mapDataToSearchHit 是一个辅助函数，用于将 Redis hash map 转换为 SearchHit 结构体
func (rs *RedisSearcher) mapDataToSearchHit(id string, data map[string]string) *model.SearchHit {
	hit := &model.SearchHit{ID: id}
	hit.Title = data["title"]
	hit.Author = data["author"]
	hit.Category = data["category"]
	hit.CoverURL = data["cover_url"]
	hit.Abbrlink = data["abbrlink"]

	if pTime, err := time.Parse(time.RFC3339, data["publish_date"]); err == nil {
		hit.PublishDate = pTime
	}

	tagsStr := data["tags"]
	if tagsStr != "" {
		hit.Tags = strings.Split(tagsStr, ",")
	} else {
		hit.Tags = []string{}
	}

	fmt.Sscanf(data["view_count"], "%d", &hit.ViewCount)
	fmt.Sscanf(data["word_count"], "%d", &hit.WordCount)
	fmt.Sscanf(data["reading_time"], "%d", &hit.ReadingTime)

	// 文档模式相关字段
	if data["is_doc"] == "true" || data["is_doc"] == "1" {
		hit.IsDoc = true
	}
	hit.DocSeriesID = data["doc_series_id"]

	// 生成摘要
	cleanContent := reHTMLTags.ReplaceAllString(data["content"], " ")
	cleanContent = reNonAlphanumeric.ReplaceAllString(cleanContent, " ")
	cleanContent = strings.TrimSpace(cleanContent)
	contentRunes := []rune(cleanContent)
	if len(contentRunes) > 150 {
		hit.Snippet = string(contentRunes[:150]) + "..."
	} else {
		hit.Snippet = string(contentRunes)
	}

	return hit
}

// ClearAllDocuments 清除 Redis 中所有搜索索引键
func (rs *RedisSearcher) ClearAllDocuments(ctx context.Context) error {
	pattern := KeyNamespace + "search:*"
	keys, err := rs.client.Keys(ctx, pattern).Result()
	if err != nil {
		return fmt.Errorf("获取搜索索引键失败: %w", err)
	}
	if len(keys) > 0 {
		pipe := rs.client.Pipeline()
		for _, key := range keys {
			pipe.Del(ctx, key)
		}
		if _, err := pipe.Exec(ctx); err != nil {
			return fmt.Errorf("删除搜索索引失败: %w", err)
		}
		log.Printf("已清理 %d 个搜索索引键", len(keys))
	}
	return nil
}

// HealthCheck 健康检查
func (rs *RedisSearcher) HealthCheck(ctx context.Context) error {
	return rs.client.Ping(ctx).Err()
}

// TestTokenize 测试分词函数
func (rs *RedisSearcher) TestTokenize(text string) []string {
	return tokenize(text)
}
