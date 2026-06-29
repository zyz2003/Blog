# Makefile for Anheyu App

# 版本信息
VERSION ?= $(shell git describe --tags --always --dirty)
COMMIT ?= $(shell git rev-parse --short HEAD)
DATE ?= $(shell date -u '+%Y-%m-%d %H:%M:%S')

# 构建参数
LDFLAGS = -X 'github.com/anzhiyu-c/anheyu-app/internal/pkg/version.Version=$(VERSION)' \
          -X 'github.com/anzhiyu-c/anheyu-app/internal/pkg/version.Commit=$(COMMIT)' \
          -X 'github.com/anzhiyu-c/anheyu-app/internal/pkg/version.Date=$(DATE)'

# 默认目标
.PHONY: build
build:
	@echo "Building anheyu-app with version $(VERSION)"
	go build -ldflags "$(LDFLAGS)" -o anheyu-app

# Linux AMD64 构建
.PHONY: build-linux-amd64
build-linux-amd64:
	@echo "Building anheyu-app-linux-amd64 with version $(VERSION)"
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o anheyu-app-linux-amd64

# Linux ARM64 构建
.PHONY: build-linux-arm64
build-linux-arm64:
	@echo "Building anheyu-app-linux-arm64 with version $(VERSION)"
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o anheyu-app-linux-arm64

# 构建所有平台
.PHONY: build-all
build-all: build build-linux-amd64 build-linux-arm64

# 清理构建文件
.PHONY: clean
clean:
	@echo "Cleaning build artifacts"
	rm -f anheyu-app anheyu-app-linux-amd64 anheyu-app-linux-arm64

# 显示版本信息
.PHONY: version
version:
	@echo "Version: $(VERSION)"
	@echo "Commit:  $(COMMIT)"
	@echo "Date:    $(DATE)"

# 运行测试
.PHONY: test
test:
	go test ./...

# 格式化代码
.PHONY: fmt
fmt:
	go fmt ./...

# 静态检查
.PHONY: vet
vet:
	go vet ./...

# 构建 Docker 镜像
.PHONY: docker
docker: build-linux-amd64
	@echo "Building Docker image"
	docker build -t anheyu/anheyu-backend:latest .

# 开发环境快速启动（原有方式，保持兼容）
.PHONY: dev
dev: build-linux-arm64
	@echo "Starting development environment"
	docker compose down
	docker compose up -d --build

# 开发用 compose 文件（挂载本地二进制，避免每次重建镜像）
COMPOSE_DEV = -f docker-compose.yml -f docker-compose.dev.yml

# Docker 开发环境（快速：只编二进制 + 启动，不重建镜像）
# 注意：若新增了前端页面（如 /user-center），需先 make frontend-build 再 make dev-docker-build
.PHONY: dev-docker
dev-docker:
	@echo "🚀 Starting Docker development workflow (fast)..."
	@echo "📦 Stopping existing services..."
	docker compose $(COMPOSE_DEV) down
	@echo "🔨 Building ARM64 binary..."
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o anheyu-app
	@echo "🐳 Starting containers (no image rebuild)..."
	@docker compose $(COMPOSE_DEV) up -d --no-build || \
		(echo "📦 First run or image missing, building image once..."; \
		 docker compose $(COMPOSE_DEV) build && docker compose $(COMPOSE_DEV) up -d --no-build)
	@echo "✅ Development environment ready!"
	@echo "🌐 Application: http://localhost:8091"
	@echo "📊 Version API: http://localhost:8091/api/version"
	@echo "📝 View logs: docker logs anheyu-backend -f"

# 完整重建镜像（Dockerfile 或依赖变更后使用）
.PHONY: dev-docker-build
dev-docker-build:
	@echo "🔨 Full rebuild (image + binary)..."
	docker compose down
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o anheyu-app
	docker compose up -d --build
	@echo "✅ Done. Next time use 'make dev-docker' for fast start."

# 前端 + 镜像完整重建（新增/修改前端页面后使用，确保 8091 能访问新路由）
.PHONY: dev-docker-full
dev-docker-full: frontend-build
	@echo "🔨 Full rebuild (frontend + image + binary)..."
	docker compose down
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o anheyu-app
	docker compose up -d --build
	@echo "✅ Done. New routes (e.g. /user-center) are now available at http://localhost:8091"

# GoReleaser 目标
.PHONY: goreleaser-check
goreleaser-check:
	@echo "Checking GoReleaser configuration"
	goreleaser check

.PHONY: goreleaser-build
goreleaser-build: frontend-build
	@echo "Building with GoReleaser (snapshot mode)"
	goreleaser build --snapshot --clean

.PHONY: goreleaser-release
goreleaser-release: frontend-build
	@echo "Creating release with GoReleaser"
	goreleaser release --clean

.PHONY: goreleaser-release-dry
goreleaser-release-dry: frontend-build
	@echo "Dry run release with GoReleaser"
	goreleaser release --skip=publish --clean

# 前端构建（Next.js）
.PHONY: frontend-build
frontend-build:
	@echo "Building Next.js frontend"
	cd frontend && npm ci && npm run build

# 安装 GoReleaser
.PHONY: install-goreleaser
install-goreleaser:
	@echo "Installing GoReleaser"
	@if ! command -v goreleaser >/dev/null 2>&1; then \
		echo "Installing goreleaser..."; \
		go install github.com/goreleaser/goreleaser/v2@latest; \
	else \
		echo "GoReleaser is already installed"; \
		goreleaser --version; \
	fi

# 工具安装检查
.PHONY: check-tools
check-tools:
	@echo "Checking required tools..."
	@command -v go >/dev/null 2>&1 || { echo "Go is not installed"; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "Node.js is not installed"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "npm is not installed"; exit 1; }
	@command -v goreleaser >/dev/null 2>&1 || { echo "GoReleaser is not installed, run 'make install-goreleaser'"; exit 1; }
	@echo "✅ All tools are available"

# Swagger 文档生成
.PHONY: swagger
swagger:
	@echo "🔄 Generating Swagger documentation files..."
	@command -v swag >/dev/null 2>&1 || { echo "❌ swag is not installed. Run: make install-swag"; exit 1; }
	swag init --parseDependency --parseInternal
	@echo "✅ Swagger documentation files generated successfully!"
	@echo "📄 Generated files:"
	@echo "   - docs/swagger.json  (OpenAPI JSON format)"
	@echo "   - docs/swagger.yaml  (OpenAPI YAML format)"
	@echo "   - docs/docs.go       (Go embedded docs)"
	@echo ""
	@echo "💡 Import swagger.json or swagger.yaml to your API management tool"

# 安装 Swagger 工具
.PHONY: install-swag
install-swag:
	@echo "📦 Installing swag CLI tool..."
	@echo "ℹ️  swag is used to generate Swagger documentation files from Go annotations"
	go install github.com/swaggo/swag/cmd/swag@latest
	@echo "✅ swag installed successfully!"
	@echo ""
	@echo "Usage: make swagger"

# 帮助信息
.PHONY: help
help:
	@echo "Available targets:"
	@echo ""
	@echo "🏗️  Building:"
	@echo "  build              - Build for current platform"
	@echo "  build-linux-amd64  - Build for Linux AMD64"
	@echo "  build-linux-arm64  - Build for Linux ARM64"
	@echo "  build-all          - Build for all platforms"
	@echo "  frontend-build     - Build frontend assets only"
	@echo ""
	@echo "🚀 GoReleaser:"
	@echo "  goreleaser-check   - Check GoReleaser configuration"
	@echo "  goreleaser-build   - Build with GoReleaser (snapshot)"
	@echo "  goreleaser-release - Create release with GoReleaser"
	@echo "  goreleaser-release-dry - Dry run release"
	@echo ""
	@echo "🔧 Tools:"
	@echo "  install-goreleaser - Install GoReleaser"
	@echo "  install-swag       - Install Swagger CLI tool"
	@echo "  check-tools        - Check if required tools are installed"
	@echo ""
	@echo "📚 Documentation:"
	@echo "  swagger            - Generate Swagger documentation files (JSON/YAML)"
	@echo ""
	@echo "🧪 Development:"
	@echo "  test               - Run tests"
	@echo "  fmt                - Format code"
	@echo "  vet                - Run static analysis"
	@echo "  clean              - Clean build artifacts"
	@echo "  version            - Show version information"
	@echo ""
	@echo "🐳 Docker:"
	@echo "  docker             - Build Docker image"
	@echo "  dev                - Start development environment (ARM64)"
	@echo "  dev-docker         - Fast start (binary + up, no image rebuild)"
	@echo "  dev-docker-build  - Full image rebuild (after Dockerfile/frontend change)"
	@echo "  dev-docker-full   - Frontend build + image rebuild (after new pages e.g. /user-center)"
	@echo ""
	@echo "❓ Help:"
	@echo "  help               - Show this help"
