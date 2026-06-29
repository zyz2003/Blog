import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(8091),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  DB_PATH: Joi.string().default('data/anheyu.db'),
});
