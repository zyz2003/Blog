/*
 * @Description: 站点地图服务
 * @Author: 安知鱼
 * @Date: 2025-09-21 00:00:00
 * @LastEditTime: 2025-10-08 22:47:02
 * @LastEditors: 安知鱼
 */
package sitemap

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

// Service 站点地图服务接口
type Service interface {
	// GenerateSitemap 生成站点地图
	GenerateSitemap(ctx context.Context) (*URLSet, error)
	// GenerateRobots 生成robots.txt
	GenerateRobots(ctx context.Context) (string, error)
}

// service 站点地图服务实现
type service struct {
	articleRepo repository.ArticleRepository
	pageRepo    repository.PageRepository
	linkRepo    repository.LinkRepository
	settingSvc  setting.SettingService
}

// NewService 创建站点地图服务
func NewService(
	articleRepo repository.ArticleRepository,
	pageRepo repository.PageRepository,
	linkRepo repository.LinkRepository,
	settingSvc setting.SettingService,
) Service {
	return &service{
		articleRepo: articleRepo,
		pageRepo:    pageRepo,
		linkRepo:    linkRepo,
		settingSvc:  settingSvc,
	}
}

// defaultBaseURL 当 SITE_URL 未配置时使用的 fallback，与 GenerateRobots 保持一致
const defaultBaseURL = "https://blog.anheyu.com"

// getBaseURL 返回站点 URL，未配置时使用 defaultBaseURL 并打日志
func (s *service) getBaseURL() string {
	baseURL := strings.TrimSpace(s.settingSvc.Get(constant.KeySiteURL.String()))
	if baseURL == "" {
		log.Printf("[sitemap] 站点URL未配置，使用默认值: %s", defaultBaseURL)
		baseURL = defaultBaseURL
	}
	if len(baseURL) > 0 && baseURL[len(baseURL)-1] == '/' {
		baseURL = baseURL[:len(baseURL)-1]
	}
	return baseURL
}

// GenerateSitemap 生成站点地图
// 支持智能缓存：频繁访问时使用缓存，内容更新时自动失效
func (s *service) GenerateSitemap(ctx context.Context) (*URLSet, error) {
	baseURL := s.getBaseURL()

	var items []SitemapItem

	// 添加主页
	items = append(items, SitemapItem{
		URL:          baseURL + "/",
		LastModified: time.Now(),
		ChangeFreq:   ChangeFreqDaily,
		Priority:     1.0,
	})

	// 添加文章
	if err := s.addArticles(ctx, baseURL, &items); err != nil {
		log.Printf("添加文章到站点地图时出错: %v", err)
	}

	// 添加页面
	if err := s.addPages(ctx, baseURL, &items); err != nil {
		log.Printf("添加页面到站点地图时出错: %v", err)
	}

	// 添加友链页面
	if err := s.addLinkPages(ctx, baseURL, &items); err != nil {
		log.Printf("添加友链页面到站点地图时出错: %v", err)
	}

	// 转换为URLSet
	urlset := &URLSet{
		Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
		URLs:  make([]URL, len(items)),
	}

	for i, item := range items {
		urlset.URLs[i] = item.ToURL()
	}

	return urlset, nil
}

// addArticles 添加文章到站点地图
func (s *service) addArticles(ctx context.Context, baseURL string, items *[]SitemapItem) error {
	// 使用 ListPublic 而非 List，避免加载 ContentMd/ContentHTML 等大字段，
	// 且 ListPublic 自动过滤下架文章和待审核文章
	articles, _, err := s.articleRepo.ListPublic(ctx, &model.ListPublicArticlesOptions{
		Page:     1,
		PageSize: 10000,
	})
	if err != nil {
		return fmt.Errorf("获取文章列表失败: %w", err)
	}

	log.Printf("[DEBUG] 找到 %d 篇已发布文章用于生成站点地图", len(articles))

	for _, article := range articles {
		log.Printf("[DEBUG] 处理文章: ID=%s, Title=%s, Abbrlink=%s", article.ID, article.Title, article.Abbrlink)

		// 根据文章更新时间确定优先级和更新频率
		timeSinceUpdate := time.Since(article.UpdatedAt)
		var changeFreq ChangeFrequency
		var priority float32

		if timeSinceUpdate < 24*time.Hour {
			changeFreq = ChangeFreqDaily
			priority = 0.9
		} else if timeSinceUpdate < 7*24*time.Hour {
			changeFreq = ChangeFreqWeekly
			priority = 0.8
		} else if timeSinceUpdate < 30*24*time.Hour {
			changeFreq = ChangeFreqMonthly
			priority = 0.7
		} else {
			changeFreq = ChangeFreqYearly
			priority = 0.6
		}

		// 构建文章URL，优先使用abbrlink，如果为空则使用ID
		var articleSlug string
		if article.Abbrlink != "" {
			articleSlug = article.Abbrlink
		} else {
			articleSlug = article.ID
		}
		articleURL := fmt.Sprintf("%s/posts/%s", baseURL, articleSlug)
		log.Printf("[DEBUG] 生成文章URL: %s", articleURL)

		*items = append(*items, SitemapItem{
			URL:          articleURL,
			LastModified: article.UpdatedAt,
			ChangeFreq:   changeFreq,
			Priority:     priority,
		})
	}

	return nil
}

// addPages 添加页面到站点地图
func (s *service) addPages(ctx context.Context, baseURL string, items *[]SitemapItem) error {
	pages, _, err := s.pageRepo.List(ctx, &model.ListPagesOptions{
		IsPublished: &[]bool{true}[0], // 只获取已发布的页面
	})
	if err != nil {
		return fmt.Errorf("获取页面列表失败: %w", err)
	}

	for _, page := range pages {
		// 移除page.Path开头的斜杠，避免双斜杠问题
		pagePath := strings.TrimPrefix(page.Path, "/")
		pageURL := fmt.Sprintf("%s/%s", baseURL, pagePath)

		*items = append(*items, SitemapItem{
			URL:          pageURL,
			LastModified: page.UpdatedAt,
			ChangeFreq:   ChangeFreqMonthly,
			Priority:     0.5,
		})
	}

	return nil
}

// addLinkPages 添加友链相关页面到站点地图
func (s *service) addLinkPages(ctx context.Context, baseURL string, items *[]SitemapItem) error {
	// 添加友链主页面
	*items = append(*items, SitemapItem{
		URL:          baseURL + "/link",
		LastModified: time.Now(),
		ChangeFreq:   ChangeFreqWeekly,
		Priority:     0.6,
	})

	// 可以根据需要添加其他固定页面
	commonPages := []struct {
		path     string
		priority float32
		freq     ChangeFrequency
	}{
		{"/archives", 0.7, ChangeFreqDaily},
		{"/categories", 0.6, ChangeFreqWeekly},
		{"/tags", 0.6, ChangeFreqWeekly},
		{"/about", 0.5, ChangeFreqMonthly},
	}

	for _, page := range commonPages {
		*items = append(*items, SitemapItem{
			URL:          baseURL + page.path,
			LastModified: time.Now(),
			ChangeFreq:   page.freq,
			Priority:     page.priority,
		})
	}

	return nil
}

// GenerateRobots 生成robots.txt
func (s *service) GenerateRobots(ctx context.Context) (string, error) {
	baseURL := s.getBaseURL()

	robotsContent := fmt.Sprintf(`User-agent: *
Allow: /

# 禁止访问管理后台
Disallow: /admin/

# 禁止访问静态文件目录（如果不希望索引）
# Disallow: /static/

# 站点地图
Sitemap: %s/sitemap.xml
`, baseURL)

	return robotsContent, nil
}
