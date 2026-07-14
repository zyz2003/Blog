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
  REFRESH_TOKEN_MISSING: '未提供RefreshToken',
  USER_NOT_FOUND: '用户不存在',

  // Phase 03 - Category & Tag error messages
  CATEGORY_NOT_FOUND: '分类不存在',
  CATEGORY_NAME_EXISTS: '分类名称已存在',
  TAG_NOT_FOUND: '标签不存在',
  TAG_NAME_EXISTS: '标签名称已存在',

  // Phase 03 - Article error messages
  ARTICLE_NOT_FOUND: '文章不存在',
  ABBRLINK_CONFLICT: '永久链接已被其他文章使用',
  ABBRLINK_INVALID: '永久链接格式无效',
  ARTICLE_CREATE_FAILED: '文章创建失败',
  ARTICLE_UPDATE_FAILED: '文章更新失败',

  // Phase 03 - Article History error messages
  ARTICLE_HISTORY_NOT_FOUND: '历史版本不存在',

  // Phase 04 - Page error messages
  PAGE_NOT_FOUND: '页面不存在',
  PAGE_PATH_EXISTS: '路径已存在',
  PAGE_PATH_EMPTY: '路径不能为空',
  PAGE_PATH_NO_SLASH: '路径必须以 / 开头',
  PAGE_PATH_HAS_SPACE: '路径不能包含空格',
  PAGE_PATH_INVALID_CHAR: '路径不能包含特殊字符',

  // Phase 05 - Storage Policy error messages
  STORAGE_POLICY_FLAG_CONFLICT: '存储策略标志冲突',
  STORAGE_DEFAULT_POLICY_INIT_FAILED: '默认存储策略初始化失败',

  // Phase 05 - Upload error messages
  UPLOAD_SESSION_NOT_FOUND: '上传会话不存在或已过期',
  UPLOAD_SESSION_EXPIRED: '上传会话已过期',
  UPLOAD_SESSION_INVALID_CHUNK: '无效的文件块索引',
  UPLOAD_SESSION_NOT_OWNER: '无权操作此上传会话',
  UPLOAD_FILE_EXISTS: '文件已存在',
  UPLOAD_URI_INVALID: '无效的文件URI',
  UPLOAD_TEMP_DIR_CLEANUP_FAILED: '临时目录清理失败',

  // Phase 05 - File error messages
  FILE_NOT_FOUND: '文件不存在',
  FILE_NAME_EXISTS: '文件名已存在',
  FILE_PARENT_NOT_FOUND: '父目录不存在',
  FILE_DELETE_FAILED: '文件删除失败',
  FILE_COPY_FAILED: '文件复制失败',
  FILE_MOVE_FAILED: '文件移动失败',
  FOLDER_NOT_FOUND: '文件夹不存在',
  FOLDER_NOT_EMPTY: '文件夹不为空',
  SIGNED_URL_INVALID: '签名URL无效',
  SIGNED_URL_EXPIRED: '签名URL已过期',

  // Phase 05 - Thumbnail error messages
  THUMBNAIL_GENERATION_FAILED: '缩略图生成失败',
  THUMBNAIL_NOT_FOUND: '缩略图不存在',
  THUMBNAIL_SIGN_EXPIRED: '缩略图签名已过期',
  THUMBNAIL_SIGN_INVALID: '缩略图签名无效',

  // Phase 06 - Comment error messages
  COMMENT_RATE_LIMITED: '您的评论太频繁了，请稍后再试',
  COMMENT_PARENT_NOT_FOUND: '父评论不存在',
  COMMENT_REPLY_TARGET_NOT_FOUND: '回复目标评论不存在',
  COMMENT_ANONYMOUS_NO_REPLY: '匿名评论不允许被回复',
  COMMENT_ANONYMOUS_EMAIL_MISMATCH: '匿名评论邮箱验证失败',
  COMMENT_NOT_FOUND: '评论不存在',

  // Phase 07 - Statistics error messages
  STAT_INVALID_DATE: '日期格式错误',
  STAT_VISIT_RECORD_FAILED: '记录访问失败',

  // Phase 07 - Link error messages
  LINK_NOT_FOUND: '友链不存在',
  LINK_URL_EXISTS: '该网站已申请过友链',
  LINK_CATEGORY_NOT_FOUND: '友链分类不存在',
  LINK_CATEGORY_IN_USE: '友链分类正在使用中，无法删除',
  LINK_TAG_NOT_FOUND: '友链标签不存在',
  LINK_TAG_IN_USE: '友链标签正在使用中，无法删除',
  LINK_SITESHOT_REQUIRED: '卡片样式的友链必须提供网站快照',
  LINK_APPLY_RATE_LIMITED: '友链申请太频繁，请明天再试',
  LINK_IMPORT_LIMIT_EXCEEDED: '导入友链数量超过限制',
  LINK_HEALTH_CHECK_RUNNING: '健康检查正在进行中',

  // Phase 08 - Album error messages
  ALBUM_NOT_FOUND: '相册不存在',
  ALBUM_FILE_HASH_EXISTS: '这张图片已存在',
  ALBUM_CATEGORY_NOT_FOUND: '相册分类不存在',
  ALBUM_CATEGORY_NAME_EXISTS: '分类名称已存在',
  ALBUM_CATEGORY_IN_USE: '该分类下还有相册，无法删除',
  ALBUM_BATCH_IMPORT_FAILED: '批量导入失败',
  ALBUM_EXPORT_FAILED: '导出失败',
  ALBUM_IMPORT_FAILED: '导入失败',
  ALBUM_IMPORT_FILE_INVALID: '不支持的文件格式',
  ALBUM_STAT_TYPE_INVALID: '无效的统计类型',

  // Phase 08 - DocSeries error messages
  DOCSERIES_NOT_FOUND: '系列不存在',
  DOCSERIES_NAME_EXISTS: '系列名称已存在',
  DOCSERIES_HAS_DOCS: '无法删除，该系列下还有文档',

  // Phase 09 - RSS error messages
  RSS_GENERATE_GENERATE_FAILED: 'RSS生成失败',

  // Phase 09 - Music error messages
  MUSIC_INVALID_NETEASE_ID: '无效的网易云音乐ID',
  MUSIC_SONG_RESOURCE_FAILED: '获取歌曲资源失败',
  MUSIC_PLAYLIST_FETCH_FAILED: '获取播放列表失败',
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
