package ent

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/posttag"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"

	"entgo.io/ent/dialect/sql"
)

// postTagRepo 结构体现在持有 dbType，用于判断数据库方言
type postTagRepo struct {
	db     *ent.Client
	dbType string
}

// NewPostTagRepo 的构造函数，接收 dbType 作为参数
func NewPostTagRepo(db *ent.Client, dbType string) repository.PostTagRepository {
	return &postTagRepo{
		db:     db,
		dbType: dbType,
	}
}

// toModel 是一个私有辅助函数，将 ent 实体转换为领域模型。
func (r *postTagRepo) toModel(t *ent.PostTag) *model.PostTag {
	if t == nil {
		return nil
	}
	publicID, _ := idgen.GeneratePublicID(t.ID, idgen.EntityTypePostTag)
	slug := ""
	if t.Slug != nil {
		slug = *t.Slug
	}
	return &model.PostTag{
		ID:        publicID,
		CreatedAt: t.CreatedAt,
		UpdatedAt: t.UpdatedAt,
		Name:      t.Name,
		Slug:      slug,
		Count:     t.Count,
	}
}

func (r *postTagRepo) Create(ctx context.Context, req *model.CreatePostTagRequest) (*model.PostTag, error) {
	creator := r.db.PostTag.Create().
		SetName(req.Name)
	if req.Slug != "" {
		creator.SetSlug(req.Slug)
	}
	newTag, err := creator.Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(newTag), nil
}

func (r *postTagRepo) Update(ctx context.Context, publicID string, req *model.UpdatePostTagRequest) (*model.PostTag, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return nil, err
	}
	updater := r.db.PostTag.UpdateOneID(dbID)
	if req.Name != nil {
		updater.SetName(*req.Name)
	}
	if req.Slug != nil {
		if *req.Slug == "" {
			updater.ClearSlug()
		} else {
			updater.SetSlug(*req.Slug)
		}
	}
	updatedTag, err := updater.Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(updatedTag), nil
}

// List 列出所有标签，支持排序
func (r *postTagRepo) List(ctx context.Context, options *model.ListPostTagsOptions) ([]*model.PostTag, error) {
	var opts model.ListPostTagsOptions
	if options != nil {
		opts = *options
	}

	query := r.db.PostTag.Query().Where(posttag.DeletedAtIsNil())
	if opts.ExcludeZeroCount {
		query = query.Where(posttag.CountGT(0))
	}

	switch opts.SortBy {
	case model.SortByName:
		switch r.dbType {
		case "postgres":
			query = query.Order(
				posttag.OrderOption(func(s *sql.Selector) {
					s.OrderExprFunc(func(b *sql.Builder) {
						b.WriteString("CASE WHEN name ~ '^[[:ascii:]]' THEN 1 ELSE 2 END ASC")
					})
				}),
				ent.Asc(posttag.FieldName),
			)
		case "mysql":
			query = query.Order(
				posttag.OrderOption(func(s *sql.Selector) {
					s.OrderExprFunc(func(b *sql.Builder) {
						b.WriteString("CASE WHEN name REGEXP '^[a-zA-Z0-9]' THEN 1 ELSE 2 END ASC")
					})
				}),
				ent.Asc(posttag.FieldName),
			)
		case "sqlite":
			fallthrough
		default:
			query = query.Order(ent.Asc(posttag.FieldName))
		}

	case model.SortByCount:
		fallthrough
	default:
		query = query.Order(ent.Desc(posttag.FieldCount))
	}

	entities, err := query.All(ctx)
	if err != nil {
		return nil, err
	}

	models := make([]*model.PostTag, len(entities))
	for i, entity := range entities {
		models[i] = r.toModel(entity)
	}
	return models, nil
}

func (r *postTagRepo) Delete(ctx context.Context, publicID string) error {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return err
	}
	return r.db.PostTag.DeleteOneID(dbID).Exec(ctx)
}

func (r *postTagRepo) UpdateCount(ctx context.Context, incIDs, decIDs []uint) error {
	if len(incIDs) > 0 {
		_, err := r.db.PostTag.Update().Where(posttag.IDIn(incIDs...)).AddCount(1).Save(ctx)
		if err != nil {
			return fmt.Errorf("增加标签计数失败: %w", err)
		}
	}
	if len(decIDs) > 0 {
		_, err := r.db.PostTag.Update().Where(posttag.IDIn(decIDs...)).AddCount(-1).Save(ctx)
		if err != nil {
			return fmt.Errorf("减少标签计数失败: %w", err)
		}
	}
	return nil
}

func (r *postTagRepo) DeleteIfUnused(ctx context.Context, ids []uint) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.db.PostTag.Delete().
		Where(
			posttag.IDIn(ids...),
			posttag.CountLTE(0),
		).
		Exec(ctx)
	return err
}

func (r *postTagRepo) GetByID(ctx context.Context, publicID string) (*model.PostTag, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return nil, err
	}
	entity, err := r.db.PostTag.Query().
		Where(posttag.ID(dbID), posttag.DeletedAtIsNil()).
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(entity), nil
}

// ExistsByName 检查指定名称的标签是否已存在
func (r *postTagRepo) ExistsByName(ctx context.Context, name string) (bool, error) {
	count, err := r.db.PostTag.Query().
		Where(posttag.Name(name)).
		Count(ctx)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
