package ent

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/setting"
)

// entSettingRepository 是 SettingRepository 接口的 Ent 实现
type entSettingRepository struct {
	client *ent.Client
}

// NewEntSettingRepository 是 entSettingRepository 的构造函数
func NewEntSettingRepository(client *ent.Client) repository.SettingRepository {
	return &entSettingRepository{
		client: client,
	}
}

// Update 实现了批量更新配置项的接口
// 为了保证原子性，整个更新过程在一个 Ent 事务中执行。
func (r *entSettingRepository) Update(ctx context.Context, settingsToUpdate map[string]string) error {
	// 开启一个 Ent 事务
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("开启事务失败: %w", err)
	}

	// 使用 Ent 推荐的模式来处理事务，确保在发生 panic 时也能回滚
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	// 遍历所有需要更新的配置项
	for key, value := range settingsToUpdate {
		// 使用事务客户端 tx 来更新数据
		_, err := tx.Setting.
			Update().
			Where(
				setting.ConfigKey(key),
				setting.DeletedAtIsNil(),
			).
			SetValue(value).
			Save(ctx)

		if err != nil {
			// 如果任何一个更新失败，立即回滚并返回错误
			if rbErr := tx.Rollback(); rbErr != nil {
				return fmt.Errorf("更新配置失败: %v, 回滚事务也失败: %v", err, rbErr)
			}
			return err
		}
	}

	// 如果所有更新都成功，提交事务
	return tx.Commit()
}

// Upsert 实现「存在则更新、不存在则插入」，保证导入的配置项能全覆盖本地（包括本地从未存在过的键）
func (r *entSettingRepository) Upsert(ctx context.Context, settings map[string]string) error {
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("开启事务失败: %w", err)
	}
	defer func() {
		if v := recover(); v != nil {
			tx.Rollback()
			panic(v)
		}
	}()

	for key, value := range settings {
		n, err := tx.Setting.
			Update().
			Where(
				setting.ConfigKey(key),
				setting.DeletedAtIsNil(),
			).
			SetValue(value).
			Save(ctx)
		if err != nil {
			if rbErr := tx.Rollback(); rbErr != nil {
				return fmt.Errorf("更新配置失败: %v, 回滚事务也失败: %v", err, rbErr)
			}
			return err
		}
		if n == 0 {
			_, err = tx.Setting.
				Create().
				SetConfigKey(key).
				SetValue(value).
				Save(ctx)
			if err != nil {
				if rbErr := tx.Rollback(); rbErr != nil {
					return fmt.Errorf("插入配置失败: %v, 回滚事务也失败: %v", err, rbErr)
				}
				return err
			}
		}
	}

	return tx.Commit()
}

// FindByKey 实现按键查找配置的接口
func (r *entSettingRepository) FindByKey(ctx context.Context, key string) (*model.Setting, error) {
	entSetting, err := r.client.Setting.
		Query().
		Where(
			setting.ConfigKey(key),
			setting.DeletedAtIsNil(),
		).
		Only(ctx) // Only 确保只返回一条记录，否则报错

	if err != nil {
		// Ent 会返回一个特定的 ent.NotFoundError，可以用它来判断
		if ent.IsNotFound(err) {
			return nil, nil //未找到时不返回错误
		}
		return nil, err
	}
	return toDomainSetting(entSetting), nil
}

// Save 实现保存（创建或更新）配置的接口
func (r *entSettingRepository) Save(ctx context.Context, s *model.Setting) error {
	// 如果领域模型的 ID 为 0，认为是创建新记录
	if s.ID == 0 {
		created, err := r.client.Setting.
			Create().
			SetConfigKey(s.ConfigKey).
			SetValue(s.Value).
			SetComment(s.Comment).
			// CreatedAt 和 UpdatedAt 字段由 Schema 中的 Default/UpdateDefault 自动处理
			Save(ctx)
		if err != nil {
			return err
		}
		// 创建成功后，将数据库生成的 ID 和时间戳同步回领域模型
		s.ID = uint(created.ID)
		s.CreatedAt = created.CreatedAt
		s.UpdatedAt = created.UpdatedAt
		return nil
	}

	// 如果 ID 不为 0，认为是更新现有记录
	updated, err := r.client.Setting.
		UpdateOneID(int(s.ID)).
		SetValue(s.Value).
		SetComment(s.Comment).
		Save(ctx)
	if err != nil {
		return err
	}
	// 更新成功后，同步时间戳
	s.UpdatedAt = updated.UpdatedAt
	return nil
}

// FindAll 实现获取所有配置的接口
func (r *entSettingRepository) FindAll(ctx context.Context) ([]*model.Setting, error) {
	entSettings, err := r.client.Setting.
		Query().
		Where(setting.DeletedAtIsNil()).
		All(ctx)
	if err != nil {
		return nil, err
	}

	// 将 []*ent.Setting 列表转换为 []*model.Setting 列表
	domainSettings := make([]*model.Setting, len(entSettings))
	for i, po := range entSettings {
		domainSettings[i] = toDomainSetting(po)
	}
	return domainSettings, nil
}

// --- 数据转换辅助函数 (Mapping Helper) ---

// toDomainSetting 将 *ent.Setting (持久化对象) 转换为 *model.Setting (领域模型)
func toDomainSetting(s *ent.Setting) *model.Setting {
	if s == nil {
		return nil
	}
	return &model.Setting{
		ID:        uint(s.ID),
		CreatedAt: s.CreatedAt,
		UpdatedAt: s.UpdatedAt,
		ConfigKey: s.ConfigKey,
		Value:     s.Value,
		Comment:   s.Comment,
	}
}
