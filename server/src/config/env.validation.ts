import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(8091),
  // JWT_SECRET 在 env 中仅为占位，运行时不读取（真实密钥存于数据库 settings 表，
  // 由 SettingsService.ensureJwtSecret 首次启动生成，或后台面板手动设置）
  JWT_SECRET: Joi.string().allow('').optional(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  DB_PATH: Joi.string().default('data/blog.db'),
});
