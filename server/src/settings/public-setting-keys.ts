/**
 * Public setting keys matching Go's IsPublicSetting() from internal/configdef/definition.go.
 * Non-admin users only receive these keys; all others are private.
 * Per D-39: hardcoded list matches Go backend exactly.
 */

export const PUBLIC_SETTING_KEYS = new Set([
  // Site basics
  'APP_NAME',
  'SUB_TITLE',
  'SITE_URL',
  'APP_VERSION',
  'API_URL',

  // Logos & icons
  'LOGO_URL',
  'LOGO_DARK_URL',
  'ICON_URL',
  'GRAVATAR_URL',
  'DEFAULT_GRAVATAR_TYPE',

  // Appearance
  'APPEARANCE_SKIN',
  'APPEARANCE_TOKENS',
  'DEFAULT_THEME_MODE',

  // Announcements & custom
  'SITE_ANNOUNCEMENT',
  'CUSTOM_HEADER_HTML',
  'CUSTOM_FOOTER_HTML',
  'CUSTOM_CSS',
  'CUSTOM_JS',

  // Footer
  'footer.owner.name',
  'footer.owner.since',
  'footer.runtime.enable',
  'footer.theme.name',
  'footer.theme.link',

  // Header
  'header.logo.src',
  'header.logo.dark_src',
  'header.nav',

  // Sidebar
  'sidebar.enable',

  // About page
  'about.page.enable',
  'about.page.content',

  // Post settings (public-facing)
  'post.default_cover',
  'post.list.pageSize',

  // Comment (public)
  'comment.enable',

  // Album
  'album.enable',

  // Upload extensions
  'upload.allowed_extension',
  'upload.max_size',

  // External link warning
  'ENABLE_EXTERNAL_LINK_WARNING',

  // Right menu
  'right_menu.enable',

  // Captcha (public parts only)
  'captcha.provider',
  'turnstile.site_key',
  'geetest.captcha_id',
  'image_captcha.length',
]);
