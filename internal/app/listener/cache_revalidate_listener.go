/*
 * @Description: 缓存清理事件监听器
 * @Author: 安知鱼
 * @Date: 2025-01-26
 *
 * 监听数据变更事件，自动调用 Next.js 缓存清理 API
 */
package listener

import (
	"log"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/internal/service/cache"
)

// CacheRevalidateListener 缓存清理事件监听器
type CacheRevalidateListener struct {
	revalidateService *cache.RevalidateService
}

// NewCacheRevalidateListener 创建缓存清理监听器
func NewCacheRevalidateListener(revalidateService *cache.RevalidateService) *CacheRevalidateListener {
	return &CacheRevalidateListener{
		revalidateService: revalidateService,
	}
}

// RegisterHandlers 注册事件处理器
func (l *CacheRevalidateListener) RegisterHandlers(bus *event.EventBus) {
	if !l.revalidateService.IsEnabled() {
		log.Println("[CacheRevalidateListener] SSR mode not enabled, skipping cache revalidation handlers")
		return
	}

	log.Println("[CacheRevalidateListener] Registering cache revalidation handlers")

	// 文章事件
	bus.Subscribe(event.ArticleCreated, l.onArticleChange)
	bus.Subscribe(event.ArticleUpdated, l.onArticleChange)
	bus.Subscribe(event.ArticleDeleted, l.onArticleChange)
	bus.Subscribe(event.ArticlePublished, l.onArticleChange)

	// 配置事件
	bus.Subscribe(event.SiteConfigUpdated, l.onSiteConfigChange)

	// 分类/标签事件
	bus.Subscribe(event.CategoryUpdated, l.onCategoryChange)
	bus.Subscribe(event.TagUpdated, l.onTagChange)

	// 友链事件
	bus.Subscribe(event.LinkCreated, l.onFriendLinkChange)
	bus.Subscribe(event.LinkUpdated, l.onFriendLinkChange)
	bus.Subscribe(event.LinkDeleted, l.onFriendLinkChange)
}

// onArticleChange 文章变更时清理缓存
func (l *CacheRevalidateListener) onArticleChange(payload interface{}) {
	if p, ok := payload.(*event.ArticlePayload); ok && (p.Slug != "" || p.PublicID != "") {
		if err := l.revalidateService.RevalidateArticle(p.Slug, p.PublicID); err != nil {
			log.Printf("[CacheRevalidateListener] Failed to revalidate article slug=%s id=%s: %v", p.Slug, p.PublicID, err)
		}
	} else {
		if err := l.revalidateService.RevalidateAll(); err != nil {
			log.Printf("[CacheRevalidateListener] Failed to revalidate all: %v", err)
		}
	}
}

// onSiteConfigChange 站点配置变更时清理缓存
func (l *CacheRevalidateListener) onSiteConfigChange(payload interface{}) {
	if err := l.revalidateService.RevalidateSiteConfig(); err != nil {
		log.Printf("[CacheRevalidateListener] Failed to revalidate site config: %v", err)
	}
}

// onCategoryChange 分类变更时清理缓存
func (l *CacheRevalidateListener) onCategoryChange(payload interface{}) {
	if err := l.revalidateService.RevalidateCategories(); err != nil {
		log.Printf("[CacheRevalidateListener] Failed to revalidate categories: %v", err)
	}
}

// onTagChange 标签变更时清理缓存
func (l *CacheRevalidateListener) onTagChange(payload interface{}) {
	if err := l.revalidateService.RevalidateTags(); err != nil {
		log.Printf("[CacheRevalidateListener] Failed to revalidate tags: %v", err)
	}
}

// onFriendLinkChange 友链变更时清理缓存
func (l *CacheRevalidateListener) onFriendLinkChange(payload interface{}) {
	if err := l.revalidateService.RevalidateFriendLinks(); err != nil {
		log.Printf("[CacheRevalidateListener] Failed to revalidate friend links: %v", err)
	}
}
