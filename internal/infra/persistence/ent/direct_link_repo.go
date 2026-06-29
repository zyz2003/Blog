package ent

import (
	"context"
	"errors"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/directlink"

	"entgo.io/ent/dialect/sql"
)

type entDirectLinkRepo struct {
	client *ent.Client
}

// NewEntDirectLinkRepository 是 entDirectLinkRepo 的构造函数
func NewEntDirectLinkRepository(client *ent.Client) repository.DirectLinkRepository {
	return &entDirectLinkRepo{client: client}
}

// FindOrCreateBatch 使用 Ent 的 OnConflict 功能来原子性地查找或创建直链。
func (r *entDirectLinkRepo) FindOrCreateBatch(ctx context.Context, links []*model.DirectLink) error {
	if len(links) == 0 {
		return nil
	}

	tx, err := r.client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("开启事务失败: %w", err)
	}

	// 准备批量创建操作
	bulk := make([]*ent.DirectLinkCreate, len(links))
	fileIDs := make([]uint, len(links))
	for i, link := range links {
		fileIDs[i] = link.FileID
		bulk[i] = tx.DirectLink.Create().
			SetFileID(link.FileID).
			SetFileName(link.FileName).
			SetSpeedLimit(link.SpeedLimit)
	}

	// 执行批量创建，如果 file_id 冲突，则什么都不做
	err = tx.DirectLink.CreateBulk(bulk...).
		OnConflict(
			sql.ConflictColumns(directlink.FieldFileID),
		).
		DoNothing().
		Exec(ctx)

	if err != nil {
		tx.Rollback()
		return fmt.Errorf("批量创建直链失败: %w", err)
	}

	// 再次查询以获取所有直链（包括已存在的和新创建的）的完整信息
	finalLinks, err := tx.DirectLink.Query().
		Where(directlink.FileIDIn(fileIDs...)).
		All(ctx)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("查询最终直链列表失败: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}

	// 将数据库中的记录信息同步回领域模型
	linkMap := make(map[uint]*ent.DirectLink, len(finalLinks))
	for _, l := range finalLinks {
		linkMap[l.FileID] = l
	}

	for _, link := range links {
		if dbLink, ok := linkMap[link.FileID]; ok {
			link.ID = dbLink.ID
			link.Downloads = dbLink.Downloads
			link.SpeedLimit = dbLink.SpeedLimit
			link.FileName = dbLink.FileName
			link.CreatedAt = dbLink.CreatedAt
			link.UpdatedAt = dbLink.UpdatedAt
		}
	}

	return nil
}

// FindByPublicID 通过公开ID查找直链，并预加载关联的文件信息。
func (r *entDirectLinkRepo) FindByPublicID(ctx context.Context, publicID string) (*model.DirectLink, error) {
	dbID, entityType, err := idgen.DecodePublicID(publicID)
	if err != nil || entityType != idgen.EntityTypeDirectLink {
		return nil, errors.New("invalid direct link public id")
	}

	entLink, err := r.client.DirectLink.Query().
		Where(directlink.ID(uint(dbID))).
		WithFile(func(q *ent.FileQuery) {
			q.WithPrimaryEntity()
		}).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}

	return toDomainDirectLink(entLink), nil
}

// IncrementDownloads 使用原子操作增加下载计数。
func (r *entDirectLinkRepo) IncrementDownloads(ctx context.Context, id uint) error {
	_, err := r.client.DirectLink.UpdateOneID(id).AddDownloads(1).Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return errors.New("直链不存在，无法增加下载计数")
		}
		return fmt.Errorf("增加直链下载计数失败: %w", err)
	}
	return nil
}

// DeleteByFileID 按文件ID删除直链记录
func (r *entDirectLinkRepo) DeleteByFileID(ctx context.Context, fileID uint) error {
	_, err := r.client.DirectLink.Delete().Where(directlink.FileIDEQ(fileID)).Exec(ctx)
	if err != nil {
		return fmt.Errorf("删除文件ID为 %d 的直链记录失败: %w", fileID, err)
	}
	return nil
}

// toDomainDirectLink 将 *ent.DirectLink 转换为 *model.DirectLink.
func toDomainDirectLink(l *ent.DirectLink) *model.DirectLink {
	if l == nil {
		return nil
	}
	domainLink := &model.DirectLink{
		ID:         l.ID,
		CreatedAt:  l.CreatedAt,
		UpdatedAt:  l.UpdatedAt,
		FileID:     l.FileID,
		FileName:   l.FileName,
		Downloads:  l.Downloads,
		SpeedLimit: l.SpeedLimit,
	}
	if l.Edges.File != nil {
		domainLink.File = toDomainFile(l.Edges.File)
	}
	return domainLink
}
