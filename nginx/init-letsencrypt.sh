#!/bin/bash
# 首次签发 Let's Encrypt 证书（Docker Compose 场景）
#
# 用法：
#   bash nginx/init-letsencrypt.sh your-domain.com you@example.com
#
# 流程：
#   1. 把 nginx.conf 中的 YOUR_DOMAIN 占位符替换为真实域名
#   2. 临时换成 HTTP-only 配置启动 nginx（此时无证书，443 块无法启动）
#   3. certbot 通过 webroot 校验签发证书
#   4. 恢复完整 HTTPS 配置并重启 nginx
set -e

DOMAIN="${1:?用法: bash nginx/init-letsencrypt.sh your-domain.com you@example.com}"
EMAIL="${2:?用法: bash nginx/init-letsencrypt.sh your-domain.com you@example.com}"
NGINX_CONF="nginx/nginx.conf"

# 必须在仓库根目录执行
if [ ! -f "docker-compose.yml" ] || [ ! -f "$NGINX_CONF" ]; then
    echo "[ERROR] 请在仓库根目录执行此脚本（需能访问 docker-compose.yml 与 $NGINX_CONF）" >&2
    exit 1
fi

# 1. 替换域名占位符
if grep -q "YOUR_DOMAIN" "$NGINX_CONF"; then
    sed -i.bak "s/YOUR_DOMAIN/$DOMAIN/g" "$NGINX_CONF"
    echo "[INFO] 已将 $NGINX_CONF 中的 YOUR_DOMAIN 替换为 $DOMAIN"
fi

# 2. 准备 webroot 与证书目录
mkdir -p nginx/conf nginx/certs

# 3. 备份完整配置，临时写入 HTTP-only 配置（避免无证书时 443 块启动失败）
cp "$NGINX_CONF" "$NGINX_CONF.full"
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ {
        root /etc/nginx/conf;
    }
    location / {
        return 200 'anheyu-app certbot bootstrap';
        add_header Content-Type text/plain;
    }
}
EOF

echo "[INFO] 启动 nginx（HTTP-only）以完成 ACME 校验..."
docker compose up -d nginx
sleep 3

# 4. 签发证书
echo "[INFO] 向 Let's Encrypt 申请 $DOMAIN 的证书..."
docker compose run --rm certbot certonly \
    --webroot -w /var/www/html \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email

# 5. 恢复完整 HTTPS 配置并重启 nginx
echo "[INFO] 恢复完整 HTTPS 配置..."
mv "$NGINX_CONF.full" "$NGINX_CONF"

echo "[INFO] 重启 nginx 启用 HTTPS..."
docker compose restart nginx

echo ""
echo "[SUCCESS] 证书签发完成，HTTPS 已启用"
echo "[INFO] 启动全部服务：docker compose up -d"
echo "[INFO] 续期：certbot 证书 90 天有效，可定期执行："
echo "       docker compose run --rm certbot renew && docker compose restart nginx"
