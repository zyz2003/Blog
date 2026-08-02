#!/bin/bash
# anheyu-app 裸机一键安装脚本（systemd + Nginx）
# 用法：sudo bash deploy/install.sh [your-domain.com]
#
# 前置：Node.js v22+、npm、nginx、rsync 已安装
# 安装目录默认 /opt/anheyu，可通过 INSTALL_DIR 环境变量覆盖
set -e

DOMAIN="${1:-}"
INSTALL_DIR="${INSTALL_DIR:-/opt/anheyu}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo " anheyu-app 裸机部署安装"
echo "=========================================="

# 1. root 检查
if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] 请使用 root 或 sudo 执行此脚本" >&2
    exit 1
fi

# 2. Node.js 版本检查
if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] 未检测到 Node.js，请先安装 Node.js v22+" >&2
    exit 1
fi
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "[ERROR] Node.js 版本需 >= 22，当前为 $(node -v)" >&2
    exit 1
fi
echo "[OK] Node.js $(node -v)"

# 3. 创建运行用户与安装目录
id -u node >/dev/null 2>&1 || useradd -r -s /bin/false node
mkdir -p "$INSTALL_DIR"
echo "[INFO] 安装目录: $INSTALL_DIR"

# 4. 拷贝项目（若脚本所在项目根目录与安装目录不同）
if [ "$PROJECT_ROOT" != "$INSTALL_DIR" ]; then
    echo "[INFO] 拷贝项目文件到 $INSTALL_DIR ..."
    rsync -a --exclude node_modules --exclude .git --exclude .next --exclude dist \
          "$PROJECT_ROOT"/ "$INSTALL_DIR"/
fi

cd "$INSTALL_DIR"

# 5. 构建前后端
echo "[INFO] 构建前后端产物..."
bash scripts/build-prod.sh

# 6. 推送数据库 schema
echo "[INFO] 推送 SQLite schema..."
cd server && npx drizzle-kit push --force && cd ..

# 7. 创建数据目录并修正属主
mkdir -p server/data/uploads server/data/backups
chown -R node:node "$INSTALL_DIR"

# 8. 安装 systemd 服务
echo "[INFO] 安装 systemd 服务..."
cp deploy/anheyu-backend.service /etc/systemd/system/
cp deploy/anheyu-frontend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable anheyu-backend anheyu-frontend
systemctl restart anheyu-backend anheyu-frontend

# 9. 配置 Nginx
if [ -d /etc/nginx/sites-available ]; then
    echo "[INFO] 配置 Nginx..."
    cp deploy/nginx-anheyu.conf /etc/nginx/sites-available/anheyu
    [ -L /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/anheyu /etc/nginx/sites-enabled/anheyu

    if [ -n "$DOMAIN" ]; then
        sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/anheyu
        echo "[INFO] 已将域名替换为 $DOMAIN"
    fi

    mkdir -p /var/www/html
    nginx -t && systemctl reload nginx || { echo "[ERROR] nginx 配置检查失败，请检查 /etc/nginx/sites-available/anheyu" >&2; exit 1; }
else
    echo "[WARN] 未检测到 /etc/nginx/sites-available，请手动配置 Nginx（参考 deploy/nginx-anheyu.conf）"
fi

echo ""
echo "=========================================="
echo " 部署完成"
echo "=========================================="
echo " 后端: http://localhost:8091/api"
echo " 前端: http://localhost:3000"
[ -n "$DOMAIN" ] && echo " 域名: https://$DOMAIN (需先 certbot --nginx -d $DOMAIN 签发证书)"
echo ""
echo " [重要] 首次部署后请立即："
echo "   1. 登录后台修改默认管理员密码 (admin@test.com / password123)"
echo "   2. 在后台设置中把 JWT_SECRET 设为强随机值 (见 DEPLOYMENT.md §8)"
echo "       生成: openssl rand -base64 32"
echo ""
echo " 服务管理:"
echo "   systemctl status anheyu-backend anheyu-frontend"
echo "   journalctl -u anheyu-backend -f"
