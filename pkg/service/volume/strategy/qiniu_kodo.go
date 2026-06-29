/*
 * @Description: 七牛云Kodo存储策略的具体实现
 * @Author: 安知鱼
 * @Date: 2025-01-05 00:00:00
 * @LastEditTime: 2025-01-05 00:00:00
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

// QiniuKodoStrategy 实现了 IPolicyTypeStrategy 接口
type QiniuKodoStrategy struct{}

// NewQiniuKodoStrategy 是 QiniuKodoStrategy 的构造函数
func NewQiniuKodoStrategy() IPolicyTypeStrategy {
	return &QiniuKodoStrategy{}
}

// ValidateSettings 验证七牛云Kodo策略的配置
func (s *QiniuKodoStrategy) ValidateSettings(settings map[string]interface{}) error {
	// 验证上传方式（七牛云支持客户端直传）
	if val, ok := settings[constant.UploadMethodSettingKey]; ok {
		method, isString := val.(string)
		if !isString {
			return errors.New("settings 中的 'upload_method' 字段必须是字符串")
		}
		if method != constant.UploadMethodClient && method != constant.UploadMethodServer {
			return fmt.Errorf("七牛云存储策略支持 'client' 或 'server' 上传方式，当前值: %s", method)
		}
	} else {
		// 如果没有指定上传方式，默认设置为客户端直传
		if settings == nil {
			settings = make(map[string]interface{})
		}
		settings[constant.UploadMethodSettingKey] = constant.UploadMethodClient
	}

	// 验证CDN域名（必选，七牛云需要绑定域名才能访问）
	if cdnDomain, ok := settings["cdn_domain"]; ok {
		domain, isString := cdnDomain.(string)
		if !isString {
			return errors.New("settings 中的 'cdn_domain' 字段必须是字符串")
		}
		// 验证域名格式
		if domain != "" && !s.isValidDomain(domain) {
			return fmt.Errorf("无效的CDN域名格式: %s", domain)
		}
	}

	// 验证样式分隔符（可选，用于图片处理参数）
	if styleSeparator, ok := settings[constant.StyleSeparatorSettingKey]; ok {
		sep, isString := styleSeparator.(string)
		if !isString {
			return errors.New("settings 中的 'style_separator' 字段必须是字符串")
		}
		// 验证样式分隔符的有效性
		// 七牛云支持的分隔符: -, !, /
		if sep != "" && !s.isValidStyleSeparator(sep) {
			return fmt.Errorf("无效的样式分隔符格式: %s。七牛云支持 -, !, / 作为样式分隔符", sep)
		}
	}

	// 验证回源鉴权选项（可选）
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

	return nil
}

// GetAuthHandler 七牛云使用AccessKey/SecretKey方式认证，不需要OAuth2流程，返回 nil
func (s *QiniuKodoStrategy) GetAuthHandler() IPolicyAuthHandler {
	return nil
}

// BeforeDelete 在删除七牛云策略前执行的操作
func (s *QiniuKodoStrategy) BeforeDelete(ctx context.Context, policy *model.StoragePolicy) error {
	// 七牛云删除前无需特殊操作
	return nil
}

// isValidDomain 验证域名格式是否正确
func (s *QiniuKodoStrategy) isValidDomain(domain string) bool {
	// 移除协议前缀进行验证
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimSuffix(domain, "/")

	if domain == "" {
		return false
	}

	// 简单的域名格式验证
	// 检查是否只包含有效字符
	for _, r := range domain {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '.' || r == '-' || r == ':') {
			return false
		}
	}

	// 至少包含一个点（域名格式）
	if !strings.Contains(domain, ".") {
		return false
	}

	return true
}

// isValidStyleSeparator 验证样式分隔符是否有效
// 七牛云支持的分隔符格式：
// 1. 单个字符分隔符: -, !, /
// 2. 样式路径格式: -样式名 (例如 -small)
func (s *QiniuKodoStrategy) isValidStyleSeparator(separator string) bool {
	if separator == "" {
		return true
	}

	// 检查是否为单个字符分隔符
	validSingleChars := []string{"-", "!", "/"}
	for _, valid := range validSingleChars {
		if separator == valid {
			return true
		}
	}

	// 检查是否以有效分隔符开头的样式名
	validPrefixes := []string{"-", "!", "/"}
	for _, prefix := range validPrefixes {
		if strings.HasPrefix(separator, prefix) && len(separator) > 1 {
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
	}

	return false
}
