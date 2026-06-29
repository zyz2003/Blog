/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-28 00:21:55
 * @LastEditTime: 2026-02-24 20:00:00
 * @LastEditors: 安知鱼
 */
package main

import (
	"embed"
	"fmt"
	"log"
	"os"

	"github.com/anzhiyu-c/anheyu-app/cmd/server"
	"github.com/anzhiyu-c/anheyu-app/internal/frontend"
)

// @title           Anheyu App API
// @version         1.0
// @description     Anheyu App 应用接口文档
// @termsOfService  http://swagger.io/terms/

// @contact.name   安知鱼
// @contact.url    https://github.com/anzhiyu-c/anheyu-app
// @contact.email  support@anheyu.com

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:8080
// @BasePath  /api

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description 在请求头中添加 Bearer Token，格式为: Bearer {token}

// @externalDocs.description  OpenAPI
// @externalDocs.url          https://swagger.io/resources/open-api/
func main() {
	var emptyFS embed.FS
	app, cleanup, err := server.NewAppWithOptions(emptyFS, server.AppOptions{
		SkipFrontend: true,
	})
	if err != nil {
		log.Fatalf("应用初始化失败: %v", err)
	}
	defer cleanup()
	defer app.Stop()

	if os.Getenv("ANHEYU_LICENSE_KEY") == "" {
		app.PrintBanner()
	}

	// ====== 内置 Next.js 前端 ======
	frontendLauncher := frontend.NewLauncher(frontend.Config{
		FrontendDir: os.Getenv("ANHEYU_FRONTEND_DIR"),
		ExternalURL: os.Getenv("ANHEYU_FRONTEND_URL"),
	})
	if frontendPort := os.Getenv("ANHEYU_FRONTEND_PORT"); frontendPort != "" {
		var port int
		if _, scanErr := fmt.Sscanf(frontendPort, "%d", &port); scanErr == nil && port > 0 {
			frontendLauncher = frontend.NewLauncher(frontend.Config{
				FrontendDir: os.Getenv("ANHEYU_FRONTEND_DIR"),
				Port:        port,
				ExternalURL: os.Getenv("ANHEYU_FRONTEND_URL"),
			})
		}
	}

	engine := app.Engine()
	engine.Use(frontend.ProxyMiddleware(frontendLauncher))
	if frontend.IsStaticModeActive() {
		log.Println("✅ 检测到 static 目录，前台将使用自定义前端")
		log.Println("   管理后台（/admin）仍由 Next.js 提供服务")
		log.Printf("   static 目录路径: %s", frontend.GetStaticDirPath())
	} else {
		log.Println("✅ Next.js 前端反向代理中间件已注册")
	}

	// 即使在自定义前端模式下也启动 Next.js，因为管理后台仍需要它
	if err := frontendLauncher.Start(); err != nil {
		if frontend.IsStaticModeActive() {
			log.Printf("⚠️ Next.js 启动失败（管理后台可能不可用）: %v", err)
			log.Println("   前台自定义前端不受影响，将从 static 目录提供服务")
		} else {
			log.Printf("⚠️ 内置前端启动失败: %v", err)
			log.Println("   提示: 请确保已执行 'make frontend-build'，或设置 ANHEYU_FRONTEND_URL 使用外部前端服务")
		}
	} else {
		defer frontendLauncher.Stop()
		if frontend.IsStaticModeActive() {
			log.Printf("✅ 前台: 自定义前端（static 目录）  后台: %s", frontendLauncher.GetFrontendURL())
		} else {
			log.Printf("✅ 前端服务地址: %s", frontendLauncher.GetFrontendURL())
		}
	}

	if err := app.Run(); err != nil {
		log.Fatalf("应用运行失败: %v", err)
	}
}
