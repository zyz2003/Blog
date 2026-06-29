/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-02 00:43:46
 * @LastEditTime: 2025-08-18 16:55:16
 * @LastEditors: 安知鱼
 */
// internal/domain/repository/transaction.go
package repository

import "context"

// Repositories 结构体聚合了所有在单个事务中可能用到的仓储接口。
type Repositories struct {
	File           FileRepository
	Entity         EntityRepository
	FileEntity     FileEntityRepository
	Metadata       MetadataRepository
	StoragePolicy  StoragePolicyRepository
	DirectLink     DirectLinkRepository
	User           UserRepository
	UserGroup      UserGroupRepository
	Article        ArticleRepository
	ArticleHistory ArticleHistoryRepository
	PostTag        PostTagRepository
	PostCategory   PostCategoryRepository
	DocSeries      DocSeriesRepository
	Link           LinkRepository
	LinkCategory   LinkCategoryRepository
	LinkTag        LinkTagRepository
}

// TransactionManager 定义了事务管理器的接口。
// 它的职责是执行一个业务逻辑单元，并确保其中的所有数据库操作都在单个事务中完成。
type TransactionManager interface {
	// Do 方法接收一个函数，该函数会在一个事务中被调用。
	// 它向该函数提供一个包含所有事务性仓储的 Repositories 实例。
	// 如果函数返回错误，事务将回滚；否则，事务将提交。
	Do(ctx context.Context, fn func(repos Repositories) error) error
}
