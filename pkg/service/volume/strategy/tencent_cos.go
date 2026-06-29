/*
 * @Description: 腾讯云COS存储策略的具体实现
 * @Author: 安知鱼
 * @Date: 2025-09-28 12:00:00
 * @LastEditTime: 2025-09-28 15:23:58
 * @LastEditors: 安知鱼
 */
package strategy

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// TencentCOSStrategy 实现了 IPolicyTypeStrategy 接口
type TencentCOSStrategy struct{}

// NewTencentCOSStrategy 是 TencentCOSStrategy 的构造函数
func NewTencentCOSStrategy() IPolicyTypeStrategy {
	return &TencentCOSStrategy{}
}

// ValidateSettings 验证腾讯云COS策略的配置
// 腾讯云COS需要验证存储桶地域、上传方式等配置
func (s *TencentCOSStrategy) ValidateSettings(settings map[string]interface{}) error {
	// 验证存储桶地域（可选字段，如果提供则验证格式）
	if region, ok := settings["region"]; ok {
		r, isString := region.(string)
		if !isString || r == "" {
			return errors.New("settings 中的 'region' 字段必须是非空字符串")
		}
		// 验证腾讯云COS区域格式 (例如: ap-beijing, ap-shanghai)
		if !s.isValidTencentRegion(r) {
			return fmt.Errorf("无效的腾讯云COS区域格式: %s", r)
		}
	}

	// 验证上传方式（腾讯云COS支持客户端直传）
	if val, ok := settings[constant.UploadMethodSettingKey]; ok {
		method, isString := val.(string)
		if !isString {
			return errors.New("settings 中的 'upload_method' 字段必须是字符串")
		}
		if method != constant.UploadMethodClient && method != constant.UploadMethodServer {
			return fmt.Errorf("腾讯云COS存储策略支持 'client' 或 'server' 上传方式，当前值: %s", method)
		}
	} else {
		// 如果没有指定上传方式，默认设置为客户端直传
		if settings == nil {
			settings = make(map[string]interface{})
		}
		settings[constant.UploadMethodSettingKey] = constant.UploadMethodClient
	}

	// 验证CDN域名（可选）
	if cdnDomain, ok := settings["cdn_domain"]; ok {
		if _, isString := cdnDomain.(string); !isString {
			return errors.New("settings 中的 'cdn_domain' 字段必须是字符串")
		}
		// 这里可以添加域名格式验证逻辑
	}

	// 验证CDN源站鉴权选项（可选）
	if sourceAuth, ok := settings["source_auth"]; ok {
		if _, isBool := sourceAuth.(bool); !isBool {
			return errors.New("settings 中的 'source_auth' 字段必须是布尔值")
		}
	}

	// 验证下载中转选项（可选）
	if customProxy, ok := settings["custom_proxy"]; ok {
		if _, isBool := customProxy.(bool); !isBool {
			return errors.New("settings 中的 'custom_proxy' 字段必须是布尔值")
		}
	}

	// 验证样式分隔符（可选，用于图片处理参数）
	if styleSeparator, ok := settings[constant.StyleSeparatorSettingKey]; ok {
		sep, isString := styleSeparator.(string)
		if !isString {
			return errors.New("settings 中的 'style_separator' 字段必须是字符串")
		}
		// 验证样式分隔符的有效性
		// 支持单个字符分隔符（如 ?, !, |, -）或完整样式路径（如 /ArticleImage）
		if sep != "" && !s.isValidStyleSeparator(sep) {
			return fmt.Errorf("无效的样式分隔符格式: %s。支持单个字符（?, !, |, -）或样式路径（如 /ArticleImage）", sep)
		}
	}

	return nil
}

// GetAuthHandler 腾讯云COS使用SecretKey方式认证，不需要OAuth2流程，返回 nil
func (s *TencentCOSStrategy) GetAuthHandler() IPolicyAuthHandler {
	return nil
}

// BeforeDelete 在删除腾讯云COS策略前执行的操作
func (s *TencentCOSStrategy) BeforeDelete(ctx context.Context, policy *model.StoragePolicy) error {
	// 腾讯云COS删除前无需特殊操作，清理工作由存储提供者处理
	return nil
}

// isValidTencentRegion 验证腾讯云COS区域格式是否正确
func (s *TencentCOSStrategy) isValidTencentRegion(region string) bool {
	// 腾讯云COS区域格式通常是: ap-beijing, ap-shanghai, na-siliconvalley 等
	// 格式验证：长度在6-20字符之间，包含连字符
	if len(region) < 6 || len(region) > 20 {
		return false
	}

	// 检查是否包含连字符
	if !strings.Contains(region, "-") {
		return false
	}

	// 检查是否只包含字母、数字和连字符
	for _, r := range region {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-') {
			return false
		}
	}

	// 确保包含至少一个连字符（xx-xxx格式）
	parts := strings.Split(region, "-")
	if len(parts) < 2 {
		return false
	}

	return true
}

// isValidStyleSeparator 验证样式分隔符是否有效
// 腾讯云COS支持的分隔符格式：
// 1. 单个字符分隔符: ?, !, |, -
// 2. 样式路径格式: /样式名 (例如 /ArticleImage)
func (s *TencentCOSStrategy) isValidStyleSeparator(separator string) bool {
	if separator == "" {
		return true
	}

	// 检查是否为单个字符分隔符
	validSingleChars := []string{"?", "!", "|", "-"}
	for _, valid := range validSingleChars {
		if separator == valid {
			return true
		}
	}

	// 检查是否为样式路径格式 (以 / 开头的路径)
	if strings.HasPrefix(separator, "/") && len(separator) > 1 {
		// 样式名应该只包含字母、数字、下划线和连字符
		styleName := separator[1:]
		if len(styleName) > 0 && len(styleName) <= 100 {
			for _, r := range styleName {
				if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
					(r >= '0' && r <= '9') || r == '_' || r == '-') {
					return false
				}
			}
			return true
		}
	}

	return false
}
