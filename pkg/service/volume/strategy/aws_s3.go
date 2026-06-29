/*
 * @Description: AWS S3存储策略的具体实现
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

// AWSS3Strategy 实现了 IPolicyTypeStrategy 接口
type AWSS3Strategy struct{}

// NewAWSS3Strategy 是 AWSS3Strategy 的构造函数
func NewAWSS3Strategy() IPolicyTypeStrategy {
	return &AWSS3Strategy{}
}

// ValidateSettings 验证AWS S3策略的配置
// AWS S3需要验证存储桶地域、上传方式等配置
func (s *AWSS3Strategy) ValidateSettings(settings map[string]interface{}) error {
	// 验证存储桶地域（可选字段，如果提供则验证格式）
	if region, ok := settings["region"]; ok {
		r, isString := region.(string)
		if !isString || r == "" {
			return errors.New("settings 中的 'region' 字段必须是非空字符串")
		}
		// 验证AWS区域格式 (例如: us-east-1, eu-west-1)
		if !s.isValidAWSRegion(r) {
			return fmt.Errorf("无效的AWS区域格式: %s", r)
		}
	}

	// 验证上传方式（AWS S3支持客户端直传）
	if val, ok := settings[constant.UploadMethodSettingKey]; ok {
		method, isString := val.(string)
		if !isString {
			return errors.New("settings 中的 'upload_method' 字段必须是字符串")
		}
		if method != constant.UploadMethodClient && method != constant.UploadMethodServer {
			return fmt.Errorf("AWS S3存储策略支持 'client' 或 'server' 上传方式，当前值: %s", method)
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

	// 验证强制路径样式（可选）
	if forcePathStyle, ok := settings["force_path_style"]; ok {
		if _, isBool := forcePathStyle.(bool); !isBool {
			return errors.New("settings 中的 'force_path_style' 字段必须是布尔值")
		}
	}

	// 验证自定义端点URL（可选）
	if endpointURL, ok := settings["endpoint_url"]; ok {
		if _, isString := endpointURL.(string); !isString {
			return errors.New("settings 中的 'endpoint_url' 字段必须是字符串")
		}
		// 这里可以添加URL格式验证逻辑
	}

	return nil
}

// GetAuthHandler AWS S3使用AccessKey方式认证，不需要OAuth2流程，返回 nil
func (s *AWSS3Strategy) GetAuthHandler() IPolicyAuthHandler {
	return nil
}

// BeforeDelete 在删除AWS S3策略前执行的操作
func (s *AWSS3Strategy) BeforeDelete(ctx context.Context, policy *model.StoragePolicy) error {
	// AWS S3删除前无需特殊操作，清理工作由存储提供者处理
	return nil
}

// isValidAWSRegion 验证AWS区域格式是否正确
func (s *AWSS3Strategy) isValidAWSRegion(region string) bool {
	// AWS区域格式通常是: us-east-1, eu-west-1, ap-southeast-1 等
	// 简单验证：包含至少一个连字符，长度在8-20之符之间
	if len(region) < 8 || len(region) > 20 {
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

	return true
}
