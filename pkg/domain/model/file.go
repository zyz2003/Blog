package model

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
)

// FileType 定义文件或目录的类型。
type FileType int

const (
	FileTypeFile FileType = 1 // 普通文件
	FileTypeDir  FileType = 2 // 目录
)

// ColumnType 定义了文件列表视图中可以显示的列的类型
type ColumnType int

const (
	ColumnTypeName        ColumnType = 0 // 文件名
	ColumnTypeSize        ColumnType = 1 // 大小
	ColumnTypeUpdatedAt   ColumnType = 2 // 修改时间
	ColumnTypeCreatedAt   ColumnType = 3 // 创建时间
	ColumnTypeOwner       ColumnType = 4 // 所有者
	ColumnTypePermissions ColumnType = 5 // 权限
)

// String 方法用于返回 FileType 的字符串表示。
func (ft FileType) String() string {
	switch ft {
	case FileTypeFile:
		return "file"
	case FileTypeDir:
		return "folder"
	default:
		// 如果遇到未知的 FileType 值，打印其整数值以便调试
		return fmt.Sprintf("unknown_type_%d", ft)
	}
}

// ToDomainType 方法用于确保向领域模型转换时类型的兼容性。
// 在这里，由于 FileType 是领域模型中的类型，所以直接返回自身即可。
func (ft FileType) ToDomainType() FileType {
	return ft
}

// FileTreeNode 代表文件夹树中的一个文件节点
// 用于“浏览器端打包下载”功能，告诉前端需要下载哪些文件。
type FileTreeNode struct {
	URL          string `json:"url"`           // 文件的可直接下载的URL (一定是签名的)
	RelativePath string `json:"relative_path"` // 文件相对于被下载文件夹根目录的路径，例如 "images/avatar.jpg"
	Size         int64  `json:"size"`          // 文件大小，便于前端预估总大小和显示进度
}

type FolderTreeResponse struct {
	FolderName string          `json:"folder_name"`
	Files      []*FileTreeNode `json:"files"`
	Expires    time.Time       `json:"expires"`
}

// File 是核心文件/目录的领域模型。
// 它代表了文件或目录在业务逻辑中的概念，独立于其持久化实现
type File struct {
	ID        uint          // 数据库主键 ID
	CreatedAt time.Time     // 创建时间
	UpdatedAt time.Time     // 更新时间
	OwnerID   uint          // 所属用户ID
	ParentID  sql.NullInt64 // 父目录ID，如果为根目录则为NULL
	Name      string        // 文件/目录名称
	Size      int64         // 文件大小 (字节)，目录通常为0
	Type      FileType      // 类型：文件或目录

	// PrimaryEntityID 关联到 FileStorageEntity，表示当前文件指向的物理存储实体ID。
	// 使用 NullUint64 是因为目录或空文件可能没有对应的物理存储实体。
	PrimaryEntityID types.NullUint64 // 引用公共的 types.NullUint64

	// PrimaryEntity 是关联的物理存储实体领域对象。
	PrimaryEntity *FileStorageEntity // 关联到新的 FileStorageEntity 领域模型 (此处为指针类型)

	// ChildrenCount 表示当前目录下直属子文件/子目录的数量。
	ChildrenCount int64

	// ViewConfig 用于存储目录的视图配置，以 JSON 字符串形式存储。
	// 对于文件，此字段通常为空。
	ViewConfig sql.NullString

	// Metas 用于在业务逻辑中持有从 metadata 表加载的数据。
	// 此字段没有任何标签，它只存在于内存中的领域对象上。
	Metas map[string]string
}

// --- 文件列表及详情相关的模型 ---

// AnZhiYu 使用的 文件 URI 符合传统的 URL 标准。当对一个 文件 URI 视作标准 URL 进行解析时，会得到以下部分：
// anzhiyu://VoMFL:2rje2bdj@share/folder/child?name=my+file
// Protocol User Password Host Path Query
// FileItem 是一个专门用于API响应的、丰富的文件/目录模型。
// 这一 URI 表示的意思是：使用密码 2rje2bdj 访问分享 ID 为 VoMFL 的分享链接，列出 folder/child 目录下所有文件名包含 my file 的文件。
// Protocol 协议名: 固定为 anzhiyu

// Host 主机名 - 文件系统类型 定义了文件所在文件系统的类型。
// my: 我的文件；默认为当前请求认证的用户的文件，也可在 User 中填入其他用户的 ID 来访问其他用户的文件，比如 anzhiyu://luPa@my，只有管理员可以通过 my 访问其他用户的文件。
// shared_with_me: 与我共享；
// trash: 回收站；
// User 用户名 - 文件系统 ID
// anzhiyu 使用 User 部分来指定文件系统 ID。

// 对于 my 文件系统，User 为用户 ID，留空时为当前请求认证的用户的 ID；
// 对于 shared_with_me 文件系统，User 不能为空，为分享链接 ID；
// Password 密码 - 文件系统密码
// 目前只有 share 文件系统使用 Password 部分。当分享链接为非公开时，需要通过 Password 部分来指定访问密码，anzhiyu 会生成密码，并直接包含在创建者得到的分享链接中。
// Path 路径 - 文件路径
// 文件路径，用于指定文件在文件系统中的位置。
// Query 查询参数 - 搜索条件
// 文件搜索条件，用于指定文件搜索条件，只适用于列取文件的 API。对于操作指定文件的 API（删除、更新 等），这一部分会被忽略。

// PreviewURLItem 包含单个预览文件的URL和元信息
type PreviewURLItem struct {
	URL      string `json:"url"`
	FileID   string `json:"file_id"`
	FileName string `json:"file_name"`
	FileSize int64  `json:"file_size"`
}

type FileItem struct {
	// 基础信息
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Type         int       `json:"type"` // 1: file, 2: folder
	Size         int64     `json:"size"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	ThumbnailURL string    `json:"thumbnail_url,omitempty"`

	// 路径和归属信息
	Path   string `json:"path"`          // 文件的完整虚拟路径，如 "anzhiyu://my/images/avatar.jpg"
	Owned  bool   `json:"owned"`         // 当前登录用户是否是此文件的所有者
	Shared bool   `json:"shared"`        // 文件是否被分享 (暂定，后续实现)
	URL    string `json:"url,omitempty"` // 文件的访问 URL，通常是物理存储的直接链接

	// 元数据和权限
	Metadata              map[string]string `json:"metadata,omitempty"`       // 文件的元数据，例如 {"thumb": "true"}
	Permission            interface{}       `json:"permission"`               // 权限详情 (暂定为 nil)
	Capability            string            `json:"capability"`               // 能力描述 (暂定，后续实现)
	PrimaryEntityPublicID string            `json:"primary_entity_public_id"` // 物理存储实体的公共ID
}

// ViewColumn 代表视图中的一列配置
type ViewColumn struct {
	Type  ColumnType `json:"type"`
	Width *int       `json:"width,omitempty"`
}

// View 定义了前端当前路径的视图设置。
type View struct {
	View           string `json:"view" binding:"required,oneof=list grid"` // 视图模式必须是 'list' 或 'grid'
	Order          string `json:"order" binding:"required"`
	PageSize       int    `json:"page_size" binding:"required,gt=0"`                 // 页面大小必须大于0
	OrderDirection string `json:"order_direction" binding:"required,oneof=asc desc"` // 排序方向必须是 'asc' 或 'desc'
	// omitempty: 如果前端请求中没有这个字段，则忽略，不会导致校验失败。
	// dive: 如果有这个字段且是数组，gin会深入到数组内部对每个元素进行校验（如果需要的话）。
	Columns []ViewColumn `json:"columns,omitempty" binding:"dive"`
}
type UpdateViewConfigRequest struct {
	FolderPublicID string `json:"folder_id" binding:"required"`
	View           View   `json:"view" binding:"required"`
}

// FileListResponse 对应获取文件列表 API 的完整响应体结构。
type FileListResponse struct {
	Files         []*FileItem        `json:"files"`
	Parent        *FileItem          `json:"parent"`
	Pagination    *Pagination        `json:"pagination"`
	Props         *Props             `json:"props"`
	ContextHint   string             `json:"context_hint"`   // 上下文提示，可用于实现更复杂的客户端逻辑
	StoragePolicy *StoragePolicyInfo `json:"storage_policy"` // 当前目录关联的存储策略信息
	View          *View              `json:"view"`           // 前端视图设置
}

// Pagination 定义了分页相关的信息，采用基于游标的模式，不包含总数。
type Pagination struct {
	// Page 字段保留，用于提供上下文，例如第一页时为1，之后为0。
	Page int `json:"page"`

	// PageSize 是本次请求返回的项目数量。
	PageSize int `json:"page_size"`

	// NextToken 是用于获取下一页数据的凭证（游标）。
	// 如果此值为空字符串 ""，表示没有更多数据了。
	NextToken string `json:"next_token,omitempty"`

	// IsCursor 明确告知前端当前分页模式是否为基于游标。
	IsCursor bool `json:"is_cursor"`
}

// Props 定义了当前视图支持的能力，比如排序选项
type Props struct {
	OrderByOptions        []string `json:"order_by_options"`
	OrderDirectionOptions []string `json:"order_direction_options"`
}

// CreateFileRequest 对应“创建空文件或目录”API的请求体
type CreateFileRequest struct {
	URI           string `json:"uri" binding:"required"`
	Type          int    `json:"type" binding:"required,oneof=1 2"`
	ErrOnConflict bool   `json:"err_on_conflict"`
}

// DeleteItemsRequest 对应删除文件/文件夹的请求体
type DeleteItemsRequest struct {
	IDs []string `json:"ids" binding:"required,min=1"`
}

// RenameItemRequest 对应重命名文件或文件夹的请求体
type RenameItemRequest struct {
	// 要重命名的文件或文件夹的公共ID
	ID string `json:"id" binding:"required"`
	// 新的名称
	NewName string `json:"new_name" binding:"required"`
}

// FileInfoTuple 是一个轻量级的数据结构，用于从数据库中高效地获取计算所需的信息。
type FileInfoTuple struct {
	Size            int64
	PrimaryEntityID uint64
}

// FolderSize 封装了文件夹大小的计算结果。
type FolderSize struct {
	LogicalSize        int64 `json:"logicalSize"`        // 逻辑大小：所有文件大小之和
	StorageConsumption int64 `json:"storageConsumption"` // 占用空间：唯一物理实体大小之和
	FileCount          int64 `json:"fileCount"`          // 包含的文件总数
}

// MoveItemsRequest 对应移动文件/文件夹的请求体
type MoveItemsRequest struct {
	SourceIDs     []string `json:"sourceIDs" binding:"required,min=1"` // 一个或多个待移动项的公共ID
	DestinationID string   `json:"destinationID" binding:"required"`   // 目标文件夹的公共ID
}

// CopyItemsRequest 对应复制文件/文件夹的请求体
type CopyItemsRequest struct {
	SourceIDs     []string `json:"sourceIDs" binding:"required,min=1"`
	DestinationID string   `json:"destinationID" binding:"required"`
}

// UpdateResult DTO 用于返回更新操作的结果
type UpdateResult struct {
	PublicID  string    `json:"id"`
	Size      int64     `json:"size"`
	UpdatedAt time.Time `json:"updated"`
}

// FileInfoResponse 是 GetFileInfo 接口专用的响应模型，
// 它包装了标准的文件信息和额外的存储策略信息。
type FileInfoResponse struct {
	File          *FileItem          `json:"file"`
	StoragePolicy *StoragePolicyInfo `json:"storagePolicy,omitempty"`
}
