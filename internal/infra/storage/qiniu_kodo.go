/*
 * @Description: 七牛云Kodo存储提供者实现
 * @Author: 安知鱼
 * @Date: 2025-01-05 00:00:00
 * @LastEditTime: 2025-01-05 00:00:00
 * @LastEditors: 安知鱼
 *
 * 【重要：路径转换规则说明】
 *
 * 本存储提供者中的方法接收两种类型的路径参数，必须正确区分：
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ 类型1: virtualPath（完整虚拟路径）                                           │
 * │                                                                             │
 * │ 格式: /挂载点/子目录/文件名                                                   │
 * │ 示例: /qiniu/aaa/123.jpg                                                    │
 * │                                                                             │
 * │ 使用此参数的方法:                                                            │
 * │   - Upload()                                                                │
 * │   - List()                                                                  │
 * │   - CreateDirectory()                                                       │
 * │   - DeleteDirectory()                                                       │
 * │   - Rename()                                                                │
 * │   - CreatePresignedUploadURL()                                              │
 * │                                                                             │
 * │ 转换逻辑: 调用 buildObjectKey() 进行转换                                      │
 * │   1. 从 virtualPath 中减去 policy.VirtualPath（挂载点）得到相对路径            │
 * │      相对路径 = "/qiniu/aaa/123.jpg" - "/qiniu" = "/aaa/123.jpg"             │
 * │   2. 将相对路径与 policy.BasePath（云存储基础路径）拼接                         │
 * │      对象键 = "test" + "/aaa/123.jpg" = "test/aaa/123.jpg"                   │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ 类型2: source（完整对象键）                                                  │
 * │                                                                             │
 * │ 格式: 云存储上的实际路径（已包含 BasePath）                                    │
 * │ 示例: test/aaa/123.jpg                                                      │
 * │                                                                             │
 * │ 使用此参数的方法:                                                            │
 * │   - Get()                                                                   │
 * │   - Delete()                                                                │
 * │   - Stream()                                                                │
 * │   - GetDownloadURL()                                                        │
 * │   - IsExist()                                                               │
 * │   - GetThumbnail()                                                          │
 * │                                                                             │
 * │ 处理逻辑: 直接使用，不需要任何转换                                             │
 * │   source 是从数据库 file_storage_entities.source 字段读取的值，                │
 * │   在文件上传时已经由 Upload() 方法生成并存储。                                 │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * 【存储策略配置说明】
 *
 * policy.VirtualPath: 策略在虚拟文件系统中的挂载点（如 "/qiniu"）
 * policy.BasePath:    策略在云存储上的基础目录（如 "/test"）
 * policy.Server:      存储区域上传域名（如 "https://up-z2.qiniup.com"）
 * settings.cdn_domain: CDN/访问域名（如 "https://cdn.example.com"）
 *
 * 【警告】修改路径转换逻辑前请仔细阅读以上说明！
 */
package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/qiniu/go-sdk/v7/auth"
	"github.com/qiniu/go-sdk/v7/storage"
)

// QiniuKodoProvider 实现了 IStorageProvider 接口，用于处理与七牛云Kodo的所有交互。
type QiniuKodoProvider struct {
}

// NewQiniuKodoProvider 是 QiniuKodoProvider 的构造函数。
func NewQiniuKodoProvider() IStorageProvider {
	return &QiniuKodoProvider{}
}

// getCredentials 获取七牛云认证凭证
func (p *QiniuKodoProvider) getCredentials(policy *model.StoragePolicy) (*auth.Credentials, error) {
	accessKey := policy.AccessKey
	if accessKey == "" {
		return nil, fmt.Errorf("七牛云策略缺少AccessKey")
	}

	secretKey := policy.SecretKey
	if secretKey == "" {
		return nil, fmt.Errorf("七牛云策略缺少SecretKey")
	}

	return auth.New(accessKey, secretKey), nil
}

// getBucketManager 获取七牛云存储桶管理器
func (p *QiniuKodoProvider) getBucketManager(policy *model.StoragePolicy) (*storage.BucketManager, error) {
	mac, err := p.getCredentials(policy)
	if err != nil {
		return nil, err
	}

	cfg := storage.Config{
		UseHTTPS: true,
	}

	return storage.NewBucketManager(mac, &cfg), nil
}

// getUploadConfig 获取上传配置
func (p *QiniuKodoProvider) getUploadConfig(policy *model.StoragePolicy) *storage.Config {
	cfg := &storage.Config{
		UseHTTPS:      true,
		UseCdnDomains: false,
	}

	// 从 Server 字段解析区域
	// 七牛云区域域名格式: https://up-z0.qiniup.com (华东)
	// z0=华东, z1=华北, z2=华南, na0=北美, as0=东南亚
	if policy.Server != "" {
		server := strings.ToLower(policy.Server)
		if strings.Contains(server, "up-z0") || strings.Contains(server, "up.qiniup.com") {
			cfg.Region = &storage.ZoneHuadong
		} else if strings.Contains(server, "up-z1") {
			cfg.Region = &storage.ZoneHuabei
		} else if strings.Contains(server, "up-z2") {
			cfg.Region = &storage.ZoneHuanan
		} else if strings.Contains(server, "up-na0") {
			cfg.Region = &storage.ZoneBeimei
		} else if strings.Contains(server, "up-as0") {
			cfg.Region = &storage.ZoneXinjiapo
		} else {
			// 默认华东区域
			cfg.Region = &storage.ZoneHuadong
		}
	}

	return cfg
}

// buildObjectKey 构建对象存储路径
func (p *QiniuKodoProvider) buildObjectKey(policy *model.StoragePolicy, virtualPath string) string {
	// 计算相对于策略挂载点的相对路径
	relativePath := strings.TrimPrefix(virtualPath, policy.VirtualPath)
	relativePath = strings.TrimPrefix(relativePath, "/")

	// 基础前缀路径处理
	basePath := strings.TrimPrefix(strings.TrimSuffix(policy.BasePath, "/"), "/")

	var objectKey string
	if basePath == "" {
		objectKey = relativePath
	} else {
		if relativePath == "" {
			objectKey = basePath
		} else {
			objectKey = basePath + "/" + relativePath
		}
	}

	// 确保不以斜杠开头
	objectKey = strings.TrimPrefix(objectKey, "/")

	log.Printf("[七牛云] 路径转换 - basePath: %s, virtualPath: %s, policyVirtualPath: %s -> relativePath: %s -> objectKey: %s",
		policy.BasePath, virtualPath, policy.VirtualPath, relativePath, objectKey)
	return objectKey
}

// getCDNDomain 获取CDN域名配置
func (p *QiniuKodoProvider) getCDNDomain(policy *model.StoragePolicy) string {
	if val, ok := policy.Settings["cdn_domain"].(string); ok && val != "" {
		return strings.TrimSuffix(val, "/")
	}
	return ""
}

// Upload 上传文件到七牛云Kodo
func (p *QiniuKodoProvider) Upload(ctx context.Context, file io.Reader, policy *model.StoragePolicy, virtualPath string) (*UploadResult, error) {
	log.Printf("[七牛云] 开始上传文件: virtualPath=%s, BasePath=%s, VirtualPath=%s", virtualPath, policy.BasePath, policy.VirtualPath)

	if policy.BucketName == "" {
		return nil, fmt.Errorf("七牛云策略缺少存储空间名称")
	}

	mac, err := p.getCredentials(policy)
	if err != nil {
		log.Printf("[七牛云] 获取认证凭证失败: %v", err)
		return nil, err
	}

	objectKey := p.buildObjectKey(policy, virtualPath)
	log.Printf("[七牛云] 上传对象: objectKey=%s", objectKey)

	// 构建上传策略
	putPolicy := storage.PutPolicy{
		Scope: fmt.Sprintf("%s:%s", policy.BucketName, objectKey),
	}
	upToken := putPolicy.UploadToken(mac)

	// 读取文件内容到内存（七牛云SDK需要知道文件大小）
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("读取上传文件失败: %w", err)
	}

	cfg := p.getUploadConfig(policy)
	formUploader := storage.NewFormUploader(cfg)

	ret := storage.PutRet{}
	putExtra := storage.PutExtra{}

	err = formUploader.Put(ctx, &ret, upToken, objectKey, bytes.NewReader(data), int64(len(data)), &putExtra)
	if err != nil {
		log.Printf("[七牛云] 上传失败: %v", err)
		return nil, fmt.Errorf("上传文件到七牛云失败: %w", err)
	}

	log.Printf("[七牛云] 上传成功: objectKey=%s, hash=%s", objectKey, ret.Hash)

	// 获取MIME类型
	mimeType := mime.TypeByExtension(filepath.Ext(virtualPath))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	return &UploadResult{
		Source:   objectKey,
		Size:     int64(len(data)),
		MimeType: mimeType,
	}, nil
}

// Get 从七牛云Kodo获取文件流
func (p *QiniuKodoProvider) Get(ctx context.Context, policy *model.StoragePolicy, source string) (io.ReadCloser, error) {
	// 生成下载URL
	downloadURL, err := p.GetDownloadURL(ctx, policy, source, DownloadURLOptions{ExpiresIn: 3600})
	if err != nil {
		return nil, err
	}

	// 通过HTTP获取文件
	resp, err := http.Get(downloadURL)
	if err != nil {
		return nil, fmt.Errorf("从七牛云获取文件失败: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("从七牛云获取文件失败: HTTP %d", resp.StatusCode)
	}

	return resp.Body, nil
}

// List 列出七牛云Kodo存储空间中的对象
func (p *QiniuKodoProvider) List(ctx context.Context, policy *model.StoragePolicy, virtualPath string) ([]FileInfo, error) {
	log.Printf("[七牛云] List方法调用 - 策略名称: %s, virtualPath: %s", policy.Name, virtualPath)

	bucketManager, err := p.getBucketManager(policy)
	if err != nil {
		return nil, err
	}

	prefix := p.buildObjectKey(policy, virtualPath)
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}

	var fileInfos []FileInfo
	marker := ""
	delimiter := "/"
	limit := 1000

	for {
		entries, commonPrefixes, nextMarker, hasNext, err := bucketManager.ListFiles(policy.BucketName, prefix, delimiter, marker, limit)
		if err != nil {
			return nil, fmt.Errorf("列出七牛云对象失败: %w", err)
		}

		// 处理文件
		for _, entry := range entries {
			// 跳过目录本身
			if strings.HasSuffix(entry.Key, "/") {
				continue
			}

			name := strings.TrimPrefix(entry.Key, prefix)
			if name == "" || strings.Contains(name, "/") {
				continue
			}

			fileInfo := FileInfo{
				Name:    name,
				Size:    entry.Fsize,
				ModTime: time.Unix(0, entry.PutTime*100),
				IsDir:   false,
			}
			fileInfos = append(fileInfos, fileInfo)
		}

		// 处理目录
		for _, commonPrefix := range commonPrefixes {
			dirName := strings.TrimSuffix(strings.TrimPrefix(commonPrefix, prefix), "/")
			if dirName == "" {
				continue
			}

			fileInfo := FileInfo{
				Name:    dirName,
				Size:    0,
				ModTime: time.Time{},
				IsDir:   true,
			}
			fileInfos = append(fileInfos, fileInfo)
		}

		if !hasNext {
			break
		}
		marker = nextMarker
	}

	log.Printf("[七牛云] List完成 - 返回 %d 个项目", len(fileInfos))
	return fileInfos, nil
}

// Delete 从七牛云Kodo删除多个文件
func (p *QiniuKodoProvider) Delete(ctx context.Context, policy *model.StoragePolicy, sources []string) error {
	if len(sources) == 0 {
		return nil
	}

	bucketManager, err := p.getBucketManager(policy)
	if err != nil {
		return err
	}

	log.Printf("[七牛云] Delete方法调用 - 策略: %s, 删除文件数量: %d", policy.Name, len(sources))

	for _, source := range sources {
		log.Printf("[七牛云] 删除对象: %s", source)
		err := bucketManager.Delete(policy.BucketName, source)
		if err != nil {
			log.Printf("[七牛云] 删除对象失败: %s, 错误: %v", source, err)
			return fmt.Errorf("删除七牛云对象 %s 失败: %w", source, err)
		}
		log.Printf("[七牛云] 成功删除对象: %s", source)
	}

	return nil
}

// GetDownloadURL 生成七牛云Kodo下载URL
func (p *QiniuKodoProvider) GetDownloadURL(ctx context.Context, policy *model.StoragePolicy, source string, options DownloadURLOptions) (string, error) {
	log.Printf("[七牛云] GetDownloadURL调用 - source: %s, policy.IsPrivate: %v", source, policy.IsPrivate)

	cdnDomain := p.getCDNDomain(policy)
	if cdnDomain == "" {
		return "", fmt.Errorf("七牛云策略缺少访问域名配置（settings.cdn_domain）")
	}

	// 确保CDN域名有协议前缀
	if !strings.HasPrefix(cdnDomain, "http://") && !strings.HasPrefix(cdnDomain, "https://") {
		cdnDomain = "https://" + cdnDomain
	}

	// 获取样式分隔符配置
	styleSeparator := ""
	if val, ok := policy.Settings["style_separator"].(string); ok {
		styleSeparator = val
	}

	log.Printf("[七牛云] 配置信息 - cdnDomain: %s, styleSeparator: %s", cdnDomain, styleSeparator)

	// 构建基础URL
	baseURL := fmt.Sprintf("%s/%s", cdnDomain, source)

	// 根据是否为私有空间决定URL类型
	if policy.IsPrivate {
		log.Printf("[七牛云] 生成私有空间签名URL")

		mac, err := p.getCredentials(policy)
		if err != nil {
			return "", err
		}

		// 设置过期时间，默认1小时
		expiresIn := options.ExpiresIn
		if expiresIn <= 0 {
			expiresIn = 3600
		}

		deadline := time.Now().Add(time.Duration(expiresIn) * time.Second).Unix()

		// 添加图片处理参数
		if options.QueryParams != "" {
			baseURL = p.appendImageParams(baseURL, options.QueryParams, styleSeparator)
		}

		// 生成私有空间下载链接
		privateURL := storage.MakePrivateURL(mac, cdnDomain, source, deadline)

		log.Printf("[七牛云] 私有空间签名URL: %s", privateURL)
		return privateURL, nil
	}

	// 公开空间，直接返回URL
	log.Printf("[七牛云] 生成公开URL")

	// 添加图片处理参数
	if options.QueryParams != "" {
		baseURL = p.appendImageParams(baseURL, options.QueryParams, styleSeparator)
	}

	log.Printf("[七牛云] 公开URL: %s", baseURL)
	return baseURL, nil
}

// CreateDirectory 在七牛云Kodo中创建目录（通过创建空对象模拟）
func (p *QiniuKodoProvider) CreateDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	mac, err := p.getCredentials(policy)
	if err != nil {
		return err
	}

	objectKey := p.buildObjectKey(policy, virtualPath)
	if !strings.HasSuffix(objectKey, "/") {
		objectKey += "/"
	}

	// 构建上传策略
	putPolicy := storage.PutPolicy{
		Scope: fmt.Sprintf("%s:%s", policy.BucketName, objectKey),
	}
	upToken := putPolicy.UploadToken(mac)

	cfg := p.getUploadConfig(policy)
	formUploader := storage.NewFormUploader(cfg)

	ret := storage.PutRet{}
	putExtra := storage.PutExtra{}

	// 上传空内容创建目录
	err = formUploader.Put(ctx, &ret, upToken, objectKey, bytes.NewReader([]byte{}), 0, &putExtra)
	if err != nil {
		return fmt.Errorf("在七牛云中创建目录失败: %w", err)
	}

	return nil
}

// DeleteDirectory 删除七牛云Kodo中的空目录
func (p *QiniuKodoProvider) DeleteDirectory(ctx context.Context, policy *model.StoragePolicy, virtualPath string) error {
	bucketManager, err := p.getBucketManager(policy)
	if err != nil {
		return err
	}

	objectKey := p.buildObjectKey(policy, virtualPath)
	if !strings.HasSuffix(objectKey, "/") {
		objectKey += "/"
	}

	err = bucketManager.Delete(policy.BucketName, objectKey)
	if err != nil {
		return fmt.Errorf("删除七牛云目录失败: %w", err)
	}

	return nil
}

// Rename 重命名或移动七牛云Kodo中的文件或目录
func (p *QiniuKodoProvider) Rename(ctx context.Context, policy *model.StoragePolicy, oldVirtualPath, newVirtualPath string) error {
	bucketManager, err := p.getBucketManager(policy)
	if err != nil {
		return err
	}

	oldObjectKey := p.buildObjectKey(policy, oldVirtualPath)
	newObjectKey := p.buildObjectKey(policy, newVirtualPath)

	log.Printf("[七牛云] Rename: %s -> %s", oldObjectKey, newObjectKey)

	// 七牛云使用 Move 实现重命名
	err = bucketManager.Move(policy.BucketName, oldObjectKey, policy.BucketName, newObjectKey, true)
	if err != nil {
		return fmt.Errorf("重命名七牛云对象失败: %w", err)
	}

	return nil
}

// Stream 将七牛云Kodo文件内容流式传输到写入器
func (p *QiniuKodoProvider) Stream(ctx context.Context, policy *model.StoragePolicy, source string, writer io.Writer) error {
	// 生成下载URL并重定向
	downloadURL, err := p.GetDownloadURL(ctx, policy, source, DownloadURLOptions{ExpiresIn: 3600})
	if err != nil {
		return err
	}

	if w, ok := writer.(http.ResponseWriter); ok {
		w.Header().Set("Location", downloadURL)
		w.WriteHeader(http.StatusFound)
		log.Printf("[七牛云] Stream方法重定向到: %s", downloadURL)
		return nil
	}

	return fmt.Errorf("七牛云流式传输需要http.ResponseWriter来执行重定向")
}

// IsExist 检查文件是否存在于七牛云Kodo中
func (p *QiniuKodoProvider) IsExist(ctx context.Context, policy *model.StoragePolicy, source string) (bool, error) {
	bucketManager, err := p.getBucketManager(policy)
	if err != nil {
		return false, err
	}

	_, err = bucketManager.Stat(policy.BucketName, source)
	if err != nil {
		// 检查是否是文件不存在的错误
		if strings.Contains(err.Error(), "no such file or directory") ||
			strings.Contains(err.Error(), "612") { // 七牛云的文件不存在错误码
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// GetThumbnail 使用七牛云图片处理服务生成缩略图
func (p *QiniuKodoProvider) GetThumbnail(ctx context.Context, policy *model.StoragePolicy, source string, size string) (*ThumbnailResult, error) {
	// 将描述性尺寸参数转换为像素尺寸
	var width, height int
	switch strings.ToLower(size) {
	case "small":
		width, height = 200, 200
	case "medium":
		width, height = 400, 400
	case "large":
		width, height = 800, 800
	default:
		log.Printf("[七牛云] 无法解析缩略图尺寸 '%s'，使用默认 medium 尺寸", size)
		width, height = 400, 400
	}

	// 构建七牛云图片处理参数
	// 七牛云图片处理格式: imageView2/1/w/400/h/400
	imageProcess := fmt.Sprintf("imageView2/1/w/%d/h/%d", width, height)

	// 生成带图片处理参数的URL
	thumbnailURL, err := p.GetDownloadURL(ctx, policy, source, DownloadURLOptions{
		ExpiresIn:   600, // 10分钟
		QueryParams: imageProcess,
	})
	if err != nil {
		return nil, err
	}

	log.Printf("[七牛云] 缩略图URL: %s", thumbnailURL)

	// 下载缩略图数据
	resp, err := http.Get(thumbnailURL)
	if err != nil {
		return nil, fmt.Errorf("获取缩略图数据失败: %w", err)
	}
	defer resp.Body.Close()

	// 检查HTTP响应状态
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound {
			log.Printf("[七牛云] 缩略图生成失败: 文件不存在 (HTTP %d)", resp.StatusCode)
			return nil, ErrFeatureNotSupported
		}
		if resp.StatusCode == http.StatusForbidden {
			log.Printf("[七牛云] 缩略图访问被拒绝 (HTTP %d)", resp.StatusCode)
			return nil, ErrFeatureNotSupported
		}
		return nil, fmt.Errorf("获取缩略图失败: HTTP状态码 %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取缩略图数据失败: %w", err)
	}

	return &ThumbnailResult{
		ContentType: "image/jpeg",
		Data:        data,
	}, nil
}

// appendImageParams 智能地将图片处理参数附加到URL中
func (p *QiniuKodoProvider) appendImageParams(baseURL, params, separator string) string {
	params = strings.TrimSpace(params)
	if params == "" {
		return baseURL
	}

	// 检查是否以样式分隔符开头（-、!、/）
	styleSeparatorChars := []string{"-", "!", "/"}
	for _, sep := range styleSeparatorChars {
		if strings.HasPrefix(params, sep) {
			return baseURL + params
		}
	}

	// 移除开头的 ? 如果有的话
	params = strings.TrimPrefix(params, "?")
	if params == "" {
		return baseURL
	}

	// 如果没有指定分隔符，使用默认的 ? 分隔符
	if separator == "" {
		separator = "?"
	}

	if strings.Contains(baseURL, "?") {
		return baseURL + "&" + params
	}
	return baseURL + separator + params
}

// CreatePresignedUploadURL 为客户端直传创建上传凭证
func (p *QiniuKodoProvider) CreatePresignedUploadURL(ctx context.Context, policy *model.StoragePolicy, virtualPath string) (*PresignedUploadResult, error) {
	log.Printf("[七牛云] 创建预签名上传URL - virtualPath: %s", virtualPath)

	mac, err := p.getCredentials(policy)
	if err != nil {
		return nil, err
	}

	objectKey := p.buildObjectKey(policy, virtualPath)
	log.Printf("[七牛云] 生成上传凭证 - objectKey: %s", objectKey)

	// 设置上传策略，过期时间1小时
	expirationDateTime := time.Now().Add(time.Hour)
	putPolicy := storage.PutPolicy{
		Scope:   fmt.Sprintf("%s:%s", policy.BucketName, objectKey),
		Expires: uint64(expirationDateTime.Unix()),
	}

	upToken := putPolicy.UploadToken(mac)

	// 七牛云使用上传凭证而不是预签名URL
	// 客户端需要使用这个token来上传文件
	// 上传域名从Server字段获取
	uploadURL := policy.Server
	if uploadURL == "" {
		uploadURL = "https://up.qiniup.com" // 默认华东区域
	}

	log.Printf("[七牛云] 上传凭证生成成功，过期时间: %s", expirationDateTime.Format(time.RFC3339))

	// 对于七牛云，我们返回上传域名和token
	// 客户端需要使用表单上传方式，将token作为参数传递
	return &PresignedUploadResult{
		UploadURL:          fmt.Sprintf("%s?token=%s&key=%s", uploadURL, upToken, objectKey),
		ExpirationDateTime: expirationDateTime,
		ContentType:        "",
	}, nil
}

// SetupCORS 为七牛云存储桶配置跨域策略
// 注意：七牛云的CORS配置需要在控制台进行，此方法仅作占位
func (p *QiniuKodoProvider) SetupCORS(ctx context.Context, policy *model.StoragePolicy) error {
	log.Printf("[七牛云] 注意：七牛云的CORS配置需要在七牛云控制台的存储空间设置中手动配置")
	// 七牛云不支持通过API配置CORS，需要在控制台操作
	return nil
}
