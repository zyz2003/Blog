package ent

import (
	"context"
	"fmt"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/entity"
)

// entEntityRepository 是 EntityRepository 接口的 Ent 实现。
type entEntityRepository struct {
	client *ent.Client
}

// NewEntEntityRepository 是 entEntityRepository 的构造函数。
func NewEntEntityRepository(client *ent.Client) repository.EntityRepository {
	return &entEntityRepository{client: client}
}

// HardDelete 从数据库中永久删除一个实体记录。
func (r *entEntityRepository) HardDelete(ctx context.Context, id uint) error {
	return r.client.Entity.DeleteOneID(id).Exec(ctx)
}

// SumSizeByIDs 计算并返回一组给定ID的实体的总大小。
func (r *entEntityRepository) SumSizeByIDs(ctx context.Context, ids []uint64) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	uintIDs := make([]uint, len(ids))
	for i, id := range ids {
		uintIDs[i] = uint(id)
	}

	var v []struct {
		Sum int64 `json:"sum"`
	}
	err := r.client.Entity.Query().
		Where(entity.IDIn(uintIDs...)).
		Aggregate(ent.Sum(entity.FieldSize)).
		Scan(ctx, &v)

	if err != nil {
		return 0, err
	}
	if len(v) == 0 {
		return 0, nil
	}

	return v[0].Sum, nil
}

// Create 在数据库中创建一个新的物理实体记录。
func (r *entEntityRepository) Create(ctx context.Context, domainEntity *model.FileStorageEntity) error {
	createBuilder := r.client.Entity.
		Create().
		SetType(string(domainEntity.Type)).
		SetSize(domainEntity.Size).
		SetPolicyID(domainEntity.PolicyID).
		SetStorageMetadata(domainEntity.StorageMetadata)

	if domainEntity.Source.Valid {
		createBuilder.SetSource(domainEntity.Source.String)
	}
	if domainEntity.UploadSessionID.Valid {
		createBuilder.SetUploadSessionID(domainEntity.UploadSessionID.String)
	}
	if domainEntity.RecycleOptions.Valid {
		createBuilder.SetRecycleOptions(domainEntity.RecycleOptions.String)
	}
	if domainEntity.CreatedBy.Valid {
		createBuilder.SetCreatedBy(domainEntity.CreatedBy.Uint64)
	}
	if domainEntity.Etag.Valid {
		createBuilder.SetEtag(domainEntity.Etag.String)
	}
	if domainEntity.MimeType.Valid {
		createBuilder.SetMimeType(domainEntity.MimeType.String)
	}
	if domainEntity.Dimension.Valid {
		createBuilder.SetDimension(domainEntity.Dimension.String)
	}

	created, err := createBuilder.Save(ctx)
	if err != nil {
		return err
	}
	domainEntity.ID = created.ID
	domainEntity.CreatedAt = created.CreatedAt
	domainEntity.UpdatedAt = created.UpdatedAt
	return nil
}

// FindByID 根据ID查找一个物理实体。如果未找到，返回 nil, nil。
func (r *entEntityRepository) FindByID(ctx context.Context, id uint) (*model.FileStorageEntity, error) {
	entEntity, err := r.client.Entity.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return toDomainEntity(entEntity), nil
}

// FindBatchByIDs 根据一组ID批量查找物理实体。
func (r *entEntityRepository) FindBatchByIDs(ctx context.Context, ids []uint) ([]*model.FileStorageEntity, error) {
	if len(ids) == 0 {
		return []*model.FileStorageEntity{}, nil
	}

	entEntities, err := r.client.Entity.Query().Where(entity.IDIn(ids...)).All(ctx)
	if err != nil {
		return nil, err
	}

	domainEntities := make([]*model.FileStorageEntity, len(entEntities))
	for i, p := range entEntities {
		domainEntities[i] = toDomainEntity(p)
	}
	return domainEntities, nil
}

// Update 更新一个已存在的物理实体记录。
func (r *entEntityRepository) Update(ctx context.Context, domainEntity *model.FileStorageEntity) error {
	updateBuilder := r.client.Entity.
		UpdateOneID(domainEntity.ID).
		SetType(string(domainEntity.Type)).
		SetSize(domainEntity.Size).
		SetPolicyID(domainEntity.PolicyID).
		SetStorageMetadata(domainEntity.StorageMetadata)

	if domainEntity.Source.Valid {
		updateBuilder.SetSource(domainEntity.Source.String)
	}
	if domainEntity.UploadSessionID.Valid {
		updateBuilder.SetUploadSessionID(domainEntity.UploadSessionID.String)
	} else {
		updateBuilder.ClearUploadSessionID()
	}
	if domainEntity.RecycleOptions.Valid {
		updateBuilder.SetRecycleOptions(domainEntity.RecycleOptions.String)
	}
	if domainEntity.CreatedBy.Valid {
		updateBuilder.SetCreatedBy(domainEntity.CreatedBy.Uint64)
	}
	if domainEntity.Etag.Valid {
		updateBuilder.SetEtag(domainEntity.Etag.String)
	}
	if domainEntity.MimeType.Valid {
		updateBuilder.SetMimeType(domainEntity.MimeType.String)
	}
	if domainEntity.Dimension.Valid {
		updateBuilder.SetDimension(domainEntity.Dimension.String)
	}

	_, err := updateBuilder.Save(ctx)
	return err
}

// Delete 从数据库中软删除一个实体记录（如果 schema 中有 SoftDeleteMixin）。
// 注意：为了永久删除，请使用 HardDelete。
func (r *entEntityRepository) Delete(ctx context.Context, id uint) error {
	return r.client.Entity.DeleteOneID(id).Exec(ctx)
}

// FindOrphaned 查找所有被遗弃的上传会话所关联的临时实体。
func (r *entEntityRepository) FindOrphaned(ctx context.Context, olderThan time.Time) ([]*model.FileStorageEntity, error) {
	entEntities, err := r.client.Entity.Query().
		Where(
			entity.UploadSessionIDNotNil(),
			entity.UploadSessionIDNEQ(""),
			entity.UpdatedAtLT(olderThan),
		).
		All(ctx)
	if err != nil {
		return nil, err
	}
	domainEntities := make([]*model.FileStorageEntity, len(entEntities))
	for i, p := range entEntities {
		domainEntities[i] = toDomainEntity(p)
	}
	return domainEntities, nil
}

// FindUploadingByOwnerID 查找指定用户所有正在进行的上传任务所关联的临时实体。
func (r *entEntityRepository) FindUploadingByOwnerID(ctx context.Context, ownerID uint) ([]*model.FileStorageEntity, error) {
	entEntities, err := r.client.Entity.Query().
		Where(
			entity.CreatedBy(uint64(ownerID)),
			entity.UploadSessionIDNotNil(),
			entity.UploadSessionIDNEQ(""),
		).
		All(ctx)
	if err != nil {
		return nil, err
	}
	domainEntities := make([]*model.FileStorageEntity, len(entEntities))
	for i, p := range entEntities {
		domainEntities[i] = toDomainEntity(p)
	}
	return domainEntities, nil
}

// Transaction 在一个数据库事务中执行一系列操作。
// 如果函数返回错误，事务将回滚；否则，事务将提交。
func (r *entEntityRepository) Transaction(ctx context.Context, fn func(repo repository.EntityRepository) error) error {
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return err
	}
	txRepo := NewEntEntityRepository(tx.Client())
	defer func() {
		if v := recover(); v != nil {
			_ = tx.Rollback()
			panic(v)
		}
	}()
	if err := fn(txRepo); err != nil {
		if rerr := tx.Rollback(); rerr != nil {
			err = fmt.Errorf("事务执行失败: %w, 回滚事务也失败: %v", err, rerr)
		}
		return err
	}
	return tx.Commit()
}

// CountEntityByStoragePolicyID 统计指定存储策略下的实体数量和总大小。
func (r *entEntityRepository) CountEntityByStoragePolicyID(ctx context.Context, policyID uint) (count int64, totalSize int64, err error) {
	// 统计数量
	countResult, err := r.client.Entity.Query().
		Where(entity.PolicyID(policyID)).
		Count(ctx)
	if err != nil {
		return 0, 0, fmt.Errorf("统计实体数量失败: %w", err)
	}
	count = int64(countResult)

	if count == 0 {
		return 0, 0, nil
	}

	// 统计总大小
	var v []struct {
		Sum int64 `json:"sum"`
	}
	err = r.client.Entity.Query().
		Where(entity.PolicyID(policyID)).
		Aggregate(ent.Sum(entity.FieldSize)).
		Scan(ctx, &v)
	if err != nil {
		return 0, 0, fmt.Errorf("统计实体总大小失败: %w", err)
	}

	if len(v) > 0 {
		totalSize = v[0].Sum
	}

	return count, totalSize, nil
}

// IsStoragePolicyUsedByEntities 检查指定的存储策略是否被任何实体使用。
func (r *entEntityRepository) IsStoragePolicyUsedByEntities(ctx context.Context, policyID uint) (bool, error) {
	count, err := r.client.Entity.Query().
		Where(entity.PolicyID(policyID)).
		Count(ctx)
	if err != nil {
		return false, fmt.Errorf("检查存储策略使用情况失败: %w", err)
	}
	return count > 0, nil
}

// FindByStoragePolicyID 查找指定存储策略下的所有实体。
func (r *entEntityRepository) FindByStoragePolicyID(ctx context.Context, policyID uint) ([]*model.FileStorageEntity, error) {
	entEntities, err := r.client.Entity.Query().
		Where(entity.PolicyID(policyID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("查找存储策略下的实体失败: %w", err)
	}

	domainEntities := make([]*model.FileStorageEntity, len(entEntities))
	for i, e := range entEntities {
		domainEntities[i] = toDomainEntity(e)
	}
	return domainEntities, nil
}

// DeleteByStoragePolicyID 删除指定存储策略下的所有实体记录。
func (r *entEntityRepository) DeleteByStoragePolicyID(ctx context.Context, policyID uint) error {
	_, err := r.client.Entity.Delete().
		Where(entity.PolicyID(policyID)).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("删除存储策略下的实体失败: %w", err)
	}
	return nil
}

// --- 数据转换辅助函数 ---

// toDomainEntity 将 ent 生成的实体对象转换为自定义的领域模型对象。
func toDomainEntity(e *ent.Entity) *model.FileStorageEntity {
	if e == nil {
		return nil
	}
	domain := &model.FileStorageEntity{
		ID:        e.ID,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
		Type:      model.EntityType(e.Type),
		Size:      e.Size,
		PolicyID:  e.PolicyID,
	}

	if e.Source != nil {
		domain.Source.String = *e.Source
		domain.Source.Valid = true
	}
	if e.UploadSessionID != nil {
		domain.UploadSessionID.String = *e.UploadSessionID
		domain.UploadSessionID.Valid = true
	}
	if e.RecycleOptions != nil {
		domain.RecycleOptions.String = *e.RecycleOptions
		domain.RecycleOptions.Valid = true
	}
	if e.CreatedBy != nil {
		domain.CreatedBy = types.NullUint64{Uint64: *e.CreatedBy, Valid: true}
	}
	if e.Etag != nil {
		domain.Etag.String = *e.Etag
		domain.Etag.Valid = true
	}
	if e.MimeType != nil {
		domain.MimeType.String = *e.MimeType
		domain.MimeType.Valid = true
	}
	if e.Dimension != nil {
		domain.Dimension.String = *e.Dimension
		domain.Dimension.Valid = true
	}
	if e.StorageMetadata != nil {
		domain.StorageMetadata = e.StorageMetadata
	} else {
		domain.StorageMetadata = make(map[string]interface{})
	}

	return domain
}
