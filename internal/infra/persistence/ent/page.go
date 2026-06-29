package ent

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/page"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// EntPageRepository 页面仓库的ent实现
type EntPageRepository struct {
	client *ent.Client
}

// NewEntPageRepository 创建页面仓库
func NewEntPageRepository(client *ent.Client) repository.PageRepository {
	return &EntPageRepository{
		client: client,
	}
}

// Create 创建页面
func (r *EntPageRepository) Create(ctx context.Context, options *model.CreatePageOptions) (*model.Page, error) {
	entPage, err := r.client.Page.Create().
		SetTitle(options.Title).
		SetPath(options.Path).
		SetContent(options.Content).
		SetMarkdownContent(options.MarkdownContent).
		SetCustomJs(options.CustomJS).
		SetCustomCSS(options.CustomCSS).
		SetNillableDescription(&options.Description).
		SetIsPublished(options.IsPublished).
		SetShowComment(options.ShowComment).
		SetSort(options.Sort).
		Save(ctx)

	if err != nil {
		return nil, fmt.Errorf("创建页面失败: %w", err)
	}

	return r.entToModel(entPage), nil
}

// GetByID 根据ID获取页面
func (r *EntPageRepository) GetByID(ctx context.Context, id string) (*model.Page, error) {
	// 将string ID转换为uint
	idUint, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("无效的页面ID: %w", err)
	}

	entPage, err := r.client.Page.Get(ctx, uint(idUint))
	if err != nil {
		return nil, fmt.Errorf("获取页面失败: %w", err)
	}

	return r.entToModel(entPage), nil
}

// GetByPath 根据路径获取页面
func (r *EntPageRepository) GetByPath(ctx context.Context, path string) (*model.Page, error) {
	// 确保路径以 / 开头，因为数据库中存储的路径都是以 / 开头的
	queryPath := path
	if !strings.HasPrefix(queryPath, "/") {
		queryPath = "/" + queryPath
	}

	entPage, err := r.client.Page.Query().
		Where(page.Path(queryPath)).
		First(ctx)

	if err != nil {
		// 检查是否是"未找到"错误
		if ent.IsNotFound(err) {
			return nil, fmt.Errorf("页面不存在: %s", path)
		}
		return nil, fmt.Errorf("获取页面失败: %w", err)
	}

	return r.entToModel(entPage), nil
}

// List 列出页面
func (r *EntPageRepository) List(ctx context.Context, options *model.ListPagesOptions) ([]*model.Page, int, error) {
	query := r.client.Page.Query()

	// 搜索条件
	if options.Search != "" {
		query = query.Where(
			page.Or(
				page.TitleContainsFold(options.Search),
				page.PathContainsFold(options.Search),
				page.DescriptionContainsFold(options.Search),
			),
		)
	}

	// 发布状态过滤
	if options.IsPublished != nil {
		query = query.Where(page.IsPublished(*options.IsPublished))
	}

	// 获取总数
	total, err := query.Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("获取页面总数失败: %w", err)
	}

	// 分页和排序
	offset := (options.Page - 1) * options.PageSize
	entPages, err := query.
		Order(ent.Desc(page.FieldSort)).
		Order(ent.Desc(page.FieldCreatedAt)).
		Offset(offset).
		Limit(options.PageSize).
		All(ctx)

	if err != nil {
		return nil, 0, fmt.Errorf("获取页面列表失败: %w", err)
	}

	// 转换为模型
	pages := make([]*model.Page, len(entPages))
	for i, entPage := range entPages {
		pages[i] = r.entToModel(entPage)
	}

	return pages, total, nil
}

// Update 更新页面
func (r *EntPageRepository) Update(ctx context.Context, id string, options *model.UpdatePageOptions) (*model.Page, error) {
	// 将string ID转换为uint
	idUint, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("无效的页面ID: %w", err)
	}

	update := r.client.Page.UpdateOneID(uint(idUint))

	if options.Title != nil {
		update.SetTitle(*options.Title)
	}

	if options.Path != nil {
		update.SetPath(*options.Path)
	}

	if options.Content != nil {
		update.SetContent(*options.Content)
	}

	if options.MarkdownContent != nil {
		update.SetMarkdownContent(*options.MarkdownContent)
	}

	if options.CustomJS != nil {
		update.SetCustomJs(*options.CustomJS)
	}

	if options.CustomCSS != nil {
		update.SetCustomCSS(*options.CustomCSS)
	}

	if options.Description != nil {
		update.SetNillableDescription(options.Description)
	}

	if options.IsPublished != nil {
		update.SetIsPublished(*options.IsPublished)
	}

	if options.ShowComment != nil {
		update.SetShowComment(*options.ShowComment)
	}

	if options.Sort != nil {
		update.SetSort(*options.Sort)
	}

	entPage, err := update.Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("更新页面失败: %w", err)
	}

	return r.entToModel(entPage), nil
}

// Delete 删除页面
func (r *EntPageRepository) Delete(ctx context.Context, id string) error {
	// 将string ID转换为uint
	idUint, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		return fmt.Errorf("无效的页面ID: %w", err)
	}

	err = r.client.Page.DeleteOneID(uint(idUint)).Exec(ctx)
	if err != nil {
		return fmt.Errorf("删除页面失败: %w", err)
	}

	return nil
}

// ExistsByPath 检查路径是否存在
func (r *EntPageRepository) ExistsByPath(ctx context.Context, path string, excludeID string) (bool, error) {
	query := r.client.Page.Query().Where(page.Path(path))

	if excludeID != "" {
		// 将string ID转换为uint
		excludeIDUint, err := strconv.ParseUint(excludeID, 10, 32)
		if err != nil {
			return false, fmt.Errorf("无效的页面ID: %w", err)
		}
		query = query.Where(page.IDNEQ(uint(excludeIDUint)))
	}

	exists, err := query.Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("检查路径是否存在失败: %w", err)
	}

	return exists, nil
}

// entToModel 将ent实体转换为模型
func (r *EntPageRepository) entToModel(entPage *ent.Page) *model.Page {
	return &model.Page{
		ID:              entPage.ID,
		Title:           entPage.Title,
		Path:            entPage.Path,
		Content:         entPage.Content,
		MarkdownContent: entPage.MarkdownContent,
		CustomJS:        entPage.CustomJs,
		CustomCSS:       entPage.CustomCSS,
		Description:     entPage.Description,
		IsPublished:     entPage.IsPublished,
		ShowComment:     entPage.ShowComment,
		Sort:            entPage.Sort,
		CreatedAt:       entPage.CreatedAt,
		UpdatedAt:       entPage.UpdatedAt,
	}
}
