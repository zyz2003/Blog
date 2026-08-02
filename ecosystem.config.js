/**
 * PM2 进程配置 - anheyu-app
 *
 * 使用前先构建：bash scripts/build-prod.sh
 * 启动：pm2 start ecosystem.config.js
 * 开机自启：pm2 save && pm2 startup
 *
 * 注意：JWT_SECRET 仅为通过 Joi 校验，运行时不读取；
 *       真实密钥需在后台面板设置（见 DEPLOYMENT.md §8）
 */
module.exports = {
  apps: [
    {
      name: 'anheyu-backend',
      cwd: './server',
      script: 'dist/main',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8091,
        DB_PATH: './data/blog.db',
        // 仅为通过 Joi 校验，运行时不读取
        JWT_SECRET: 'joi-placeholder',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '30d',
      },
      max_memory_restart: '512M',
      error_file: './server/logs/backend-error.log',
      out_file: './server/logs/backend-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'anheyu-frontend',
      cwd: './frontend',
      script: '.next/standalone/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 裸机/PM2 部署：前端代理到本地后端
        API_URL: 'http://localhost:8091',
      },
      max_memory_restart: '512M',
      error_file: './frontend/logs/frontend-error.log',
      out_file: './frontend/logs/frontend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
