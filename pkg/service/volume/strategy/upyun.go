package strategy

import (
	"context"
	"errors"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// UpyunStrategy 实现又拍云存储策略的 settings 校验。
type UpyunStrategy struct{}

func NewUpyunStrategy() IPolicyTypeStrategy {
	return &UpyunStrategy{}
}

func (s *UpyunStrategy) ValidateSettings(settings map[string]interface{}) error {
	if settings == nil {
		return errors.New("settings 不能为空")
	}

	if val, ok := settings[constant.UploadMethodSettingKey]; ok {
		method, isString := val.(string)
		if !isString {
			return errors.New("settings 中的 'upload_method' 字段必须是字符串")
		}
		if method != constant.UploadMethodServer {
			return fmt.Errorf("又拍云存储策略仅支持 'server' 上传方式，当前值: %s", method)
		}
	} else {
		settings[constant.UploadMethodSettingKey] = constant.UploadMethodServer
	}

	if cdnDomain, ok := settings["cdn_domain"]; ok {
		if _, isString := cdnDomain.(string); !isString {
			return errors.New("settings 中的 'cdn_domain' 字段必须是字符串")
		}
	}

	if customProxy, ok := settings["custom_proxy"]; ok {
		if _, isBool := customProxy.(bool); !isBool {
			return errors.New("settings 中的 'custom_proxy' 字段必须是布尔值")
		}
	}

	return nil
}

func (s *UpyunStrategy) GetAuthHandler() IPolicyAuthHandler {
	return nil
}

func (s *UpyunStrategy) BeforeDelete(ctx context.Context, policy *model.StoragePolicy) error {
	return nil
}
