/*
 * @Description: 文章历史版本仓储实现
 * @Author: 安知鱼
 * @Date: 2026-01-13
 */
package ent

import (
	"context"
	"fmt"
	"log"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/articlehistory"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

type articleHistoryRepo struct {
	db *ent.Client
}

// NewArticleHistoryRepo 是 articleHistoryRepo 的构造函数。
func NewArticleHistoryRepo(db *ent.Client) repository.ArticleHistoryRepository {
	return &articleHistoryRepo{db: db}
}

// toModel 负责将 ent.ArticleHistory 实体转换为 model.ArticleHistory 领域模型。
func (r *articleHistoryRepo) toModel(h *ent.ArticleHistory) *model.ArticleHistory {
	if h == nil {
		return nil
	}

	publicID, err := idgen.GeneratePublicID(h.ID, idgen.EntityTypeArticleHistory)
	if err != nil {
		log.Printf("[严重错误] 生成文章历史公共ID失败: dbID=%d, error=%v", h.ID, err)
		return nil
	}

	articlePublicID, err := idgen.GeneratePublicID(h.ArticleID, idgen.EntityTypeArticle)
	if err != nil {
		log.Printf("[严重错误] 生成文章公共ID失败: dbID=%d, error=%v", h.ArticleID, err)
		return nil
	}

	return &model.ArticleHistory{
		ID:             publicID,
		ArticleID:      articlePublicID,
		Version:        h.Version,
		Title:          h.Title,
		ContentMd:      h.ContentMd,
		ContentHTML:    h.ContentHTML,
		CoverURL:       h.CoverURL,
		TopImgURL:      h.TopImgURL,
		PrimaryColor:   h.PrimaryColor,
		Summaries:      h.Summaries,
		WordCount:      h.WordCount,
		Keywords:       h.Keywords,
		EditorID:       h.EditorID,
		EditorNickname: h.EditorNickname,
		ChangeNote:     h.ChangeNote,
		CreatedAt:      h.CreatedAt,
		ExtraData:      h.ExtraData,
	}
}

// toListItem 转换为列表项（不含完整内容）
func (r *articleHistoryRepo) toListItem(h *ent.ArticleHistory) model.ArticleHistoryListItem {
	publicID, _ := idgen.GeneratePublicID(h.ID, idgen.EntityTypeArticleHistory)

	return model.ArticleHistoryListItem{
		ID:             publicID,
		Version:        h.Version,
		Title:          h.Title,
		WordCount:      h.WordCount,
		EditorNickname: h.EditorNickname,
		ChangeNote:     h.ChangeNote,
		CreatedAt:      h.CreatedAt,
	}
}

// Create 创建历史版本记录
func (r *articleHistoryRepo) Create(ctx context.Context, params *model.CreateArticleHistoryParams) (*model.ArticleHistory, error) {
	creator := r.db.ArticleHistory.Create().
		SetArticleID(params.ArticleDBID).
		SetVersion(params.Version).
		SetTitle(params.Title).
		SetContentMd(params.ContentMd).
		SetContentHTML(params.ContentHTML).
		SetCoverURL(params.CoverURL).
		SetTopImgURL(params.TopImgURL).
		SetPrimaryColor(params.PrimaryColor).
		SetSummaries(params.Summaries).
		SetWordCount(params.WordCount).
		SetKeywords(params.Keywords).
		SetEditorID(params.EditorID).
		SetEditorNickname(params.EditorNickname).
		SetChangeNote(params.ChangeNote)

	if params.ExtraData != nil {
		creator.SetExtraData(params.ExtraData)
	}

	entity, err := creator.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("创建文章历史版本失败: %w", err)
	}

	log.Printf("[ArticleHistoryRepo] 创建历史版本成功: 文章ID=%d, 版本=%d", params.ArticleDBID, params.Version)
	return r.toModel(entity), nil
}

// GetByArticleAndVersion 根据文章ID和版本号获取历史记录
func (r *articleHistoryRepo) GetByArticleAndVersion(ctx context.Context, articleDBID uint, version int) (*model.ArticleHistory, error) {
	entity, err := r.db.ArticleHistory.Query().
		Where(
			articlehistory.ArticleIDEQ(articleDBID),
			articlehistory.VersionEQ(version),
		).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return nil, fmt.Errorf("历史版本不存在: 文章ID=%d, 版本=%d", articleDBID, version)
		}
		return nil, fmt.Errorf("查询历史版本失败: %w", err)
	}

	return r.toModel(entity), nil
}

// ListByArticle 分页获取文章的历史版本列表
func (r *articleHistoryRepo) ListByArticle(ctx context.Context, articleDBID uint, page, pageSize int) ([]model.ArticleHistoryListItem, int64, error) {
	// 查询总数
	total, err := r.db.ArticleHistory.Query().
		Where(articlehistory.ArticleIDEQ(articleDBID)).
		Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("查询历史版本总数失败: %w", err)
	}

	// 分页查询，按版本号倒序排列（最新版本在前）
	entities, err := r.db.ArticleHistory.Query().
		Where(articlehistory.ArticleIDEQ(articleDBID)).
		Order(ent.Desc(articlehistory.FieldVersion)).
		Offset((page-1)*pageSize).
		Limit(pageSize).
		Select(
			articlehistory.FieldID,
			articlehistory.FieldVersion,
			articlehistory.FieldTitle,
			articlehistory.FieldWordCount,
			articlehistory.FieldEditorNickname,
			articlehistory.FieldChangeNote,
			articlehistory.FieldCreatedAt,
		).
		All(ctx)

	if err != nil {
		return nil, 0, fmt.Errorf("查询历史版本列表失败: %w", err)
	}

	items := make([]model.ArticleHistoryListItem, len(entities))
	for i, entity := range entities {
		items[i] = r.toListItem(entity)
	}

	return items, int64(total), nil
}

// GetLatestVersion 获取文章的最新版本号，如果没有历史记录则返回0
func (r *articleHistoryRepo) GetLatestVersion(ctx context.Context, articleDBID uint) (int, error) {
	entity, err := r.db.ArticleHistory.Query().
		Where(articlehistory.ArticleIDEQ(articleDBID)).
		Order(ent.Desc(articlehistory.FieldVersion)).
		Select(articlehistory.FieldVersion).
		First(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return 0, nil // 没有历史记录，返回0
		}
		return 0, fmt.Errorf("查询最新版本号失败: %w", err)
	}

	return entity.Version, nil
}

// DeleteOldVersions 删除旧版本（保留最近N个版本）
func (r *articleHistoryRepo) DeleteOldVersions(ctx context.Context, articleDBID uint, keepCount int) error {
	if keepCount <= 0 {
		return nil
	}

	// 获取需要保留的最小版本号
	entities, err := r.db.ArticleHistory.Query().
		Where(articlehistory.ArticleIDEQ(articleDBID)).
		Order(ent.Desc(articlehistory.FieldVersion)).
		Limit(keepCount).
		Select(articlehistory.FieldVersion).
		All(ctx)

	if err != nil {
		return fmt.Errorf("查询保留版本失败: %w", err)
	}

	if len(entities) < keepCount {
		// 版本数不足，无需删除
		return nil
	}

	// 获取最小保留版本号
	minKeepVersion := entities[len(entities)-1].Version

	// 删除版本号小于最小保留版本的记录
	deleted, err := r.db.ArticleHistory.Delete().
		Where(
			articlehistory.ArticleIDEQ(articleDBID),
			articlehistory.VersionLT(minKeepVersion),
		).
		Exec(ctx)

	if err != nil {
		return fmt.Errorf("删除旧版本失败: %w", err)
	}

	if deleted > 0 {
		log.Printf("[ArticleHistoryRepo] 清理旧版本: 文章ID=%d, 删除了%d个版本", articleDBID, deleted)
	}

	return nil
}

// CountByArticle 获取文章的历史版本总数
func (r *articleHistoryRepo) CountByArticle(ctx context.Context, articleDBID uint) (int, error) {
	count, err := r.db.ArticleHistory.Query().
		Where(articlehistory.ArticleIDEQ(articleDBID)).
		Count(ctx)

	if err != nil {
		return 0, fmt.Errorf("查询历史版本总数失败: %w", err)
	}

	return count, nil
}

// DeleteByArticle 删除文章的所有历史版本（文章被删除时调用）
func (r *articleHistoryRepo) DeleteByArticle(ctx context.Context, articleDBID uint) error {
	deleted, err := r.db.ArticleHistory.Delete().
		Where(articlehistory.ArticleIDEQ(articleDBID)).
		Exec(ctx)

	if err != nil {
		return fmt.Errorf("删除文章历史版本失败: %w", err)
	}

	if deleted > 0 {
		log.Printf("[ArticleHistoryRepo] 删除文章历史版本: 文章ID=%d, 删除了%d个版本", articleDBID, deleted)
	}

	return nil
}

// GetAllArticleIDsWithHistory 获取所有有历史记录的文章ID列表（用于定时清理任务）
func (r *articleHistoryRepo) GetAllArticleIDsWithHistory(ctx context.Context) ([]uint, error) {
	// 使用 GroupBy 获取所有不重复的 article_id
	var result []struct {
		ArticleID uint `json:"article_id"`
	}

	err := r.db.ArticleHistory.Query().
		GroupBy(articlehistory.FieldArticleID).
		Scan(ctx, &result)

	if err != nil {
		return nil, fmt.Errorf("查询有历史记录的文章ID失败: %w", err)
	}

	articleIDs := make([]uint, len(result))
	for i, r := range result {
		articleIDs[i] = r.ArticleID
	}

	return articleIDs, nil
}
