/*
 * @Description: 元数据模型
 * @Author: 安知鱼
 * @Date: 2025-07-10 13:49:43
 * @LastEditTime: 2025-07-18 18:26:08
 * @LastEditors: 安知鱼
 */
package model

import "time"

// Metadata 代表一个文件的单个元数据项 (纯粹的业务模型)
type Metadata struct {
	ID        uint
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time // 使用指针类型表示可为 null

	Name  string // 元数据键名
	Value string // 元数据值

	FileID uint // 关联的文件ID
}

// MetaKey 定义了存储在 Metadata 表中的 Name 字段的常量
const (
	MetaKeyThumbSource     = "thumb_source"      // 缩略图来源
	MetaKeyThumbFormat     = "thumb_format"      // 缩略图格式
	MetaKeyPhysicalName    = "physical_name"     // 物理文件名
	MetaKeyThumbStatus     = "thumb_status"      // 缩略图状态
	MetaKeyThumbError      = "thumb_error"       // 缩略图生成错误信息
	MetaKeyThumbRetryCount = "thumb_retry_count" // 缩略图重试次数
	MetaKeyDuration        = "duration"          // 视频时长
	MetaKeyWidth           = "width"             // 图片/视频宽度
	MetaKeyHeight          = "height"            // 图片/视频高度

	// --- EXIF 元数据键 ---
	MetaKeyExifMake         = "exif_make"          // 相机制造商
	MetaKeyExifModel        = "exif_model"         // 相机型号
	MetaKeyExifSoftware     = "exif_software"      // 软件
	MetaKeyExifDateTime     = "exif_date_time"     // 拍摄时间
	MetaKeyExifExposureTime = "exif_exposure_time" // 曝光时间
	MetaKeyExifFNumber      = "exif_f_number"      // F数(光圈)
	MetaKeyExifISOSpeed     = "exif_iso_speed"     // ISO速度
	MetaKeyExifFocalLength  = "exif_focal_length"  // 焦距

	// --- 音乐元数据键 ---
	MetaKeyMusicFormat      = "music_format"       // 音乐格式 (e.g., "MPEG-Layer 3")
	MetaKeyMusicTitle       = "music_title"        // 标题
	MetaKeyMusicAlbum       = "music_album"        // 专辑
	MetaKeyMusicArtist      = "music_artist"       // 艺术家
	MetaKeyMusicAlbumArtist = "music_album_artist" // 专辑艺术家
	MetaKeyMusicComposer    = "music_composer"     // 作曲家
	MetaKeyMusicGenre       = "music_genre"        // 流派
	MetaKeyMusicYear        = "music_year"         // 年份
)

// MetaValue 定义了 thumb_status 可能的值
const (
	MetaValueStatusNotAvailable = "not_available"
	MetaValueStatusProcessing   = "processing"
	MetaValueStatusReady        = "ready"
	MetaValueStatusFailed       = "failed"
	MetaValueStatusReadyDirect  = "ready_direct" // 直接服务的文件类型，如 SVG
)
