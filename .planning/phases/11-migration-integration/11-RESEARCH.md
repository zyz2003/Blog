# Phase 11: Migration & Integration - Research

**Researched:** 2026-07-16
**Status:** Complete

---

## 1. FK Dependency Graph (Topological Order for Migration)

### Layer 0 — No FK Dependencies (Independent Tables)
These tables can be migrated in any order:

| # | Go Table | NestJS Table | Notes |
|---|----------|-------------|-------|
| 1 | user_groups | user_groups | Root dependency for users |
| 2 | settings | settings | Contains id_seed, JWT_SECRET — critical |
| 3 | storage_policies | storage_policies | No FK refs |
| 4 | album_categories | album_categories | No FK refs |
| 5 | post_categories | post_categories | No FK refs |
| 6 | post_tags | post_tags | No FK refs |
| 7 | tags | tags | No FK refs |
| 8 | pages | pages | No FK refs |
| 9 | subscribers | subscribers | No FK refs |
| 10 | url_stats | url_stats | No FK refs |
| 11 | visitor_logs | visitor_logs | No FK refs |
| 12 | visitor_stats | visitor_stats | No FK refs |
| 13 | notification_types | notification_types | No FK refs |
| 14 | link_categories | link_categories | No FK refs |
| 15 | link_tags | link_tags | No FK refs |
| 16 | doc_series | doc_series | Only outgoing edge to articles |
| 17 | entities | entities | Only outgoing edge to file_entities |

### Layer 1 — Depends on Layer 0
| # | Go Table | NestJS Table | FK Dependencies |
|---|----------|-------------|-----------------|
| 18 | users | users | → user_groups |
| 19 | albums | albums | → album_categories (category_id) |
| 20 | links | links | → link_categories (category_id) |

### Layer 2 — Depends on Layer 1
| # | Go Table | NestJS Table | FK Dependencies |
|---|----------|-------------|-----------------|
| 21 | articles | articles | → doc_series (doc_series_id) |
| 22 | files | files | → users (owner_id), self (parent_id) |
| 23 | comments | comments | → users (user_id), self (parent_id) |
| 24 | user_installed_themes | user_installed_themes | → users (user_id) |
| 25 | user_notification_configs | user_notification_configs | → users (user_id), notification_types (notification_type_id) |

### Layer 3 — Depends on Layer 2
| # | Go Table | NestJS Table | FK Dependencies |
|---|----------|-------------|-----------------|
| 26 | article_histories | article_histories | → articles (article_id) |
| 27 | direct_links | direct_links | → files (file_id) |
| 28 | file_entities | file_entities | → files (file_id), entities (entity_id) |
| 29 | metadata | metadata | → files (file_id) |

### Layer 4 — Junction/Pivot Tables
| # | Go Table | NestJS Table | FK Dependencies |
|---|----------|-------------|-----------------|
| 30 | article_post_categories (auto) | article_post_category_pivot | → articles, post_categories |
| 31 | article_post_tags (auto) | article_post_tag_pivot | → articles, post_tags |
| 32 | link_tag_pivot (explicit) | link_tag_pivot | → links, link_tags |
| 33 | notifications | notifications | → users, notification_types |

### Self-References
- **comments**: parent_id → comments.id
- **files**: parent_id → files.id

### Recommended Migration Order
```
user_groups → settings → storage_policies → album_categories →
post_categories → post_tags → tags → pages → subscribers →
url_stats → visitor_logs → visitor_stats → notification_types →
link_categories → link_tags → doc_series → entities →

users → albums → links →

articles → files → comments → user_installed_themes → user_notification_configs →

article_histories → direct_links → file_entities → metadata →

article_post_category_pivot → article_post_tag_pivot → link_tag_pivot → notifications
```

---

## 2. Complete API Endpoint Inventory

### Auth (7 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/auth/login | RateLimit | authHandler.Login |
| POST | /api/auth/register | RateLimit | authHandler.Register |
| POST | /api/auth/refresh-token | — | authHandler.RefreshToken |
| POST | /api/auth/activate | — | authHandler.ActivateUser |
| POST | /api/auth/forgot-password | RateLimit | authHandler.ForgotPasswordRequest |
| POST | /api/auth/reset-password | RateLimit | authHandler.ResetPassword |
| GET | /api/auth/check-email | RateLimit | authHandler.CheckEmail |

### Settings (4 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/settings/get-by-keys | JWT | settingHandler.GetSettingsByKeys |
| POST | /api/settings/update | JWT+Admin | settingHandler.UpdateSettings |
| POST | /api/settings/test-email | JWT+Admin | settingHandler.TestEmail |
| GET | /api/public/site-config | — | settingHandler.GetSiteConfig |
| GET | /api/public/site-config/version | — | settingHandler.GetConfigVersion |

### User (12 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/user/info | JWT | userHandler.GetUserInfo |
| POST | /api/user/update-password | JWT | userHandler.UpdateUserPassword |
| PUT | /api/user/profile | JWT | userHandler.UpdateUserProfile |
| POST | /api/user/avatar | JWT | userHandler.UploadAvatar |
| GET | /api/admin/users | JWT+Admin | userHandler.AdminListUsers |
| POST | /api/admin/users | JWT+Admin | userHandler.AdminCreateUser |
| PUT | /api/admin/users/:id | JWT+Admin | userHandler.AdminUpdateUser |
| DELETE | /api/admin/users/:id | JWT+Admin | userHandler.AdminDeleteUser |
| POST | /api/admin/users/:id/reset-password | JWT+Admin | userHandler.AdminResetPassword |
| PUT | /api/admin/users/:id/status | JWT+Admin | userHandler.AdminUpdateUserStatus |
| GET | /api/admin/user-groups | JWT+Admin | userHandler.GetUserGroups |

### Article (14 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/articles | JWT | articleHandler.List |
| POST | /api/articles | JWT | articleHandler.Create |
| POST | /api/articles/upload | JWT | articleHandler.UploadImage |
| PUT | /api/articles/:id | JWT | articleHandler.Update |
| DELETE | /api/articles/:id | JWT | articleHandler.Delete |
| GET | /api/articles/:id | JWT | articleHandler.Get |
| POST | /api/articles/primary-color | JWT+Admin | articleHandler.GetPrimaryColor |
| POST | /api/articles/export | JWT+Admin | articleHandler.ExportArticles |
| POST | /api/articles/import | JWT+Admin | articleHandler.ImportArticles |
| DELETE | /api/articles/batch | JWT+Admin | articleHandler.BatchDelete |
| GET | /api/public/articles | — | articleHandler.ListPublic |
| GET | /api/public/articles/home | — | articleHandler.ListHome |
| GET | /api/public/articles/random | — | articleHandler.GetRandom |
| GET | /api/public/articles/archives | — | articleHandler.ListArchives |
| GET | /api/public/articles/statistics | — | articleHandler.GetArticleStatistics |
| GET | /api/public/articles/by-url | — | articleHandler.GetByURL |
| GET | /api/public/articles/:id | — | articleHandler.GetPublic |

### Article History (5 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/articles/:id/history | JWT | articleHistoryHandler.ListHistory |
| GET | /api/articles/:id/history/count | JWT | articleHistoryHandler.GetHistoryCount |
| GET | /api/articles/:id/history/compare | JWT | articleHistoryHandler.CompareVersions |
| GET | /api/articles/:id/history/:version | JWT | articleHistoryHandler.GetVersion |
| POST | /api/articles/:id/history/:version/restore | JWT | articleHistoryHandler.RestoreVersion |

### Post Category (4 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/post-categories | — | postCategoryHandler.List |
| POST | /api/post-categories | JWT+Admin | postCategoryHandler.Create |
| PUT | /api/post-categories/:id | JWT+Admin | postCategoryHandler.Update |
| DELETE | /api/post-categories/:id | JWT+Admin | postCategoryHandler.Delete |

### Post Tag (4 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/post-tags | JWTOptional | postTagHandler.List |
| POST | /api/post-tags | JWT+Admin | postTagHandler.Create |
| PUT | /api/post-tags/:id | JWT+Admin | postTagHandler.Update |
| DELETE | /api/post-tags/:id | JWT+Admin | postTagHandler.Delete |

### Page (7 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/public/pages/*path | — | pageHandler.GetByPath |
| POST | /api/pages | JWT+Admin | pageHandler.Create |
| GET | /api/pages | JWT+Admin | pageHandler.List |
| GET | /api/pages/:id | JWT+Admin | pageHandler.GetByID |
| PUT | /api/pages/:id | JWT+Admin | pageHandler.Update |
| DELETE | /api/pages/:id | JWT+Admin | pageHandler.Delete |
| POST | /api/pages/initialize | JWT+Admin | pageHandler.InitializeDefaultPages |

### Version (2 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/version | — | versionHandler.GetVersion |
| GET | /api/version/string | — | versionHandler.GetVersionString |

### File (14 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/file/content | — | fileHandler.ServeSignedContent |
| GET | /api/file | JWT | fileHandler.GetFilesByPath |
| GET | /api/file/:id | JWT | fileHandler.GetFileInfo |
| GET | /api/file/download/:id | JWT | fileHandler.DownloadFile |
| GET | /api/file/download-info/:id | JWT | fileHandler.GetDownloadInfo |
| POST | /api/file/create | JWT | fileHandler.CreateEmptyFile |
| PUT | /api/file/content/:publicID | JWT | fileHandler.UpdateFileContentByID |
| DELETE | /api/file | JWT | fileHandler.DeleteItems |
| PUT | /api/file/rename | JWT | fileHandler.RenameItem |
| GET | /api/file/preview-urls | JWT | fileHandler.GetPreviewURLs |
| PUT | /api/file/upload | JWT | fileHandler.CreateUploadSession |
| GET | /api/file/upload/session/:sessionId | JWT | fileHandler.GetUploadSessionStatus |
| POST | /api/file/upload/:sessionId/:index | JWT | fileHandler.UploadChunk |
| POST | /api/file/upload/finalize | JWT | fileHandler.FinalizeClientUpload |
| DELETE | /api/file/upload | JWT | fileHandler.DeleteUploadSession |

### Folder (5 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| PUT | /api/folder/view | JWT | fileHandler.UpdateFolderView |
| GET | /api/folder/tree/:id | JWT | fileHandler.GetFolderTree |
| GET | /api/folder/size/:id | JWT | fileHandler.GetFolderSize |
| POST | /api/folder/move | JWT | fileHandler.MoveItems |
| POST | /api/folder/copy | JWT | fileHandler.CopyItems |

### Storage Policy (7 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/policies | JWT+Admin | storagePolicyHandler.Create |
| GET | /api/policies | JWT+Admin | storagePolicyHandler.List |
| GET | /api/policies/connect/onedrive/:id | JWT+Admin | storagePolicyHandler.ConnectOneDrive |
| POST | /api/policies/authorize/onedrive | JWT+Admin | storagePolicyHandler.AuthorizeOneDrive |
| GET | /api/policies/:id | JWT+Admin | storagePolicyHandler.Get |
| PUT | /api/policies/:id | JWT+Admin | storagePolicyHandler.Update |
| DELETE | /api/policies/:id | JWT+Admin | storagePolicyHandler.Delete |

### Thumbnail (3 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/thumbnail/regenerate | JWT | thumbnailHandler.RegenerateThumbnail |
| POST | /api/thumbnail/regenerate/directory | JWT | thumbnailHandler.RegenerateThumbnailsForDirectory |
| GET | /api/thumbnail/:publicID | JWT | thumbnailHandler.GetThumbnailSign |
| GET | /api/t/:signedToken | — | thumbnailHandler.HandleThumbnailContent |

### Direct Link (2 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/direct-links | JWT | directLinkHandler.GetOrCreateDirectLinks |
| GET | /api/f/:publicID/*filename | — | directLinkHandler.HandleDirectDownload |

### Comment (10 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/public/comments | — | commentHandler.ListByPath |
| GET | /api/public/comments/latest | — | commentHandler.ListLatest |
| GET | /api/public/comments/:id/children | — | commentHandler.ListChildren |
| GET | /api/public/comments/qq-info | — | commentHandler.GetQQInfo |
| GET | /api/public/comments/ip-location | — | commentHandler.GetIPLocation |
| POST | /api/public/comments | JWTOptional | commentHandler.Create |
| POST | /api/public/comments/upload | JWTOptional | commentHandler.UploadCommentImage |
| POST | /api/public/comments/:id/like | — | commentHandler.LikeComment |
| POST | /api/public/comments/:id/unlike | — | commentHandler.UnlikeComment |
| GET | /api/comments | JWT+Admin | commentHandler.AdminList |
| DELETE | /api/comments | JWT+Admin | commentHandler.Delete |
| PUT | /api/comments/:id | JWT+Admin | commentHandler.UpdateContent |
| PUT | /api/comments/:id/info | JWT+Admin | commentHandler.UpdateCommentInfo |
| PUT | /api/comments/:id/status | JWT+Admin | commentHandler.UpdateStatus |
| PUT | /api/comments/:id/pin | JWT+Admin | commentHandler.SetPin |
| POST | /api/comments/export | JWT+Admin | commentHandler.ExportComments |
| POST | /api/comments/import | JWT+Admin | commentHandler.ImportComments |

### Search (1 endpoint)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/search | — | searchHandler.Search |

### Statistics (7 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/public/statistics/basic | — | statisticsHandler.GetBasicStatistics |
| POST | /api/public/statistics/visit | — | statisticsHandler.RecordVisit |
| GET | /api/statistics/analytics | JWT+Admin | statisticsHandler.GetVisitorAnalytics |
| GET | /api/statistics/top-pages | JWT+Admin | statisticsHandler.GetTopPages |
| GET | /api/statistics/trend | JWT+Admin | statisticsHandler.GetVisitorTrend |
| GET | /api/statistics/summary | JWT+Admin | statisticsHandler.GetStatisticsSummary |
| GET | /api/statistics/visitor-logs | JWT+Admin | statisticsHandler.GetVisitorLogs |

### Link (17 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/public/links | RateLimit | linkHandler.ApplyLink |
| GET | /api/public/links | — | linkHandler.ListPublicLinks |
| GET | /api/public/links/random | — | linkHandler.GetRandomLinks |
| GET | /api/public/links/applications | — | linkHandler.ListAllApplications |
| GET | /api/public/links/check-exists | — | linkHandler.CheckLinkExists |
| GET | /api/public/link-categories | — | linkHandler.ListPublicCategories |
| POST | /api/links | JWT+Admin | linkHandler.AdminCreateLink |
| GET | /api/links | JWT+Admin | linkHandler.ListLinks |
| DELETE | /api/links/batch-delete | JWT+Admin | linkHandler.AdminBatchDeleteLinks |
| PUT | /api/links/:id | JWT+Admin | linkHandler.AdminUpdateLink |
| DELETE | /api/links/:id | JWT+Admin | linkHandler.AdminDeleteLink |
| PUT | /api/links/:id/review | JWT+Admin | linkHandler.ReviewLink |
| POST | /api/links/import | JWT+Admin | linkHandler.ImportLinks |
| GET | /api/links/export | JWT+Admin | linkHandler.ExportLinks |
| POST | /api/links/health-check | JWT+Admin | linkHandler.CheckLinksHealth |
| GET | /api/links/health-check/status | JWT+Admin | linkHandler.GetHealthCheckStatus |
| PUT | /api/links/sort | JWT+Admin | linkHandler.BatchUpdateLinkSort |
| GET | /api/links/categories | JWT+Admin | linkHandler.ListCategories |
| POST | /api/links/categories | JWT+Admin | linkHandler.CreateCategory |
| PUT | /api/links/categories/:id | JWT+Admin | linkHandler.UpdateCategory |
| DELETE | /api/links/categories/:id | JWT+Admin | linkHandler.DeleteCategory |
| GET | /api/links/tags | JWT+Admin | linkHandler.ListAllTags |
| POST | /api/links/tags | JWT+Admin | linkHandler.CreateTag |
| PUT | /api/links/tags/:id | JWT+Admin | linkHandler.UpdateTag |
| DELETE | /api/links/tags/:id | JWT+Admin | linkHandler.DeleteTag |

### Album (8 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/albums/get | JWT+Admin | albumHandler.GetAlbums |
| POST | /api/albums/add | JWT+Admin | albumHandler.AddAlbum |
| POST | /api/albums/batch-import | JWT+Admin | albumHandler.BatchImportAlbums |
| PUT | /api/albums/update/:id | JWT+Admin | albumHandler.UpdateAlbum |
| DELETE | /api/albums/delete/:id | JWT+Admin | albumHandler.DeleteAlbum |
| DELETE | /api/albums/batch-delete | JWT+Admin | albumHandler.BatchDeleteAlbums |
| POST | /api/albums/export | JWT+Admin | albumHandler.ExportAlbums |
| POST | /api/albums/import | JWT+Admin | albumHandler.ImportAlbums |
| GET | /api/public/albums | — | publicHandler.GetPublicAlbums |
| GET | /api/public/album-categories | — | publicHandler.GetPublicAlbumCategories |
| PUT | /api/public/stat/:id | — | publicHandler.UpdateAlbumStat |

### Album Category (5 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/album-categories | JWT+Admin | albumCategoryHandler.CreateCategory |
| GET | /api/album-categories | JWT+Admin | albumCategoryHandler.ListCategories |
| GET | /api/album-categories/:id | JWT+Admin | albumCategoryHandler.GetCategory |
| PUT | /api/album-categories/:id | JWT+Admin | albumCategoryHandler.UpdateCategory |
| DELETE | /api/album-categories/:id | JWT+Admin | albumCategoryHandler.DeleteCategory |

### Doc Series (6 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/public/doc-series | — | docSeriesHandler.List |
| GET | /api/public/doc-series/:id | — | docSeriesHandler.Get |
| GET | /api/public/doc-series/:id/articles | — | docSeriesHandler.GetWithArticles |
| GET | /api/doc-series | JWT+Admin | docSeriesHandler.List |
| GET | /api/doc-series/:id | JWT+Admin | docSeriesHandler.Get |
| POST | /api/doc-series | JWT+Admin | docSeriesHandler.Create |
| PUT | /api/doc-series/:id | JWT+Admin | docSeriesHandler.Update |
| DELETE | /api/doc-series/:id | JWT+Admin | docSeriesHandler.Delete |

### Music (2 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/public/music/playlist | — | musicHandler.GetPlaylist |
| POST | /api/public/music/song-resources | — | musicHandler.GetSongResources |

### RSS (3 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /rss.xml | — | rssHandler.GetRSSFeed |
| GET | /feed.xml | — | rssHandler.GetRSSFeed |
| GET | /atom.xml | — | rssHandler.GetRSSFeed |

### Sitemap (2 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /sitemap.xml | — | sitemapHandler.GetSitemap |
| GET | /robots.txt | — | sitemapHandler.GetRobots |

### Notification (4 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/user/notification-settings | JWT | notificationHandler.GetUserNotificationSettings |
| PUT | /api/user/notification-settings | JWT | notificationHandler.UpdateUserNotificationSettings |
| GET | /api/user/notification-configs | JWT | notificationHandler.GetUserNotificationConfigs |
| GET | /api/notification/types | JWT+Admin | notificationHandler.ListNotificationTypes |

### Subscriber (4 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/public/subscribe | RateLimit | subscriberHandler.Subscribe |
| POST | /api/public/subscribe/code | RateLimit | subscriberHandler.SendVerificationCode |
| POST | /api/public/unsubscribe | — | subscriberHandler.Unsubscribe |
| GET | /api/public/unsubscribe/:token | — | subscriberHandler.UnsubscribeByToken |

### Backup (7 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | /api/config/backup/create | JWT+Admin | configBackupHandler.CreateBackup |
| GET | /api/config/backup/list | JWT+Admin | configBackupHandler.ListBackups |
| POST | /api/config/backup/restore | JWT+Admin | configBackupHandler.RestoreBackup |
| POST | /api/config/backup/delete | JWT+Admin | configBackupHandler.DeleteBackup |
| POST | /api/config/backup/clean | JWT+Admin | configBackupHandler.CleanOldBackups |
| GET | /api/config/export | JWT+Admin | configImportExportHandler.ExportConfig |
| POST | /api/config/import | JWT+Admin | configImportExportHandler.ImportConfig |

### Captcha (2 endpoints)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/public/captcha/config | — | captchaHandler.GetConfig |
| GET | /api/public/captcha/image | RateLimit | captchaHandler.GenerateImage |

### Weather (1 endpoint)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/public/weather/ip-location | — | commentHandler.GetIPLocation |

### Proxy (1 endpoint)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /api/proxy/download | RateLimit | proxyHandler.HandleDownload |

### File Download (1 endpoint)
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | /needcache/download/:public_id | — | fileHandler.HandleUniversalSignedDownload |

**Total: ~130+ endpoints** (many are admin-only variants of the same resource)

---

## 3. Schema Comparison Notes (Go vs NestJS)

### Column Naming Convention
Both Go (Ent) and NestJS (Drizzle) use **snake_case** for actual DB column names:
- Go: `field.Uint("owner_id")` → DB column: `owner_id`
- NestJS: `integer('owner_id')` → DB column: `owner_id`

**Column names are identical between Go and NestJS schemas.** The Drizzle schema uses camelCase for JS property names but snake_case for DB column names (second arg to `integer()`/`text()`).

### Timestamp Handling — CRITICAL DIFFERENCE
- **Go (Ent)**: Uses `field.Time("created_at")` which stores as **RFC3339/ISO8601 text** in SQLite (e.g., `2025-07-13T23:40:12+08:00`)
- **NestJS (Drizzle)**: Uses `integer('created_at', { mode: 'timestamp' })` which stores as **Unix epoch integer** (e.g., `1720885212`)

**Migration must convert Go's text timestamps to Unix epoch integers.** This is the most critical data transformation.

### Boolean Handling
- **Go (Ent)**: `field.Bool("is_primary_color_manual")` → stored as 0/1 integer in SQLite
- **NestJS (Drizzle)**: `integer('is_primary_color_manual', { mode: 'boolean' })` → also 0/1 integer
**No conversion needed** — both use 0/1 integers.

### JSON Fields
- **Go (Ent)**: `field.JSON("summaries", []string{})` → stored as JSON text
- **NestJS (Drizzle)**: `text('summaries', { mode: 'json' })` → also JSON text
**No conversion needed** — both store as JSON text.

### Enum Fields
- **Go (Ent)**: `field.Enum("status").Values("DRAFT", "PUBLISHED", ...)` → stored as text
- **NestJS (Drizzle)**: `text('status').default('DRAFT')` → also text
**No conversion needed** — both store as text strings.

### Soft Delete
- **Go (Ent)**: `SoftDeleteMixin` adds `deleted_at` as `Optional().Nillable()` Time field
- **NestJS (Drizzle)**: `integer('deleted_at', { mode: 'timestamp' })` nullable
**Same conversion needed as timestamps** — text → Unix epoch integer.

### Table Name Mapping
Go Ent table names match NestJS Drizzle table names exactly (both use plural snake_case):
- `users`, `user_groups`, `settings`, `articles`, `files`, `comments`, etc.

### Ent Auto-Generated Pivot Tables
Go Ent auto-generates junction tables with naming pattern: `{from}_{to}s`
- `article_post_categories` → NestJS: `article_post_category_pivot`
- `article_post_tags` → NestJS: `article_post_tag_pivot`
- `link_tag_pivot` (explicit) → NestJS: `link_tag_pivot` (same)

**Migration must handle the naming difference for article pivot tables.**

---

## 4. Test Infrastructure Patterns (from phase08-api-compat.spec.ts)

### Setup Pattern
```typescript
beforeAll(async () => {
  // 1. Initialize Sqids with test seed
  initSqidsEncoderWithSeed(TEST_SEED);

  // 2. Create NestJS test module
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // 3. Create app with global prefix and validation pipe
  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 4. Get DB instance
  db = app.get(DRIZZLE);

  // 5. Seed test data
  await db.insert(userGroups).values({...}).onConflictDoNothing().run();
  await db.insert(users).values({...}).onConflictDoNothing().run();
  await db.insert(settings).values({ configKey: 'JWT_SECRET', value: TEST_JWT_SECRET })...run();
  await db.insert(settings).values({ configKey: 'id_seed', value: TEST_SEED })...run();

  // 6. Initialize app
  await app.init();

  // 7. Generate admin token
  const userId = generatePublicID(1, EntityType.User);
  const groupId = generatePublicID(1, EntityType.UserGroup);
  adminToken = jwt.sign(
    { user_id: userId, user_group_id: groupId, permissions: [0,1,2,3], iss: 'anheyu-app' },
    TEST_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' },
  );
}, 60000);
```

### Response Format Assertions
```typescript
// Success response wrapper
expect(res.body).toHaveProperty('code');
expect(res.body).toHaveProperty('message');
expect(res.body).toHaveProperty('data');

// Paginated list format
expect(Object.keys(data).sort()).toEqual(['list', 'pageNum', 'pageSize', 'total'].sort());

// ID type checks
expect(Number.isInteger(album.id)).toBe(true);  // Integer ID
expect(typeof ds.id).toBe('string');             // Sqids string ID

// Date field naming
expect(album).toHaveProperty('created_at');      // snake_case
expect(album).toHaveProperty('updated_at');
```

### Error Response Assertions
```typescript
expect(res.status).toBe(400/401/409);
expect(res.body).toHaveProperty('code');
expect(res.body).toHaveProperty('message');
expect(res.body.data).toBeNull();
```

---

## 5. Migration Tool Design Considerations

### Key Data Transformations
1. **Timestamps**: Go stores as ISO8601 text → NestJS expects Unix epoch integer
   - `2025-07-13T23:40:12+08:00` → `1720885212`
   - Affects: created_at, updated_at, deleted_at, last_login_at, scheduled_at, reviewed_at, takedown_at, published_at
2. **Pivot table names**: Go auto-generates `article_post_categories`/`article_post_tags` → NestJS uses `article_post_category_pivot`/`article_post_tag_pivot`
3. **id_seed and JWT_SECRET**: Must be copied verbatim (text values, no transformation)

### Migration CLI Design
```
npx tsx scripts/migrate.ts --source ./data/anheyu_app.db --target ./data/anheyu.db [--skip-backup] [--skip-verify] [--verbose]
```

### Safety Measures
- Auto-backup target .db before writing
- FK constraint check after migration
- Row count comparison per table
- Spot-check critical values (id_seed, JWT_SECRET)
- Rollback on failure (restore backup)

### Implementation Approach
- Use better-sqlite3 directly (no Drizzle) for raw SQL reads/writes
- Read from source .db using `SELECT * FROM {table}`
- Transform rows (timestamp conversion, column mapping)
- Write to target .db using `INSERT INTO {table} VALUES (...)`
- Handle self-referencing tables (comments, files) by temporarily disabling FK checks

---

## 6. API Compat Test Coverage Matrix

### Test File Organization
Tests should be organized by module, each file independent and runnable:

| File | Endpoints | Auth Levels |
|------|-----------|-------------|
| auth-api-compat.spec.ts | 7 | Public + RateLimited |
| settings-api-compat.spec.ts | 5 | JWT + JWT+Admin + Public |
| user-api-compat.spec.ts | 11 | JWT + JWT+Admin |
| article-api-compat.spec.ts | 17 | JWT + JWT+Admin + Public |
| post-category-api-compat.spec.ts | 4 | Public + JWT+Admin |
| post-tag-api-compat.spec.ts | 4 | JWTOptional + JWT+Admin |
| page-api-compat.spec.ts | 7 | Public + JWT+Admin |
| version-api-compat.spec.ts | 2 | Public |
| file-api-compat.spec.ts | 19 | Public + JWT |
| storage-policy-api-compat.spec.ts | 7 | JWT+Admin |
| thumbnail-api-compat.spec.ts | 4 | JWT + Public |
| direct-link-api-compat.spec.ts | 2 | JWT + Public |
| comment-api-compat.spec.ts | 16 | Public + JWTOptional + JWT+Admin |
| search-api-compat.spec.ts | 1 | Public |
| statistics-api-compat.spec.ts | 7 | Public + JWT+Admin |
| link-api-compat.spec.ts | 25 | Public + RateLimit + JWT+Admin |
| album-api-compat.spec.ts | 11 | JWT+Admin + Public |
| album-category-api-compat.spec.ts | 5 | JWT+Admin |
| doc-series-api-compat.spec.ts | 8 | Public + JWT+Admin |
| music-api-compat.spec.ts | 2 | Public |
| rss-api-compat.spec.ts | 3 | Public |
| sitemap-api-compat.spec.ts | 2 | Public |
| notification-api-compat.spec.ts | 4 | JWT + JWT+Admin |
| subscriber-api-compat.spec.ts | 4 | Public + RateLimit |
| backup-api-compat.spec.ts | 7 | JWT+Admin |
| captcha-api-compat.spec.ts | 2 | Public + RateLimit |

### Test Data Seeding Strategy
Each test file needs:
1. **Shared base data** (seeded once in beforeAll):
   - user_groups (id=1, Admin)
   - users (id=1, admin user)
   - settings (JWT_SECRET, id_seed, APP_NAME, captcha.provider, GRAVATAR_URL)
2. **Module-specific data** (seeded per test file):
   - Articles: 1-2 test articles
   - Comments: 1-2 test comments
   - Files: test file records
   - etc.

### Shared Test Utilities
Create a shared test helper file (`server/test/helpers/api-compat-helpers.ts`) with:
- `createTestApp()` — NestJS app setup
- `seedBaseData(db)` — Base data seeding
- `generateAdminToken()` — JWT token generation
- `assertSuccessResponse(res)` — Common response wrapper assertion
- `assertPaginatedResponse(res)` — Paginated list assertion
- `assertErrorResponse(res, status, code?)` — Error response assertion

---

*Research completed: 2026-07-16*
