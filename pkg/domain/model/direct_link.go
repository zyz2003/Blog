package model

import "time"

// // DirectLink 是直链的领域模型，它代表了业务逻辑中的直链概念。
type DirectLink struct {
	ID        uint
	CreatedAt time.Time
	UpdatedAt time.Time

	// FileID 关联到具体的文件
	FileID uint

	// FileName 是创建时快照的文件名，用于下载和展示
	FileName string

	// Downloads 是下载次数统计
	Downloads int64

	// SpeedLimit 是创建时快照的速度限制 (B/s)
	SpeedLimit int64

	// 关联的领域对象
	File *File
}
