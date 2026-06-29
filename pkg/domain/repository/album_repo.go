/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-20 13:07:00
 * @LastEditTime: 2025-06-30 10:06:22
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// CreationStatus 定义了创建/恢复操作的结果状态
type CreationStatus int

const (
	StatusError    CreationStatus = iota // 发生错误
	StatusCreated  CreationStatus = 1    // 记录被新创建
	StatusExisted  CreationStatus = 2    // 记录已存在且处于活动状态（本次为覆盖更新）
	StatusRestored CreationStatus = 3    // 记录已存在但被软删除，本次操作将其恢复并更新
)

// AlbumQueryOptions 定义了查询相册时的过滤条件。
// 它嵌入了通用的分页参数，并添加了 Album 特有的过滤字段。
type AlbumQueryOptions struct {
	PageQuery  // 嵌入通用的分页参数 Page 和 PageSize
	CategoryID *uint
	Tag        string
	Start      *time.Time
	End        *time.Time
	Sort       string
}

// AlbumSearchOptions 定义了相册公开搜索的过滤条件。
type AlbumSearchOptions struct {
	Query string
	Limit int
}

// AlbumRepository 定义了相册数据操作的契约。
type AlbumRepository interface {
	// 嵌入基础接口，自动获得 FindByID, Create, Update, Delete 等通用方法
	BaseRepository[model.Album]

	// CreateOrRestore 原子性地处理相册的创建或恢复，是处理用户上传图片的核心方法。
	CreateOrRestore(ctx context.Context, album *model.Album) (finalAlbum *model.Album, status CreationStatus, err error)

	// FindListByOptions 是一个更具体、更易于业务层使用的列表查询方法。
	FindListByOptions(ctx context.Context, opts AlbumQueryOptions) (*PageResult[model.Album], error)

	// SearchPublicAlbums 搜索前台可见相册。
	SearchPublicAlbums(ctx context.Context, opts AlbumSearchOptions) (*PageResult[model.Album], error)

	// IncrementViewCount 增加指定ID相册的查看次数
	IncrementViewCount(ctx context.Context, id uint) error

	// IncrementDownloadCount 增加指定ID相册的下载次数
	IncrementDownloadCount(ctx context.Context, id uint) error

	// BatchDelete 批量删除相册
	BatchDelete(ctx context.Context, ids []uint) (int, error)
}
