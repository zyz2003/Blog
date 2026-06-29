// internal/app/bootstrap/bootstrap.go
package bootstrap

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"entgo.io/ent/dialect/sql"
	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/file"
	"github.com/anzhiyu-c/anheyu-app/ent/link"
	"github.com/anzhiyu-c/anheyu-app/ent/linkcategory"
	"github.com/anzhiyu-c/anheyu-app/ent/setting"
	"github.com/anzhiyu-c/anheyu-app/ent/usergroup"
	"github.com/anzhiyu-c/anheyu-app/internal/configdef"
	ent_impl "github.com/anzhiyu-c/anheyu-app/internal/infra/persistence/ent"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/utils"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	image_style_engine "github.com/anzhiyu-c/anheyu-app/pkg/service/image_style/engine"
	page_service "github.com/anzhiyu-c/anheyu-app/pkg/service/page"
)

type Bootstrapper struct {
	entClient *ent.Client
}

func NewBootstrapper(entClient *ent.Client) *Bootstrapper {
	return &Bootstrapper{
		entClient: entClient,
	}
}

func (b *Bootstrapper) InitializeDatabase() error {
	log.Println("--- 开始执行数据库初始化引导程序 (配置注册表模式) ---")

	if err := b.entClient.Schema.Create(context.Background()); err != nil {
		return fmt.Errorf("数据库 schema 创建/更新失败: %w", err)
	}
	log.Println("--- 数据库 Schema 同步成功 ---")

	b.syncSettings()
	b.initUserGroups()
	b.initStoragePolicies()
	b.initLinks()
	b.initDefaultPages()
	b.checkUserTable()
	b.printImageStyleDiagnostic()

	log.Println("--- 数据库初始化引导程序执行完成 ---")
	return nil
}

// printImageStyleDiagnostic 在启动时输出图片样式引擎的可用性诊断。
// Probe() 结果在进程内缓存，这里的调用与 app.go 里装配 AutoEngine 时的 Probe 共享结果。
//
// 日志格式刻意与 Plan B §Phase 2 保持一致：
//   - 有 vips：`✅ 图片样式引擎：vips <version> @ <binary>` + 两行格式清单
//   - 无 vips：`⚠️  未检测到 vips，使用纯 Go 降级模式` + 原生支持格式
func (b *Bootstrapper) printImageStyleDiagnostic() {
	capability := image_style_engine.Probe()
	if capability.Available {
		log.Printf("✅ 图片样式引擎：vips %s @ %s", capability.Version, capability.BinaryPath)
		if len(capability.InputFormats) > 0 {
			log.Printf("   输入格式: %s", strings.Join(capability.InputFormats, ", "))
		}
		if len(capability.OutputFormats) > 0 {
			log.Printf("   输出格式: %s", strings.Join(capability.OutputFormats, ", "))
		}
		return
	}

	log.Println("⚠️  未检测到 vips CLI，使用纯 Go 降级模式")
	log.Println("   支持输入: jpeg, png, webp, gif（首帧）")
	log.Println("   支持输出: jpeg, png")
}

// syncSettings 检查并同步配置项，确保所有在代码中定义的配置项都存在于数据库中。
func (b *Bootstrapper) syncSettings() {
	log.Println("--- 开始同步站点配置 (Setting 表)... ---")
	ctx := context.Background()
	newlyAdded := 0

	// 从 configdef 循环所有定义
	for _, def := range configdef.AllSettings {
		exists, err := b.entClient.Setting.Query().Where(setting.ConfigKey(def.Key.String())).Exist(ctx)
		if err != nil {
			log.Printf("⚠️ 失败: 查询配置项 '%s' 失败: %v", def.Key, err)
			continue
		}

		// 如果配置项在数据库中不存在，则创建它
		if !exists {
			value := def.Value
			// 特殊处理需要动态生成的密钥
			if def.Key == constant.KeyJWTSecret {
				value, _ = utils.GenerateRandomString(32)
			}
			if def.Key == constant.KeyLocalFileSigningSecret {
				value, _ = utils.GenerateRandomString(32)
			}

			// 检查环境变量覆盖
			envKey := "AN_SETTING_DEFAULT_" + strings.ToUpper(string(def.Key))
			if envValue, ok := os.LookupEnv(envKey); ok {
				value = envValue
				log.Printf("    - 配置项 '%s' 由环境变量覆盖。", def.Key)
			}

			_, createErr := b.entClient.Setting.Create().
				SetConfigKey(def.Key.String()).
				SetValue(value).
				SetComment(def.Comment).
				Save(ctx)

			if createErr != nil {
				log.Printf("⚠️ 失败: 新增默认配置项 '%s' 失败: %v", def.Key, createErr)
			} else {
				log.Printf("    -新增配置项: '%s' 已写入数据库。", def.Key)
				newlyAdded++
			}
		}
	}

	if newlyAdded > 0 {
		log.Printf("--- 站点配置同步完成，共新增 %d 个配置项。---", newlyAdded)
	} else {
		log.Println("--- 站点配置同步完成，无需新增配置项。---")
	}
}

// initUserGroups 检查并初始化默认用户组。
func (b *Bootstrapper) initUserGroups() {
	log.Println("--- 开始初始化默认用户组 (UserGroup 表) ---")
	ctx := context.Background()
	for _, groupData := range configdef.AllUserGroups {
		exists, err := b.entClient.UserGroup.Query().Where(usergroup.ID(groupData.ID)).Exist(ctx)
		if err != nil {
			log.Printf("⚠️ 失败: 查询用户组 ID: %d 失败: %v", groupData.ID, err)
			continue
		}
		if !exists {
			_, createErr := b.entClient.UserGroup.Create().
				SetID(groupData.ID).
				SetName(groupData.Name).
				SetDescription(groupData.Description).
				SetPermissions(groupData.Permissions).
				SetMaxStorage(groupData.MaxStorage).
				SetSpeedLimit(groupData.SpeedLimit).
				SetSettings(&groupData.Settings).
				Save(ctx)
			if createErr != nil {
				log.Printf("⚠️ 失败: 创建默认用户组 '%s' (ID: %d) 失败: %v", groupData.Name, groupData.ID, createErr)
			}
		}
	}
	log.Println("--- 默认用户组 (UserGroup 表) 初始化完成。---")
}

func (b *Bootstrapper) initStoragePolicies() {
	log.Println("--- 开始初始化默认存储策略 (StoragePolicy 表) ---")
	ctx := context.Background()
	count, err := b.entClient.StoragePolicy.Query().Count(ctx)
	if err != nil {
		log.Printf("⚠️ 失败: 查询存储策略数量失败: %v", err)
		return
	}

	if count == 0 {
		wd, err := os.Getwd()
		if err != nil {
			log.Fatalf("❌ 致命错误: 无法获取当前工作目录: %v", err)
		}
		dirNameRule := filepath.Join(wd, "data/storage")

		settings := model.StoragePolicySettings{
			"chunk_size":    26214400,
			"pre_allocate":  true,
			"upload_method": constant.UploadMethodClient,
		}

		_, err = b.entClient.StoragePolicy.Create().
			SetName("本机存储").
			SetType(string(constant.PolicyTypeLocal)).
			SetBasePath(dirNameRule).
			SetVirtualPath("/").
			SetSettings(settings).
			Save(ctx)

		if err != nil {
			log.Printf("⚠️ 失败: 创建默认存储策略 '本机存储' 失败: %v", err)
		} else {
			log.Printf("✅ 成功: 默认存储策略 '本机存储' 已创建。路径规则: %s", dirNameRule)
		}
	}

	// 确保用户头像存储策略存在（适配系统升级的情况）
	b.ensureAvatarStoragePolicy()

	log.Println("--- 默认存储策略 (StoragePolicy 表) 初始化完成。---")
}

// ensureAvatarStoragePolicy 确保用户头像存储策略存在
// 在系统启动时检查，如果不存在则创建（适配系统升级的情况）
func (b *Bootstrapper) ensureAvatarStoragePolicy() {
	ctx := context.Background()

	// 检查是否已存在用户头像存储策略
	count, err := b.entClient.StoragePolicy.Query().
		Where(func(s *sql.Selector) {
			s.Where(sql.EQ("flag", constant.PolicyFlagUserAvatar))
		}).
		Count(ctx)

	if err != nil {
		log.Printf("⚠️ 警告: 检查用户头像存储策略失败: %v", err)
		return
	}

	if count > 0 {
		log.Println("✅ 用户头像存储策略已存在，跳过创建")
		return
	}

	// 获取第一个用户（管理员）作为系统目录的所有者
	firstUser, err := b.entClient.User.Query().Order(ent.Asc("id")).First(ctx)
	if err != nil {
		log.Printf("⚠️ 警告: 无法获取第一个用户，跳过创建用户头像存储策略: %v", err)
		return
	}

	// 获取或创建用户的根目录
	userRootDir, err := b.entClient.File.Query().
		Where(
			file.OwnerID(firstUser.ID),
			file.ParentIDIsNil(),
		).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			// 创建根目录
			userRootDir, err = b.entClient.File.Create().
				SetOwnerID(firstUser.ID).
				SetName("").
				SetType(int(model.FileTypeDir)).
				Save(ctx)
			if err != nil {
				log.Printf("⚠️ 警告: 创建用户根目录失败: %v", err)
				return
			}
		} else {
			log.Printf("⚠️ 警告: 查询用户根目录失败: %v", err)
			return
		}
	}

	// 创建用户头像存储策略
	wd, err := os.Getwd()
	if err != nil {
		log.Printf("⚠️ 警告: 无法获取当前工作目录: %v", err)
		return
	}

	avatarPath := filepath.Join(wd, constant.DefaultAvatarPolicyPath)

	// 1. 查找或创建 VFS 目录
	avatarDir, err := b.entClient.File.Query().
		Where(
			file.OwnerID(firstUser.ID),
			file.ParentID(userRootDir.ID),
			file.Name(constant.PolicyFlagUserAvatar),
		).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			// VFS 目录不存在，创建它
			avatarDir, err = b.entClient.File.Create().
				SetOwnerID(firstUser.ID).
				SetParentID(userRootDir.ID).
				SetName(constant.PolicyFlagUserAvatar).
				SetType(int(model.FileTypeDir)).
				Save(ctx)

			if err != nil {
				log.Printf("⚠️ 警告: 创建用户头像 VFS 目录失败: %v", err)
				return
			}
			log.Printf("✅ VFS 目录 '/user_avatar' 创建成功。")
		} else {
			log.Printf("⚠️ 警告: 查询用户头像 VFS 目录失败: %v", err)
			return
		}
	} else {
		log.Printf("✅ VFS 目录 '/user_avatar' 已存在。")
	}

	// 2. 再创建策略，并关联 NodeID
	settings := model.StoragePolicySettings{
		"chunk_size":         5242880, // 5MB，头像文件通常较小
		"pre_allocate":       true,
		"upload_method":      constant.UploadMethodServer, // 头像使用服务端上传
		"allowed_extensions": []string{".jpg", ".jpeg", ".png", ".gif", ".webp"},
	}

	_, err = b.entClient.StoragePolicy.Create().
		SetName(constant.DefaultAvatarPolicyName).
		SetType(string(constant.PolicyTypeLocal)).
		SetFlag(constant.PolicyFlagUserAvatar).
		SetBasePath(avatarPath).
		SetVirtualPath("/user_avatar").
		SetMaxSize(5242880).     // 5MB 最大文件大小
		SetNodeID(avatarDir.ID). // 关联 VFS 目录节点
		SetSettings(settings).
		Save(ctx)

	if err != nil {
		log.Printf("⚠️ 警告: 创建用户头像存储策略失败: %v", err)
	} else {
		log.Printf("✅ 成功: 用户头像存储策略已创建。路径: %s", avatarPath)
	}
}

// initLinks 初始化友链、分类和标签表。
func (b *Bootstrapper) initLinks() {
	log.Println("--- 开始初始化友链模块 (Link, Category, Tag 表) ---")
	ctx := context.Background()

	count, err := b.entClient.Link.Query().Count(ctx)
	if err != nil {
		log.Printf("⚠️ 失败: 查询友链数量失败: %v", err)
		return
	}
	if count > 0 {
		log.Println("--- 友链模块已存在数据，跳过初始化。---")
		return
	}

	tx, err := b.entClient.Tx(ctx)
	if err != nil {
		log.Printf("⚠️ 失败: 启动友链初始化事务失败: %v", err)
		return
	}

	defer func() {
		if v := recover(); v != nil {
			tx.Rollback()
			panic(v)
		}
	}()

	// --- 1. 创建默认分类 ---
	catTuijian, err := tx.LinkCategory.Create().
		SetName("推荐").
		SetStyle(linkcategory.StyleCard).
		SetDescription("优秀博主，综合排序。").
		Save(ctx)
	if err != nil {
		log.Printf("⚠️ 失败: 创建默认友链分类 '推荐' 失败: %v", tx.Rollback())
		return
	}
	if catTuijian.ID != 1 {
		log.Printf("🔥 严重警告: '推荐' 分类创建后的 ID 不是 1 (而是 %d)。", catTuijian.ID)
	}

	// 接着创建“小伙伴”，它会自动获得 ID=2
	catShuoban, err := tx.LinkCategory.Create().
		SetName("小伙伴").
		SetStyle(linkcategory.StyleList).
		SetDescription("那些人，那些事").
		Save(ctx)
	if err != nil {
		log.Printf("⚠️ 失败: 创建默认友链分类 '小伙伴' 失败: %v", tx.Rollback())
		return
	}
	// 健壮性检查：确认默认分类的 ID 确实是 2
	if catShuoban.ID != 2 {
		log.Printf("🔥 严重警告: 默认分类 '小伙伴' 创建后的 ID 不是 2 (而是 %d)。申请友链的默认分类功能可能不正常。", catShuoban.ID)
	}
	log.Println("    -默认分类 '推荐' 和 '小伙伴' 创建成功。")

	// --- 2. 创建默认标签 ---
	tagTech, err := tx.LinkTag.Create().
		SetName("技术").
		SetColor("linear-gradient(38deg,#e5b085 0,#d48f16 100%)").
		Save(ctx)
	if err != nil {
		log.Printf("⚠️ 失败: 创建默认友链标签 '技术' 失败: %v", tx.Rollback())
		return
	}
	_, err = tx.LinkTag.Create().
		SetName("生活").
		SetColor("var(--anzhiyu-green)").
		Save(ctx)
	if err != nil {
		log.Printf("⚠️ 失败: 创建默认友链标签 '生活' 失败: %v", tx.Rollback())
		return
	}
	log.Println("    -默认标签 '技术' 和 '生活' 创建成功。")

	// --- 3. 创建默认友链并关联 ---
	_, err = tx.Link.Create().
		SetName("安知鱼").
		SetURL("https://blog.anheyu.com/").
		SetLogo("https://npm.elemecdn.com/anzhiyu-blog-static@1.0.4/img/avatar.jpg").
		SetDescription("生活明朗，万物可爱").
		SetSiteshot("https://npm.elemecdn.com/anzhiyu-theme-static@1.1.6/img/blog.anheyu.com.jpg"). // 添加站点快照
		SetStatus(link.StatusAPPROVED).
		SetCategoryID(catTuijian.ID). // 关联到"推荐"分类 (ID=1)
		AddTagIDs(tagTech.ID).
		Save(ctx)
	if err != nil {
		log.Printf("⚠️ 失败: 创建默认友链 '安知鱼' 失败: %v", tx.Rollback())
		return
	}
	log.Println("    -默认友链 '安知鱼' (卡片样式) 创建成功。")

	// 创建第二个默认友链，使用list样式的分类
	_, err = tx.Link.Create().
		SetName("安知鱼").
		SetURL("https://blog.anheyu.com/").
		SetLogo("https://npm.elemecdn.com/anzhiyu-blog-static@1.0.4/img/avatar.jpg").
		SetDescription("生活明朗，万物可爱").
		SetStatus(link.StatusAPPROVED).
		SetCategoryID(catShuoban.ID).
		AddTagIDs(tagTech.ID).
		Save(ctx)
	if err != nil {
		log.Printf("⚠️ 失败: 创建默认友链 '安知鱼' (list样式) 失败: %v", tx.Rollback())
		return
	}
	log.Println("    -默认友链 '安知鱼' (列表样式) 创建成功。")

	if err := tx.Commit(); err != nil {
		log.Printf("⚠️ 失败: 提交友链初始化事务失败: %v", err)
		return
	}

	log.Println("--- 友链模块初始化完成。---")
}

func (b *Bootstrapper) checkUserTable() {
	ctx := context.Background()
	userCount, err := b.entClient.User.Query().Count(ctx)
	if err != nil {
		log.Printf("❌ 错误: 查询 User 表记录数量失败: %v", err)
	} else if userCount == 0 {
		log.Println("User 表为空，第一个注册的用户将成为管理员。")
	}
}

// initDefaultPages 检查并初始化默认页面
func (b *Bootstrapper) initDefaultPages() {
	log.Println("--- 开始初始化默认页面 (Page 表) ---")
	ctx := context.Background()

	pageRepo := ent_impl.NewEntPageRepository(b.entClient)
	pageSvc := page_service.NewService(pageRepo)

	if err := pageSvc.InitializeDefaultPages(ctx); err != nil {
		log.Printf("⚠️ 失败: 初始化默认页面失败: %v", err)
		return
	}

	createdCount, countErr := b.entClient.Page.Query().Count(ctx)
	if countErr != nil {
		log.Printf("--- 默认页面初始化完成。---")
		return
	}

	log.Printf("--- 默认页面初始化完成，当前页面总数 %d。---", createdCount)
}
