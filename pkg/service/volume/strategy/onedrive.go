/*
 * @Description: OneDrive 存储策略的具体实现
 * @Author: 安知鱼
 * @Date: 2025-07-15 16:10:00
 * @LastEditTime: 2025-09-28 18:16:47
 * @LastEditors: 安知鱼
 */
package strategy

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strconv"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/microsoft"
)

// 手动定义世纪互联的OAuth2端点
var (
	azureChinaCloudEndpoint = oauth2.Endpoint{
		AuthURL:  "https://login.chinacloudapi.cn/common/oauth2/v2.0/authorize",
		TokenURL: "https://login.chinacloudapi.cn/common/oauth2/v2.0/token",
	}
)

// OneDriveStrategy 实现了 IPolicyTypeStrategy 接口
type OneDriveStrategy struct{}

// NewOneDriveStrategy 是 OneDriveStrategy 的构造函数
func NewOneDriveStrategy() IPolicyTypeStrategy {
	return &OneDriveStrategy{}
}

// ValidateSettings 对于 OneDrive，核心凭据已移至顶级字段，此处的验证可以简化
// 可以在此验证 settings 中的可选字段
func (s *OneDriveStrategy) ValidateSettings(settings map[string]interface{}) error {
	if driveType, ok := settings[constant.DriveTypeSettingKey]; ok {
		if dt, isString := driveType.(string); !isString || (dt != "default" && dt != "sharepoint") {
			return errors.New("settings 中的 'drive_type' 字段值必须是 'default' 或 'sharepoint'")
		}
	}
	if val, ok := settings[constant.UploadMethodSettingKey]; ok {
		method, isString := val.(string)
		if !isString || (method != constant.UploadMethodClient && method != constant.UploadMethodServer) {
			return fmt.Errorf("setting '%s' 的值必须是 '%s' 或 '%s'",
				constant.UploadMethodSettingKey, constant.UploadMethodClient, constant.UploadMethodServer)
		}
	}
	return nil
}

// GetAuthHandler 返回一个专门处理 OneDrive 授权的对象
func (s *OneDriveStrategy) GetAuthHandler() IPolicyAuthHandler {
	return &oneDriveAuthHandler{}
}

// BeforeDelete 在删除 OneDrive 策略前执行的操作
func (s *OneDriveStrategy) BeforeDelete(ctx context.Context, policy *model.StoragePolicy) error {
	// TODO: 未来可以在这里实现撤销(revoke) refresh_token 的逻辑

	// 当前版本：清理可能存在的Redis缓存凭证
	// 注意：这个方法目前无法访问CacheService，需要在调用方处理Redis清理
	log.Printf("[OneDrive策略删除] 策略 ID=%d 的凭证清理将由调用方处理", policy.ID)
	return nil
}

// oneDriveAuthHandler 实现了 IPolicyAuthHandler 接口
type oneDriveAuthHandler struct{}

// getOAuthConfigForPolicy 是一个私有辅助函数，为指定的策略动态创建OAuth2配置
func (h *oneDriveAuthHandler) getOAuthConfigForPolicy(policy *model.StoragePolicy, siteURL string) (*oauth2.Config, error) {
	// 从专用字段读取凭据
	clientID := policy.BucketName    // ClientID 存储在 BucketName
	clientSecret := policy.SecretKey // ClientSecret 存储在 SecretKey
	endpointURL := policy.Server     // Endpoint URL 存储在 Server

	if clientID == "" || clientSecret == "" {
		return nil, errors.New("策略的Client ID或Client Secret未配置")
	}

	var authEndpoint oauth2.Endpoint
	switch endpointURL {
	case "https://microsoftgraph.chinacloudapi.cn/v1.0":
		authEndpoint = azureChinaCloudEndpoint
	case "https://graph.microsoft.com/v1.0":
		authEndpoint = microsoft.LiveConnectEndpoint
	default:
		return nil, fmt.Errorf("不支持的 Microsoft Graph 端点: %s", endpointURL)
	}

	// 使用 url.JoinPath 安全拼接 URL
	redirectURL, err := url.JoinPath(siteURL, "admin/storage-policy/oauth")
	if err != nil {
		return nil, fmt.Errorf("构建重定向URL失败: %w", err)
	}

	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Endpoint:     authEndpoint,
		RedirectURL:  redirectURL,
		Scopes:       []string{"Files.ReadWrite.All", "offline_access"},
	}, nil
}

// GenerateAuthURL 的逻辑实现
func (h *oneDriveAuthHandler) GenerateAuthURL(ctx context.Context, policy *model.StoragePolicy, siteURL string) (string, error) {
	oauthCfg, err := h.getOAuthConfigForPolicy(policy, siteURL)
	if err != nil {
		return "", err
	}

	state := strconv.FormatUint(uint64(policy.ID), 10)
	return oauthCfg.AuthCodeURL(state), nil
}

// FinalizeAuth 的逻辑实现
func (h *oneDriveAuthHandler) FinalizeAuth(ctx context.Context, policy *model.StoragePolicy, code string, siteURL string) error {
	oauthCfg, err := h.getOAuthConfigForPolicy(policy, siteURL)
	if err != nil {
		return err
	}

	token, err := oauthCfg.Exchange(ctx, code)
	if err != nil {
		return fmt.Errorf("使用授权码交换Token失败: %w", err)
	}

	if token.RefreshToken == "" {
		return errors.New("获取Refresh Token失败，请检查API权限中是否包含了 offline_access")
	}

	// 将 Refresh Token 写入 AccessKey 字段
	policy.AccessKey = token.RefreshToken

	return nil
}
