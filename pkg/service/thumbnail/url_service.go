package thumbnail

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

// IThumbnailAccessService 定义了缩略图访问服务的接口。
// 它负责生成安全的访问URL和提供最终的缩略图内容。
type IThumbnailAccessService interface {
	// GenerateSignedURL 为给定的文件生成一个不透明的、带签名的、统一的访问令牌。
	GenerateSignedURL(ctx context.Context, file *model.File) (string, time.Time, error)
	// ServeThumbnailContent 解析、验证并根据令牌提供缩略图或原始文件内容。
	ServeThumbnailContent(c context.Context, token string, w http.ResponseWriter, r *http.Request) error
	// GetPolicyAndProviderForFile 获取文件的存储策略和提供者。
	ResetThumbnailMetadata(ctx context.Context, publicFileID string) error
	// ResetThumbnailMetadataForFiles 重置多个文件的缩略图元数据。
	ResetThumbnailMetadataForFiles(ctx context.Context, fileIDs []uint) error
}

// GenerateSignedURL 为文件生成一个不透明的、带签名的、有时效性的访问令牌。
// 这个令牌可以用于访问缩略图或在特定情况下（如SVG）访问原始文件。
func (s *ThumbnailService) GenerateSignedURL(ctx context.Context, file *model.File) (string, time.Time, error) {
	// 1. 获取文件状态，以决定签名的类型
	status, _ := s.metaService.Get(ctx, file.ID, model.MetaKeyThumbStatus)

	var tokenType string
	var format string

	switch status {
	case model.MetaValueStatusReadyDirect:
		tokenType = "direct"
		// 对于直链，不需要特定的'format'，但可以存文件后缀以备后用
		format = strings.TrimPrefix(filepath.Ext(file.Name), ".")
	case model.MetaValueStatusReady:
		tokenType = "thumb"
		// 对于生成的缩略图，必须获取其格式元数据
		thumbFormat, err := s.metaService.Get(ctx, file.ID, model.MetaKeyThumbFormat)
		if err != nil || thumbFormat == "" {
			log.Printf("[GenerateSignedURL-ERROR] 文件ID %d 状态为Ready，但获取 %s 失败。Error: %v, Format: '%s'", file.ID, model.MetaKeyThumbFormat, err, thumbFormat)

			return "", time.Time{}, fmt.Errorf("找不到文件ID %d 的缩略图格式元数据: %w", file.ID, err)
		}
		format = thumbFormat
	default:
		log.Printf("[GenerateSignedURL-ERROR] 文件ID %d 状态为 '%s'，不满足生成签名的条件 (需要 Ready 或 ReadyDirect)", file.ID, status)

		// 如果状态不是 Ready 或 ReadyDirect，则无法生成URL
		return "", time.Time{}, fmt.Errorf("文件状态 '%s' 不允许生成签名URL", status)
	}

	// 2. 获取所有者和文件的公共ID
	ownerPublicID, err := idgen.GeneratePublicID(file.OwnerID, idgen.EntityTypeUser)
	if err != nil {
		log.Printf("[GenerateSignedURL-ERROR] 文件ID %d, 为所有者ID %d 生成公共ID失败: %v", file.ID, file.OwnerID, err)

		return "", time.Time{}, fmt.Errorf("为所有者ID %d 生成公共ID失败: %w", file.OwnerID, err)
	}
	filePublicID, err := idgen.GeneratePublicID(file.ID, idgen.EntityTypeFile)
	if err != nil {
		log.Printf("[GenerateSignedURL-ERROR] 文件ID %d, 生成自己的公共ID失败: %v", file.ID, err)

		return "", time.Time{}, fmt.Errorf("为文件ID %d 生成公共ID失败: %w", file.ID, err)
	}

	// 3. 构建包含类型的签名负载 (Payload)
	expiresAt := time.Now().Add(1 * time.Hour)
	payload := map[string]interface{}{
		"o":  ownerPublicID,
		"f":  filePublicID,
		"tt": tokenType, // tt: token_type ("direct" or "thumb")
		"tf": format,    // tf: target_format (e.g., "jpeg" or "svg")
		"e":  expiresAt.Unix(),
	}
	payloadBytes, _ := json.Marshal(payload)

	// 4. 计算签名
	secret := []byte(s.settingSvc.Get(constant.KeyLocalFileSigningSecret.String()))
	if len(secret) == 0 {
		log.Printf("[GenerateSignedURL-ERROR] 签名密钥 (signing secret) 为空，无法生成签名！")
		return "", time.Time{}, fmt.Errorf("签名密钥未配置")
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write(payloadBytes)
	signature := mac.Sum(nil)

	// 5. 组合成最终的 token (格式：base64(payload).base64(signature))
	token := fmt.Sprintf("%s.%s",
		base64.URLEncoding.EncodeToString(payloadBytes),
		base64.URLEncoding.EncodeToString(signature),
	)

	return token, expiresAt, nil
}

// ServeThumbnailContent 解析、验证并根据token类型提供相应内容。
func (s *ThumbnailService) ServeThumbnailContent(c context.Context, token string, w http.ResponseWriter, r *http.Request) error {
	// 1. 拆分 token
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return constant.ErrSignatureInvalid
	}
	payloadB64, signatureB64 := parts[0], parts[1]

	// 2. 解码 payload 和 signature
	payloadBytes, err := base64.URLEncoding.DecodeString(payloadB64)
	if err != nil {
		return constant.ErrSignatureInvalid
	}
	signature, err := base64.URLEncoding.DecodeString(signatureB64)
	if err != nil {
		return constant.ErrSignatureInvalid
	}

	// 3. 验证签名
	secret := []byte(s.settingSvc.Get(constant.KeyLocalFileSigningSecret.String()))
	mac := hmac.New(sha256.New, secret)
	mac.Write(payloadBytes)
	expectedSignature := mac.Sum(nil)
	if !hmac.Equal(signature, expectedSignature) {
		return constant.ErrSignatureInvalid
	}

	// 4. 解析 payload 内容
	var payload map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return constant.ErrSignatureInvalid
	}

	// 5. 验证过期时间
	exp, ok := payload["e"].(float64)
	if !ok || time.Now().Unix() > int64(exp) {
		return constant.ErrLinkExpired
	}

	// 6. 从 payload 中提取核心信息
	tokenType, _ := payload["tt"].(string)
	filePublicID, _ := payload["f"].(string)

	if filePublicID == "" || tokenType == "" {
		return fmt.Errorf("token payload is missing required fields")
	}

	dbID, _, err := idgen.DecodePublicID(filePublicID)
	if err != nil {
		log.Println("[DecodePublicID-ERROR]", err)
		return constant.ErrNotFound
	}
	file, err := s.fileRepo.FindByID(c, dbID)
	if err != nil {
		log.Println("[FindByID-ERROR]", err)
		return constant.ErrNotFound
	}

	log.Println("=====================", dbID, filePublicID, tokenType)

	// 7. 根据token类型决定服务内容
	switch tokenType {
	case "direct":
		// 提供原始文件流
		policy, provider, err := s.getPolicyAndProviderForFile(c, file)
		if err != nil {
			return fmt.Errorf("无法获取原始文件的策略和驱动: %w", err)
		}
		// 使用 Stream 方法将文件内容直接写入 ResponseWriter
		return provider.Stream(c, policy, file.PrimaryEntity.Source.String, w)

	case "thumb":
		// 提供缓存的缩略图文件
		ownerPublicID, _ := payload["o"].(string)
		format, _ := payload["tf"].(string)

		parentPath, err := s.getVirtualParentPath(c, file)
		if err != nil {
			log.Printf("[GetVirtualParentPath-ERROR] 获取文件 %s 的虚拟父路径失败: %v", filePublicID, err)
			return err
		}

		log.Printf("[ServeThumbnailContent-DEBUG] 文件 %s 的虚拟父路径: %s", filePublicID, parentPath)
		log.Printf("[ServeThumbnailContent-DEBUG] 缩略图格式: %s", format)

		cacheFileName := GenerateCacheName(ownerPublicID, filePublicID, format)
		thumbnailPath, err := GetCachePath(s.cachePath, parentPath, cacheFileName)
		if err != nil {
			log.Printf("[GetCachePath-ERROR] 获取缩略图缓存路径失败: %v", err)
			return err
		}

		log.Printf("[ServeThumbnailContent-DEBUG] 缩略图缓存路径: %s", thumbnailPath)

		http.ServeFile(w, r, thumbnailPath)
		return nil

	default:
		return fmt.Errorf("未知的token类型: %s", tokenType)
	}
}
