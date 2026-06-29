/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-12 18:22:35
 * @LastEditTime: 2025-07-12 18:22:40
 * @LastEditors: 安知鱼
 */
package ent

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/tag"

	"entgo.io/ent/dialect/sql"
)

type entTagRepository struct {
	client *ent.Client
}

// NewEntTagRepository 是 entTagRepository 的构造函数
func NewEntTagRepository(client *ent.Client) repository.TagRepository {
	return &entTagRepository{client: client}
}

// FindOrCreate 原子性地查找或创建标签。
// 它使用 "ON CONFLICT DO NOTHING" 策略来高效处理批量创建。
func (r *entTagRepository) FindOrCreate(ctx context.Context, names []string) ([]*model.Tag, error) {
	if len(names) == 0 {
		return []*model.Tag{}, nil
	}

	// 使用事务来保证操作的原子性
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return nil, fmt.Errorf("开启事务失败: %w", err)
	}

	// 准备批量创建操作
	bulk := make([]*ent.TagCreate, len(names))
	for i, name := range names {
		bulk[i] = tx.Tag.Create().SetName(name)
	}

	// 执行批量创建，并设置冲突策略：如果 `name` 唯一键冲突，则什么都不做。
	// 这会高效地插入所有不存在的标签。
	err = tx.Tag.CreateBulk(bulk...).
		OnConflict(
			sql.ConflictColumns(tag.FieldName),
		).
		DoNothing().
		Exec(ctx)

	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("批量创建标签失败: %w", err)
	}

	// 现在，查询所有请求的标签，以获取它们的完整信息（包括ID）。
	// 这将同时返回刚刚新创建的和之前已存在的标签。
	finalTags, err := tx.Tag.Query().
		Where(tag.NameIn(names...)).
		All(ctx)

	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("查询最终标签列表失败: %w", err)
	}

	// 提交事务
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	// 将 Ent 模型转换为领域模型
	domainTags := make([]*model.Tag, len(finalTags))
	for i, t := range finalTags {
		domainTags[i] = toDomainTag(t)
	}

	return domainTags, nil
}

// toDomainTag 将 *ent.Tag 转换为 *model.Tag.
func toDomainTag(t *ent.Tag) *model.Tag {
	if t == nil {
		return nil
	}
	return &model.Tag{
		ID:        t.ID,
		CreatedAt: t.CreatedAt,
		UpdatedAt: t.UpdatedAt,
		Name:      t.Name,
	}
}
