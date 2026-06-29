// anheyu-app/pkg/service/direct_link/service.go
package direct_link

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"path"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

type Service interface {
	GetOrCreateDirectLinks(ctx context.Context, userGroupID uint, fileIDs []uint) (map[uint]BatchLinkResult, error)
	PrepareDownload(ctx context.Context, publicID string) (*model.File, string, *model.StoragePolicy, int64, error)
}

type directLinkServiceImpl struct {
	directLinkRepo    repository.DirectLinkRepository
	fileRepo          repository.FileRepository
	userGroupRepo     repository.UserGroupRepository
	settingSvc        setting.SettingService
	storagePolicyRepo repository.StoragePolicyRepository
}

func NewDirectLinkService(
	directLinkRepo repository.DirectLinkRepository,
	fileRepo repository.FileRepository,
	userGroupRepo repository.UserGroupRepository,
	settingSvc setting.SettingService,
	storagePolicyRepo repository.StoragePolicyRepository,
) Service {
	return &directLinkServiceImpl{
		directLinkRepo:    directLinkRepo,
		fileRepo:          fileRepo,
		userGroupRepo:     userGroupRepo,
		settingSvc:        settingSvc,
		storagePolicyRepo: storagePolicyRepo,
	}
}

// BatchLinkResult 定义了批量获取直链时，每个文件的返回结果结构。
type BatchLinkResult struct {
	URL        string
	VirtualURI string
}

// GetOrCreateDirectLinks 获取或创建批量文件的直链。
func (s *directLinkServiceImpl) GetOrCreateDirectLinks(ctx context.Context, userGroupID uint, fileIDs []uint) (map[uint]BatchLinkResult, error) {
	// 1. 获取用户组信息并处理限速
	var speedLimitBytes int64
	if userGroupID > 0 {
		userGroup, err := s.userGroupRepo.FindByID(ctx, userGroupID)
		if err != nil {
			return nil, fmt.Errorf("查找用户组信息失败: %w", err)
		}
		if userGroup != nil {
			speedLimitBytes = userGroup.SpeedLimit * 1024 * 1024
		}
	}

	// 2. 批量获取文件信息
	files, err := s.fileRepo.FindBatchByIDs(ctx, fileIDs)
	if err != nil {
		return nil, fmt.Errorf("批量查找文件信息失败: %w", err)
	}
	if len(files) != len(fileIDs) {
		log.Printf("警告：请求 %d 个文件，但只找到了 %d 个", len(fileIDs), len(files))
	}

	// 3. 准备“查找或创建”的直链模型，并加入【关键的权限检查】
	linksToProcess := make([]*model.DirectLink, 0, len(files)) // 初始化容量
	for _, file := range files {
		// --- 安全检查 ---
		// 此处约定：
		// - userGroupID = 0: 代表一个系统内部的、匿名的调用（例如PRO版的图片代理）。
		//   这种调用只允许为系统所有（OwnerID=1）的公共资源创建链接。
		// - userGroupID > 0: 代表一个真实的用户组。由于函数签名限制，无法获得 viewerID，
		//   因此无法在此处校验文件所有权。这是一个待改进的设计。
		//   暂时只保护系统调用，防止它访问用户私有文件。
		if userGroupID == 0 && file.OwnerID != 1 {
			log.Printf("安全警告：检测到匿名调用 (userGroupID=0) 尝试为用户私有文件 (FileID: %d, OwnerID: %d) 创建直链，操作已被拒绝。", file.ID, file.OwnerID)
			continue // 跳过这个文件，不允许创建链接
		}

		linksToProcess = append(linksToProcess, &model.DirectLink{
			FileID:     file.ID,
			FileName:   file.Name,
			SpeedLimit: speedLimitBytes,
		})
	}

	// 如果经过权限过滤后，没有文件可供处理，则提前返回
	if len(linksToProcess) == 0 {
		return make(map[uint]BatchLinkResult), nil
	}

	// 4. 调用仓库进行“查找或创建”操作
	if err := s.directLinkRepo.FindOrCreateBatch(ctx, linksToProcess); err != nil {
		return nil, fmt.Errorf("获取或创建直链记录失败: %w", err)
	}

	// 5. 组装最终返回的 Map
	siteURL := s.settingSvc.Get(constant.KeySiteURL.String())
	result := make(map[uint]BatchLinkResult)

	for _, link := range linksToProcess {
		publicID, err := idgen.GeneratePublicID(link.ID, idgen.EntityTypeDirectLink)
		if err != nil {
			log.Printf("警告：未能为直链ID %d 生成公共ID: %v", link.ID, err)
			continue
		}
		ancestors, err := s.fileRepo.FindAncestors(ctx, link.FileID)
		var virtualURI string
		if err != nil {
			log.Printf("警告：未能为文件ID %d 查找祖先路径: %v", link.FileID, err)
			virtualURI = fmt.Sprintf("anzhiyu://my/%s", link.FileName)
		} else {
			var pathSegments []string
			for i := len(ancestors) - 1; i >= 0; i-- {
				pathSegments = append(pathSegments, ancestors[i].Name)
			}
			filePath := path.Join(pathSegments...)
			virtualURI = fmt.Sprintf("anzhiyu://my/%s", filePath)
		}
		trimmedSiteURL := strings.TrimSuffix(siteURL, "/")
		encodedFileName := url.PathEscape(link.FileName)
		fullURL := fmt.Sprintf("%s/api/f/%s/%s", trimmedSiteURL, publicID, encodedFileName)
		result[link.FileID] = BatchLinkResult{
			URL:        fullURL,
			VirtualURI: virtualURI,
		}
	}

	return result, nil
}

// PrepareDownload 处理下载请求，返回文件、策略和限速值。
func (s *directLinkServiceImpl) PrepareDownload(ctx context.Context, publicID string) (*model.File, string, *model.StoragePolicy, int64, error) {
	// 1. 从数据库查找直链记录。
	link, err := s.directLinkRepo.FindByPublicID(ctx, publicID)
	if err != nil {
		return nil, "", nil, 0, fmt.Errorf("查找直链时发生数据库错误: %w", err)
	}
	if link == nil {
		return nil, "", nil, 0, fmt.Errorf("直链不存在或已失效")
	}

	// 2. 启动一个新的 Goroutine 在后台异步增加下载次数
	go func() {
		if err := s.directLinkRepo.IncrementDownloads(context.Background(), link.ID); err != nil {
			log.Printf("增加下载次数失败 [LinkID: %d]: %v", link.ID, err)
		}
	}()

	// 3. 健壮性检查
	if link.File == nil || link.File.PrimaryEntity == nil {
		return nil, "", nil, 0, fmt.Errorf("直链关联的文件或物理实体信息不完整")
	}

	// 4. 从文件的物理实体中获取存储策略ID
	policyID := link.File.PrimaryEntity.PolicyID

	// 5. 使用 PolicyID 精确查找对应的存储策略记录
	policy, err := s.storagePolicyRepo.FindByID(ctx, policyID)
	if err != nil {
		return nil, "", nil, 0, fmt.Errorf("查找存储策略失败 [ID: %d]: %w", policyID, err)
	}
	if policy == nil {
		return nil, "", nil, 0, fmt.Errorf("找不到ID为 %d 的存储策略，数据可能已不一致", policyID)
	}

	// 6. 返回5个值，将创建时快照的 link.FileName 加入返回列表
	return link.File, link.FileName, policy, link.SpeedLimit, nil
}
