/**
 * Error codes constant file mapping all Go error constants to their Chinese messages.
 * Frontend depends on exact Chinese message text for error handling.
 *
 * Source: Go pkg/constant/errors.go + internal/app/middleware/auth.go
 */

export const ErrorCodes = {
  // From pkg/constant/errors.go
  NOT_FOUND: '资源未找到',
  FORBIDDEN: '操作禁止',
  CONFLICT: '资源冲突',
  INTERNAL_SERVER: '内部服务器错误',
  BAD_REQUEST: '错误的请求',
  UNAUTHORIZED: '未经授权的访问',
  INVALID_TOKEN: '无效令牌',
  STORAGE_NOT_FOUND: '未找到存储策略',
  STORAGE_CONFLICT: '存储策略冲突',
  LINK_EXPIRED: '链接已过期',
  SIGNATURE_INVALID: '签名无效',
  INVALID_OPERATION: '不允许的操作',
  INVALID_POLICY_TYPE: '无效的存储策略类型',
  POLICY_NOT_FOUND: '存储策略未找到',
  POLICY_CONFLICT: '存储策略冲突',
  POLICY_SETTINGS_INVALID: '存储策略设置无效',
  POLICY_NAME_CONFLICT: '存储策略名称冲突',
  INVALID_PUBLIC_ID: '无效的公共ID',
  POLICY_NOT_SUPPORT_AUTH: '存储策略不支持此授权方式',
  POLICY_USED_BY_FILES: '存储策略正在被文件使用，无法删除',
  ADMIN_EMAIL_USED_BY_GUEST: '此邮箱为管理员专属，请登录后发表评论',

  // From internal/app/middleware/auth.go - JWTAuth
  TOKEN_MISSING: '请求未携带Token，无权限访问',
  TOKEN_FORMAT_INVALID: 'Token格式不正确',
  TOKEN_INVALID_OR_EXPIRED: '无效或过期的Token',

  // From internal/app/middleware/auth.go - JWTAuthOptional
  TOKEN_EXPIRED: 'Token已过期',

  // From internal/app/middleware/auth.go - AdminAuth
  CLAIMS_NOT_FOUND: '权限信息获取失败',
  CLAIMS_FORMAT_INVALID: '权限信息格式不正确',
  USER_GROUP_ID_INVALID: '权限信息无效：用户组ID无法解析',
  ADMIN_PERMISSION_REQUIRED: '权限不足：此操作需要管理员权限',

  // Phase 02 - Auth & User error messages
  LOGIN_FAILED: '邮箱或密码错误',
  USER_NOT_ACTIVATED: '用户未激活',
  USER_BANNED: '用户已被封禁',
  OLD_PASSWORD_INCORRECT: '旧密码不正确',
  CAPTCHA_REQUIRED: '验证码参数缺失',
  CAPTCHA_EXPIRED: '验证码已过期',
  CAPTCHA_INCORRECT: '验证码错误',
  REFRESH_TOKEN_MISSING: '请求未携带Token，无权限访问',
  USER_NOT_FOUND: '用户不存在',
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
