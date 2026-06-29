package ent

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/metadata"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"entgo.io/ent/dialect/sql"
)

type entMetadataRepo struct {
	client *ent.Client
}

// NewEntMetadataRepository 是 entMetadataRepo 的构造函数
func NewEntMetadataRepository(client *ent.Client) repository.MetadataRepository {
	return &entMetadataRepo{client: client}
}

// ResetThumbnailMetadataForFileIDs 使用一条数据库命令批量删除多个文件的缩略图元数据。
func (r *entMetadataRepo) ResetThumbnailMetadataForFileIDs(ctx context.Context, fileIDs []uint) error {
	keysToDelete := []string{
		string(model.MetaKeyThumbStatus),
		string(model.MetaKeyThumbError),
		string(model.MetaKeyThumbRetryCount),
		string(model.MetaKeyThumbFormat),
	}

	// 使用 Ent 的批量删除功能
	_, err := r.client.Metadata.
		Delete().
		Where(
			metadata.FileIDIn(fileIDs...),
			metadata.NameIn(keysToDelete...),
		).
		Exec(ctx)

	return err
}

// DeleteByFileID 实现了接口
func (r *entMetadataRepo) DeleteByFileID(ctx context.Context, fileID uint) error {
	_, err := r.client.Metadata.Delete().
		Where(metadata.FileID(fileID)).
		Exec(ctx)
	return err
}

// Set 实现了接口
func (r *entMetadataRepo) Set(ctx context.Context, meta *model.Metadata) error {
	return r.client.Metadata.
		Create().
		SetFileID(meta.FileID).
		SetName(meta.Name).
		SetValue(meta.Value).
		OnConflict(
			sql.ConflictColumns(metadata.FieldFileID, metadata.FieldName),
		).
		UpdateValue().
		Exec(ctx)
}

// Get 实现了接口
func (r *entMetadataRepo) Get(ctx context.Context, fileID uint, name string) (*model.Metadata, error) {
	metaPO, err := r.client.Metadata.Query().
		Where(
			metadata.FileID(fileID),
			metadata.Name(name),
		).Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return nil, constant.ErrNotFound
		}
		return nil, err
	}
	return toDomainMetadata(metaPO), nil
}

// GetAll 实现了接口
func (r *entMetadataRepo) GetAll(ctx context.Context, fileID uint) ([]*model.Metadata, error) {
	pos, err := r.client.Metadata.Query().
		Where(metadata.FileID(fileID)).
		All(ctx)

	if err != nil {
		return nil, err
	}
	models := make([]*model.Metadata, len(pos))
	for i := range pos {
		models[i] = toDomainMetadata(pos[i])
	}
	return models, nil
}

// Delete 实现了接口
func (r *entMetadataRepo) Delete(ctx context.Context, fileID uint, name string) error {
	_, err := r.client.Metadata.Delete().
		Where(
			metadata.FileID(fileID),
			metadata.Name(name),
		).
		Exec(ctx)
	return err
}

// toDomainMetadata 是一个辅助函数
func toDomainMetadata(p *ent.Metadata) *model.Metadata {
	if p == nil {
		return nil
	}
	domainMeta := &model.Metadata{
		ID:        p.ID,
		CreatedAt: p.CreatedAt,
		UpdatedAt: p.UpdatedAt,
		Name:      p.Name,
		Value:     p.Value,
		FileID:    p.FileID,
	}
	if p.DeletedAt != nil {
		domainMeta.DeletedAt = p.DeletedAt
	}
	return domainMeta
}
