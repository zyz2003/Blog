/*
 * @Description: 虚拟文件系统服务，负责路径解析、策略匹配和文件访问。
 * @Author: 安知鱼
 * @Date: 2025-06-26 16:55:28
 * @LastEditTime: 2025-07-30 20:20:18
 * @LastEditors: 安知鱼
 */
package volume

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"path/filepath"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

// IVFSService 定义了虚拟文件系统服务的接口，专门负责路径解析、策略匹配和文件访问。
type IVFSService interface {
	// FindPolicyForPath 根据虚拟路径查找最匹配的存储策略。
	FindPolicyForPath(ctx context.Context, virtualPath string) (*model.StoragePolicy, error)
	// GetFileReader 为给定的文件模型提供一个可读的流。
	GetFileReader(ctx context.Context, file *model.File) (io.ReadCloser, error)
}

// vfsService 是 IVFSService 的实现
type vfsService struct {
	policySvc        IStoragePolicyService
	cacheSvc         utility.CacheService
	fileRepo         repository.FileRepository
	entityRepo       repository.EntityRepository
	settingSvc       setting.SettingService
	storageProviders map[constant.StoragePolicyType]storage.IStorageProvider
}

// NewVFSService 是 vfsService 的构造函数
func NewVFSService(
	policySvc IStoragePolicyService,
	cacheSvc utility.CacheService,
	fileRepo repository.FileRepository,
	entityRepo repository.EntityRepository,
	settingSvc setting.SettingService,
	providers map[constant.StoragePolicyType]storage.IStorageProvider,
) IVFSService {
	return &vfsService{
		policySvc:        policySvc,
		cacheSvc:         cacheSvc,
		fileRepo:         fileRepo,
		entityRepo:       entityRepo,
		settingSvc:       settingSvc,
		storageProviders: providers,
	}
}

// FindPolicyForPath 实现了基于缓存的、最长前缀匹配的VFS路由逻辑。
func (s *vfsService) FindPolicyForPath(ctx context.Context, virtualPath string) (*model.StoragePolicy, error) {
	const cacheKey = "storage_policies_all"
	var allPolicies []*model.StoragePolicy

	// 1. 尝试从缓存获取策略列表
	cachedPolicies, err := s.cacheSvc.Get(ctx, cacheKey)
	if err == nil && cachedPolicies != "" {
		if err := json.Unmarshal([]byte(cachedPolicies), &allPolicies); err == nil {
			// 缓存命中且反序列化成功
		} else {
			fmt.Printf("警告: 从缓存反序列化存储策略失败: %v\n", err)
		}
	}

	// 2. 如果缓存未命中或失败，则从数据库加载
	if allPolicies == nil {
		dbPolicies, dbErr := s.policySvc.ListAll(ctx)
		if dbErr != nil {
			return nil, fmt.Errorf("获取所有存储策略失败: %w", dbErr)
		}
		allPolicies = dbPolicies
		policiesJSON, jsonErr := json.Marshal(allPolicies)
		if jsonErr == nil {
			s.cacheSvc.Set(ctx, cacheKey, string(policiesJSON), 5*time.Minute)
		} else {
			fmt.Printf("警告: 序列化存储策略到缓存失败: %v\n", jsonErr)
		}
	}

	if len(allPolicies) == 0 {
		return nil, errors.New("系统中未配置任何存储策略")
	}

	// 3. 执行最长前缀匹配
	var bestMatch *model.StoragePolicy
	longestPrefix := -1
	normalizedVirtualPath := "/" + strings.Trim(virtualPath, "/")

	for i := range allPolicies {
		policy := allPolicies[i]
		virtualMountPath := "/" + strings.Trim(policy.VirtualPath, "/")
		if virtualMountPath != "/" {
			virtualMountPath += "/"
		}

		requestPathWithSlash := normalizedVirtualPath
		if !strings.HasSuffix(requestPathWithSlash, "/") {
			requestPathWithSlash += "/"
		}

		if strings.HasPrefix(requestPathWithSlash, virtualMountPath) {
			if len(virtualMountPath) > longestPrefix {
				longestPrefix = len(virtualMountPath)
				bestMatch = policy
			}
		}
	}

	if bestMatch == nil {
		return nil, fmt.Errorf("找不到能够管理路径 '%s' 的存储策略", virtualPath)
	}
	return bestMatch, nil
}

// GetFileReader 为给定的文件模型提供一个可读的流。
// 它会处理存储策略的解析，并从正确的物理位置获取文件。
func (s *vfsService) GetFileReader(ctx context.Context, file *model.File) (io.ReadCloser, error) {
	if file.Type == model.FileTypeDir {
		return nil, errors.New("不能为目录获取文件读取器")
	}

	// 1. 获取文件的完整虚拟路径，用于查找策略
	//    注意：这一步仅用于定位策略，其结果不应作为物理路径使用。
	fullVirtualPath, err := s.getFilePath(ctx, file)
	if err != nil {
		return nil, fmt.Errorf("无法确定文件ID %d 的虚拟路径: %w", file.ID, err)
	}

	// 2. 查找此虚拟路径对应的存储策略
	policy, err := s.FindPolicyForPath(ctx, fullVirtualPath)
	if err != nil {
		return nil, err
	}

	// 3. 获取此策略对应的存储驱动
	provider, err := s.getProviderForPolicy(policy)
	if err != nil {
		return nil, err
	}

	// 4. 确定要从存储驱动中获取的源(source)路径
	//    核心修复：不再区分本地或远程策略，统一从数据库的实体记录中获取源路径。
	//    这遵循了“数据库中存储的路径是可直接使用的”这一设计原则。
	if !file.PrimaryEntityID.Valid {
		return nil, fmt.Errorf("文件 '%s' (ID: %d) 没有关联的物理实体", file.Name, file.ID)
	}

	entity, err := s.entityRepo.FindByID(ctx, uint(file.PrimaryEntityID.Uint64))
	if err != nil {
		return nil, fmt.Errorf("查找文件 '%s' 的物理实体(ID: %d)失败: %w", file.Name, file.PrimaryEntityID.Uint64, err)
	}

	if !entity.Source.Valid || entity.Source.String == "" {
		return nil, fmt.Errorf("文件 '%s' 的物理实体(ID: %d)没有源路径信息", file.Name, entity.ID)
	}

	// 直接使用数据库中存储的路径
	sourceToGet := entity.Source.String

	//  添加调试日志，确认最终传递给 provider 的路径
	log.Printf("[VFS-DEBUG] GetFileReader: 文件ID %d, 策略 '%s', 将使用从数据库实体获取的源路径: '%s'", file.ID, policy.Name, sourceToGet)

	// 5. 从存储驱动获取文件读取器，传入策略上下文和源路径
	return provider.Get(ctx, policy, sourceToGet)
}

// getFilePath 是一个私有辅助函数，用于获取文件的完整虚拟路径
func (s *vfsService) getFilePath(ctx context.Context, file *model.File) (string, error) {
	if !file.ParentID.Valid {
		return "/" + file.Name, nil
	}
	parentPath, err := s.getFolderPath(ctx, uint(file.ParentID.Int64))
	if err != nil {
		return "", err
	}
	return filepath.ToSlash(filepath.Join(parentPath, file.Name)), nil
}

// getFolderPath 是一个私有辅助函数，用于递归获取文件夹的完整路径
func (s *vfsService) getFolderPath(ctx context.Context, folderID uint) (string, error) {
	var pathSegments []string
	currentFolderID := folderID
	for i := 0; i < 100; i++ { // 防止无限循环
		folder, err := s.fileRepo.FindByIDUnscoped(ctx, currentFolderID)
		if err != nil {
			if errors.Is(err, constant.ErrNotFound) {
				return "", fmt.Errorf("路径构建中断，找不到ID为 %d 的父文件夹", currentFolderID)
			}
			return "", fmt.Errorf("查找路径段时失败, ID: %d, err: %w", currentFolderID, err)
		}
		if folder.ParentID.Valid {
			pathSegments = append([]string{folder.Name}, pathSegments...)
			currentFolderID = uint(folder.ParentID.Int64)
		} else {
			// 到达根目录
			return "/" + strings.Join(pathSegments, "/"), nil
		}
	}
	return "", errors.New("目录层级过深或存在循环引用")
}

// getProviderForPolicy 是一个私有辅助函数，用于获取策略对应的存储驱动
func (s *vfsService) getProviderForPolicy(policy *model.StoragePolicy) (storage.IStorageProvider, error) {
	if policy == nil {
		return nil, errors.New("storage policy cannot be nil")
	}
	if policy.Type == constant.PolicyTypeLocal {
		secret := s.settingSvc.Get(constant.KeyLocalFileSigningSecret.String())
		if secret == "" {
			return nil, errors.New("签名密钥为空或未从设置服务中成功加载")
		}
		return storage.NewLocalProvider(secret), nil
	}
	provider, ok := s.storageProviders[policy.Type]
	if !ok {
		return nil, fmt.Errorf("未实现的存储驱动类型: %s", policy.Type)
	}
	return provider, nil
}
