/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-23 15:10:56
 * @LastEditTime: 2025-08-29 10:13:27
 * @LastEditors: 安知鱼
 */
package constant

// StoragePolicyType 定义了存储策略的类型，提供了更强的类型安全
type StoragePolicyType string

// 定义支持的存储策略类型常量
const (
	PolicyTypeLocal      StoragePolicyType = "local"
	PolicyTypeOneDrive   StoragePolicyType = "onedrive"
	PolicyTypeTencentCOS StoragePolicyType = "tencent_cos"
	PolicyTypeAliOSS     StoragePolicyType = "aliyun_oss"
	PolicyTypeS3         StoragePolicyType = "aws_s3"
	PolicyTypeQiniu      StoragePolicyType = "qiniu_kodo"
	PolicyTypeUpyun      StoragePolicyType = "upyun"

	// SecretValueMask 是 API 响应中表示敏感字段已配置的固定占位符。
	SecretValueMask = "********"

	// UploadMethodSettingKey 是存储策略中定义上传方式的键
	UploadMethodSettingKey = "upload_method"
	// OneDriveClientIDSettingKey 是 OneDrive 策略中定义客户端 ID 的键
	DriveTypeSettingKey = "drive_type"
	// AllowedExtensionsSettingKey 是存储策略中定义允许扩展名列表的键
	AllowedExtensionsSettingKey = "allowed_extensions"
	// StyleSeparatorSettingKey 是存储策略中定义样式分隔符的键（用于腾讯云COS和阿里云OSS的图片处理参数）
	StyleSeparatorSettingKey = "style_separator"

	// ImageProcessSettingsKey 是存储策略 Settings JSON 中 image_process 配置块的键名。
	// 对应 model.ImageProcessConfig，控制样式处理的启用与默认样式。
	ImageProcessSettingsKey = "image_process"
	// ImageStylesSettingsKey 是存储策略 Settings JSON 中 image_styles 配置块的键名。
	// 对应 []model.ImageStyleConfig，保存该策略下所有命名样式。
	ImageStylesSettingsKey = "image_styles"

	// UploadMethodServer 代表服务端中转上传
	UploadMethodServer = "server"
	// UploadMethodClient 代表客户端直传
	UploadMethodClient = "client"
)

// Storage Policy Flags
const (
	PolicyFlagArticleImage = "article_image" // PolicyFlagArticleImage 标志着用于文章图片的策略 & 默认的VFS目录
	PolicyFlagCommentImage = "comment_image" // PolicyFlagCommentImage 标志着用于评论图片的策略 & 默认的VFS目录
	PolicyFlagUserAvatar   = "user_avatar"   // PolicyFlagUserAvatar 标志着用于用户头像的策略 & 默认的VFS目录
)

// Default Storage Policy configurations
const (
	DefaultArticlePolicyName = "内置-文章图片"
	DefaultCommentPolicyName = "内置-评论图片"
	DefaultAvatarPolicyName  = "内置-用户头像"
	DefaultArticlePolicyPath = "data/storage/article_image" // 相对于应用根目录
	DefaultCommentPolicyPath = "data/storage/comment_image" // 相对于应用根目录
	DefaultAvatarPolicyPath  = "data/storage/user_avatar"   // 相对于应用根目录
)

// IsValid 检查给定的类型是否是受支持的存储策略类型
func (t StoragePolicyType) IsValid() bool {
	switch t {
	case PolicyTypeLocal, PolicyTypeOneDrive, PolicyTypeTencentCOS, PolicyTypeAliOSS, PolicyTypeS3, PolicyTypeQiniu, PolicyTypeUpyun:
		return true
	default:
		return false
	}
}
