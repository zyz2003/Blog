/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-13 23:40:12
 * @LastEditTime: 2025-08-18 18:33:59
 * @LastEditors: 安知鱼
 */
package ent

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"github.com/anzhiyu-c/anheyu-app/ent"
)

// entTransactionManager 是最终的、完全基于 Ent 的事务管理器实现。
type entTransactionManager struct {
	entClient *ent.Client
	db        *sql.DB // 用于需要原生SQL的仓库 (如 file_repo)
	dbType    string
}

// NewEntTransactionManager 是 entTransactionManager 的构造函数。
func NewEntTransactionManager(client *ent.Client, db *sql.DB, dbType string) repository.TransactionManager {
	return &entTransactionManager{
		entClient: client,
		db:        db,
		dbType:    dbType,
	}
}

// Do 实现了 TransactionManager 接口。
// 它会开启一个 Ent 事务，并将 Repositories 结构体中定义的所有仓库包裹在这个事务中。
func (tm *entTransactionManager) Do(ctx context.Context, fn func(repos repository.Repositories) error) error {
	// 开启一个 Ent 事务
	tx, err := tm.entClient.Tx(ctx)
	if err != nil {
		return fmt.Errorf("开启 Ent 事务失败: %w", err)
	}

	// 使用 defer 来确保事务的提交或回滚
	defer func() {
		if v := recover(); v != nil {
			tx.Rollback()
			panic(v)
		}
	}()

	repos := repository.Repositories{
		File:           NewEntFileRepository(tx.Client(), tm.db, tm.dbType),
		Entity:         NewEntEntityRepository(tx.Client()),
		FileEntity:     NewEntFileEntityRepository(tx.Client()),
		Metadata:       NewEntMetadataRepository(tx.Client()),
		StoragePolicy:  NewEntStoragePolicyRepository(tx.Client()),
		DirectLink:     NewEntDirectLinkRepository(tx.Client()),
		User:           NewEntUserRepository(tx.Client()),
		UserGroup:      NewEntUserGroupRepository(tx.Client()),
		Article:        NewArticleRepo(tx.Client(), tm.dbType),
		ArticleHistory: NewArticleHistoryRepo(tx.Client()),
		PostTag:        NewPostTagRepo(tx.Client(), tm.dbType),
		PostCategory:   NewPostCategoryRepo(tx.Client()),
		DocSeries:      NewDocSeriesRepo(tx.Client()),
		Link:           NewLinkRepo(tx.Client(), tm.dbType),
		LinkCategory:   NewLinkCategoryRepo(tx.Client()),
		LinkTag:        NewLinkTagRepo(tx.Client()),
	}

	// 执行业务逻辑
	if err := fn(repos); err != nil {
		// 如果业务逻辑出错，回滚 Ent 事务
		if rerr := tx.Rollback(); rerr != nil {
			return fmt.Errorf("事务执行失败: %w, 回滚事务也失败: %v", err, rerr)
		}
		return err
	}

	// 如果业务逻辑成功，提交 Ent 事务
	return tx.Commit()
}
