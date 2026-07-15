/**
 * HTML email templates for EmailService.
 * Per D-206: verification code email and article push notification email.
 */

/**
 * Escape HTML entities to prevent XSS injection in email templates.
 */
function escapeHtml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate URL starts with http(s) to prevent javascript: URL injection.
 */
function sanitizeUrl(url: string): string {
  if (!url) return '#';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '#';
}

/**
 * Verification code email template.
 * Displays 6-digit code prominently with expiry notice.
 */
export function verificationEmailTemplate(params: {
  appName: string;
  code: string;
  expiryMinutes: number;
}): string {
  const { appName, code, expiryMinutes } = params;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(appName)} - 邮箱验证码</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background-color: #4a90d9; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 32px 24px; text-align: center; }
    .code-label { font-size: 14px; color: #666666; margin-bottom: 12px; }
    .code-box { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #4a90d9; background-color: #f0f6ff; padding: 16px; border-radius: 6px; margin: 16px 0; }
    .expiry-notice { font-size: 13px; color: #999999; margin-top: 20px; }
    .footer { border-top: 1px solid #eeeeee; padding: 16px 24px; text-align: center; font-size: 12px; color: #bbbbbb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(appName)}</h1>
    </div>
    <div class="content">
      <p class="code-label">您的验证码为：</p>
      <div class="code-box">${escapeHtml(code)}</div>
      <p class="expiry-notice">验证码将在 ${expiryMinutes} 分钟后过期，请尽快使用。</p>
    </div>
    <div class="footer">
      ${escapeHtml(appName)}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Article push notification email template.
 * Contains article title as link and unsubscribe link at bottom.
 */
export function articlePushEmailTemplate(params: {
  appName: string;
  articleTitle: string;
  articleUrl: string;
  unsubscribeUrl: string;
}): string {
  const { appName, articleTitle, articleUrl, unsubscribeUrl } = params;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(appName)} - 新文章发布</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background-color: #4a90d9; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 32px 24px; text-align: center; }
    .notice { font-size: 14px; color: #666666; margin-bottom: 16px; }
    .article-title { font-size: 18px; font-weight: 600; margin: 16px 0; }
    .article-title a { color: #4a90d9; text-decoration: none; }
    .article-title a:hover { text-decoration: underline; }
    .read-btn { display: inline-block; background-color: #4a90d9; color: #ffffff; padding: 12px 32px; border-radius: 4px; text-decoration: none; font-size: 14px; margin-top: 8px; }
    .footer { border-top: 1px solid #eeeeee; padding: 16px 24px; text-align: center; font-size: 12px; color: #bbbbbb; }
    .unsubscribe { font-size: 12px; color: #999999; margin-top: 8px; }
    .unsubscribe a { color: #999999; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(appName)}</h1>
    </div>
    <div class="content">
      <p class="notice">新文章发布啦！</p>
      <p class="article-title"><a href="${sanitizeUrl(articleUrl)}">${escapeHtml(articleTitle)}</a></p>
      <a href="${sanitizeUrl(articleUrl)}" class="read-btn">阅读全文</a>
    </div>
    <div class="footer">
      ${escapeHtml(appName)}
      <p class="unsubscribe"><a href="${sanitizeUrl(unsubscribeUrl)}">取消订阅</a></p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Comment reply notification email template.
 * Matches Go SendCommentNotification reply scenario.
 * Contains: parent commenter nickname, reply author nickname, reply content, article link.
 */
export function commentReplyEmailTemplate(params: {
  appName: string;
  siteUrl: string;
  pageUrl: string;
  targetTitle: string;
  parentNick: string;
  replyNick: string;
  replyContent: string;
}): string {
  const { appName, siteUrl, pageUrl, targetTitle, parentNick, replyNick, replyContent } = params;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(appName)} - 评论回复通知</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background-color: #4a90d9; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 14px; color: #333333; margin-bottom: 16px; }
    .reply-info { font-size: 14px; color: #666666; margin-bottom: 12px; }
    .reply-content { background-color: #f0f6ff; padding: 16px; border-radius: 6px; margin: 16px 0; font-size: 14px; color: #333333; line-height: 1.6; }
    .view-btn { display: inline-block; background-color: #4a90d9; color: #ffffff; padding: 12px 32px; border-radius: 4px; text-decoration: none; font-size: 14px; margin-top: 8px; }
    .footer { border-top: 1px solid #eeeeee; padding: 16px 24px; text-align: center; font-size: 12px; color: #bbbbbb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(appName)}</h1>
    </div>
    <div class="content">
      <p class="greeting">您好，${escapeHtml(parentNick)}！</p>
      <p class="reply-info"><strong>${escapeHtml(replyNick)}</strong> 回复了您在 <a href="${sanitizeUrl(pageUrl)}" style="color: #4a90d9; text-decoration: none;">${escapeHtml(targetTitle)}</a> 中的评论：</p>
      <div class="reply-content">${escapeHtml(replyContent)}</div>
      <a href="${sanitizeUrl(pageUrl)}" class="view-btn">查看详情</a>
    </div>
    <div class="footer">
      ${escapeHtml(appName)} &mdash; <a href="${sanitizeUrl(siteUrl)}" style="color: #bbbbbb; text-decoration: none;">${sanitizeUrl(siteUrl)}</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * New comment notification email template for admin.
 * Matches Go SendCommentNotification admin scenario.
 * Contains: commenter nickname, comment content, page link.
 */
export function commentAdminEmailTemplate(params: {
  appName: string;
  siteUrl: string;
  pageUrl: string;
  targetTitle: string;
  commenterNick: string;
  commentContent: string;
}): string {
  const { appName, siteUrl, pageUrl, targetTitle, commenterNick, commentContent } = params;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(appName)} - 新评论通知</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background-color: #4a90d9; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 32px 24px; }
    .notice { font-size: 14px; color: #666666; margin-bottom: 12px; }
    .comment-content { background-color: #f0f6ff; padding: 16px; border-radius: 6px; margin: 16px 0; font-size: 14px; color: #333333; line-height: 1.6; }
    .view-btn { display: inline-block; background-color: #4a90d9; color: #ffffff; padding: 12px 32px; border-radius: 4px; text-decoration: none; font-size: 14px; margin-top: 8px; }
    .footer { border-top: 1px solid #eeeeee; padding: 16px 24px; text-align: center; font-size: 12px; color: #bbbbbb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(appName)}</h1>
    </div>
    <div class="content">
      <p class="notice"><strong>${escapeHtml(commenterNick)}</strong> 在 <a href="${sanitizeUrl(pageUrl)}" style="color: #4a90d9; text-decoration: none;">${escapeHtml(targetTitle)}</a> 发表了新评论：</p>
      <div class="comment-content">${escapeHtml(commentContent)}</div>
      <a href="${sanitizeUrl(pageUrl)}" class="view-btn">查看详情</a>
    </div>
    <div class="footer">
      ${escapeHtml(appName)} &mdash; <a href="${sanitizeUrl(siteUrl)}" style="color: #bbbbbb; text-decoration: none;">${sanitizeUrl(siteUrl)}</a>
    </div>
  </div>
</body>
</html>`;
}
