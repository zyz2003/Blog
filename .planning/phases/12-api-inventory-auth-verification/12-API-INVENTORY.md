# Phase 12: API Inventory

**Date:** 2026-07-19
**Total Frontend API Endpoints:** 185 (backend endpoints) + 3 supplementary = 188 total
**Source:** `frontend/src/lib/api/` (23 files) + supplementary scan

## Summary Table

| Module | Endpoints | Frontend File | NestJS Implementation Status |
|--------|-----------|---------------|------------------------------|
| Auth | 9 | auth.ts | 4 IMPLEMENTED, 5 x 501 NOT_IMPLEMENTED (Go has implementation -- compatibility gap) |
| Settings | 5 | settings.ts, site-config.ts | 4 IMPLEMENTED, 1 x 501 NOT_IMPLEMENTED |
| Config/Backup | 7 | config.ts | 5 IMPLEMENTED, 2 MISSING |
| Article Public | 12 | article.ts | 12 IMPLEMENTED |
| Article Admin | 13 | post-management.ts | 13 IMPLEMENTED |
| Page | 7 | page-management.ts | 7 IMPLEMENTED |
| File Manager | 24 | file-manager.ts | 23 IMPLEMENTED, 1 MISSING (Go also lacks) |
| Comment Public | 8 | comment.ts | 8 IMPLEMENTED |
| Comment Admin | 8 | comment-management.ts | 8 IMPLEMENTED |
| Friends/Links | 25 | friends.ts | 25 IMPLEMENTED |
| Album | 15 | album.ts, album-public.ts | 15 IMPLEMENTED |
| Doc Series | 5 | doc-series.ts | 5 IMPLEMENTED |
| Music | 1 | music.ts | 1 IMPLEMENTED |
| Storage Policy | 7 | storage-policy.ts | 5 IMPLEMENTED, 2 x 501 NOT_IMPLEMENTED |
| User Management | 7 | user-management.ts | 7 IMPLEMENTED |
| User Center | 5 | user-center.ts | 5 IMPLEMENTED |
| Statistics/Admin | 6 | admin.ts | 6 IMPLEMENTED |
| Theme Mall | 20 | theme-mall.ts | 0 IMPLEMENTED, 20 MISSING |
| Changelog | 1 | changelog.ts | N/A (external API) |

---

## Auth Module (`frontend/src/lib/api/auth.ts`) -- 9 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 1 | POST | /api/auth/login | authApi.login | LoginRequest | LoginResponseData | auth_handler.Login | IMPLEMENTED |
| 2 | POST | /api/auth/register | authApi.register | RegisterRequest | RegisterResponseData | auth_handler.Register | 501 NOT_IMPLEMENTED (Go has implementation -- compatibility gap) |
| 3 | GET | /api/auth/check-email | authApi.checkEmail | email: string (query) | CheckEmailResponseData | auth_handler.CheckEmail | 501 NOT_IMPLEMENTED (Go has implementation -- compatibility gap) |
| 4 | POST | /api/auth/refresh-token | authApi.refreshToken | { refreshToken } + Authorization header | RefreshTokenResponseData | auth_handler.RefreshToken | IMPLEMENTED |
| 5 | POST | /api/auth/forgot-password | authApi.forgotPassword | ForgotPasswordRequest | null | auth_handler.ForgotPasswordRequest | 501 NOT_IMPLEMENTED (Go has implementation -- compatibility gap) |
| 6 | POST | /api/auth/reset-password | authApi.resetPassword | ResetPasswordRequest | null | auth_handler.ResetPassword | 501 NOT_IMPLEMENTED (Go has implementation -- compatibility gap) |
| 7 | POST | /api/auth/activate | authApi.activateUser | { id, sign } | LoginResponseData | auth_handler.ActivateUser | 501 NOT_IMPLEMENTED (Go has implementation -- compatibility gap) |
| 8 | GET | /api/public/captcha/config | authApi.getCaptchaConfig | -- | CaptchaConfig | captcha_handler.GetConfig | IMPLEMENTED |
| 9 | GET | /api/public/captcha/image | authApi.generateImageCaptcha | -- | ImageCaptchaResponse | captcha_handler.GenerateImage | IMPLEMENTED |

---

## Settings Module (`frontend/src/lib/api/settings.ts`, `site-config.ts`) -- 5 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 10 | POST | /api/settings/get-by-keys | settingsApi.getByKeys | { keys: string[] } | SettingsMap (Record<string, string>) | setting_handler.GetSettingsByKeys | IMPLEMENTED |
| 11 | POST | /api/settings/update | settingsApi.update | SettingsMap (Record<string, string>) | void | setting_handler.UpdateSettings | IMPLEMENTED |
| 12 | POST | /api/settings/test-email | settingsApi.testEmail | { to_email: string } | void | setting_handler.TestEmail | 501 NOT_IMPLEMENTED |
| 13 | GET | /api/public/site-config | siteConfigApi.getSiteConfig | -- | SiteConfigData | setting_handler.GetSiteConfig | IMPLEMENTED |
| 14 | GET | /api/public/site-config/version | siteConfigApi.getConfigVersion | -- | { version: number } | setting_handler.GetConfigVersion | IMPLEMENTED |

---

## Config/Backup Module (`frontend/src/lib/api/config.ts`) -- 7 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 15 | GET | /api/config/export | configApi.exportConfig | -- | Blob | configImportExportHandler.ExportConfig | MISSING (Go has implementation -- D-250) |
| 16 | POST | /api/config/import | configApi.importConfig | FormData (file) | { code, message } | configImportExportHandler.ImportConfig | MISSING (Go has implementation -- D-251) |
| 17 | GET | /api/config/backup/list | configApi.listBackups | -- | BackupInfo[] | configBackupHandler.ListBackups | IMPLEMENTED |
| 18 | POST | /api/config/backup/create | configApi.createBackup | { description, is_auto? } | BackupInfo | configBackupHandler.CreateBackup | IMPLEMENTED |
| 19 | POST | /api/config/backup/restore | configApi.restoreBackup | { filename } | void | configBackupHandler.RestoreBackup | IMPLEMENTED |
| 20 | POST | /api/config/backup/delete | configApi.deleteBackup | { filename } | void | configBackupHandler.DeleteBackup | IMPLEMENTED |
| 21 | POST | /api/config/backup/clean | configApi.cleanOldBackups | { keep_count } | void | configBackupHandler.CleanOldBackups | IMPLEMENTED |

---

## Article Public Module (`frontend/src/lib/api/article.ts`) -- 12 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 22 | GET | /api/public/articles | articleApi.getFeedList / getPublicArticles | GetFeedListParams / GetArticleListParams | FeedListResponse / ArticleListResponse | article_handler.ListPublic / ListHome | IMPLEMENTED |
| 23 | GET | /api/post-categories | articleApi.getCategoryList | -- | PostCategory[] | post_category_handler.List | IMPLEMENTED |
| 24 | GET | /api/post-tags | articleApi.getTagList | sort: string | PostTag[] | post_tag_handler.List | IMPLEMENTED |
| 25 | POST | /api/post-categories | articleApi.createCategory | { name, slug?, description?, is_series?, sort_order? } | PostCategory | post_category_handler.Create | IMPLEMENTED |
| 26 | POST | /api/post-tags | articleApi.createTag | { name, slug? } | PostTag | post_tag_handler.Create | IMPLEMENTED |
| 27 | PUT | /api/post-categories/:id | articleApi.updateCategory | { name?, slug?, ... } | PostCategory | post_category_handler.Update | IMPLEMENTED |
| 28 | PUT | /api/post-tags/:id | articleApi.updateTag | { name?, slug? } | PostTag | post_tag_handler.Update | IMPLEMENTED |
| 29 | DELETE | /api/post-categories/:id | articleApi.deleteCategory | -- | void | post_category_handler.Delete | IMPLEMENTED |
| 30 | DELETE | /api/post-tags/:id | articleApi.deleteTag | -- | void | post_tag_handler.Delete | IMPLEMENTED |
| 31 | GET | /api/public/articles/statistics | articleApi.getStatistics | -- | { total_posts, total_words } | article_handler.GetArticleStatistics | IMPLEMENTED |
| 32 | GET | /api/public/articles/random | articleApi.getRandomArticle | -- | { id, is_doc?, doc_series_id? } | article_handler.GetRandom | IMPLEMENTED |
| 33 | GET | /api/public/articles/archives | articleApi.getArchiveList | -- | { list: Archive[] } | article_handler.ListArchives | IMPLEMENTED |

---

## Article Admin Module (`frontend/src/lib/api/post-management.ts`) -- 13 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 34 | GET | /api/articles | postManagementApi.getArticles | AdminArticleListParams | AdminArticleListResponse | article_handler.List | IMPLEMENTED |
| 35 | GET | /api/articles/:id | postManagementApi.getArticle / getArticleForEdit | -- | AdminArticle / ArticleDetailForEdit | article_handler.Get | IMPLEMENTED |
| 36 | DELETE | /api/articles/:id | postManagementApi.deleteArticle | -- | void | article_handler.Delete | IMPLEMENTED |
| 37 | DELETE | /api/articles/batch | postManagementApi.batchDeleteArticles | { ids } | void | article_handler.BatchDelete | IMPLEMENTED |
| 38 | POST | /api/articles | postManagementApi.createArticle | CreateArticleRequest | AdminArticle | article_handler.Create | IMPLEMENTED |
| 39 | PUT | /api/articles/:id | postManagementApi.updateArticle | UpdateArticleRequest | AdminArticle | article_handler.Update | IMPLEMENTED |
| 40 | POST | /api/articles/upload | postManagementApi.uploadArticleImage | FormData (file) | { url, file_id } | article_handler.UploadImage | IMPLEMENTED |
| 41 | POST | /api/articles/export | postManagementApi.exportArticles | { article_ids } | Blob | article_handler.ExportArticles | IMPLEMENTED |
| 42 | POST | /api/articles/import | postManagementApi.importArticles | FormData (file + options) | ImportArticlesResult | article_handler.ImportArticles | IMPLEMENTED |
| 43 | GET | /api/articles/:id/history | postManagementApi.getArticleHistory | { page, pageSize } | ArticleHistoryListResponse | article_history_handler.ListHistory | IMPLEMENTED |
| 44 | GET | /api/articles/:id/history/:version | postManagementApi.getArticleHistoryVersion | -- | ArticleHistoryDetail | article_history_handler.GetVersion | IMPLEMENTED |
| 45 | POST | /api/articles/:id/history/:version/restore | postManagementApi.restoreArticleHistory | -- | ArticleHistoryDetail | article_history_handler.RestoreVersion | IMPLEMENTED |
| 46 | GET | /api/articles/:id/history/count | postManagementApi.getArticleHistoryCount | -- | { count } | article_history_handler.GetHistoryCount | IMPLEMENTED |

---

## Page Module (`frontend/src/lib/api/page-management.ts`) -- 7 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 47 | GET | /api/pages | pageManagementApi.getPages | PageListParams | PageListResponse | page_handler.List | IMPLEMENTED |
| 48 | GET | /api/pages/:id | pageManagementApi.getPageById | -- | CustomPage | page_handler.GetByID | IMPLEMENTED |
| 49 | POST | /api/pages | pageManagementApi.createPage | CreatePageRequest | CustomPage | page_handler.Create | IMPLEMENTED |
| 50 | PUT | /api/pages/:id | pageManagementApi.updatePage | UpdatePageRequest | CustomPage | page_handler.Update | IMPLEMENTED |
| 51 | DELETE | /api/pages/:id | pageManagementApi.deletePage | -- | void | page_handler.Delete | IMPLEMENTED |
| 52 | POST | /api/pages/initialize | pageManagementApi.initializeDefaultPages | -- | void | page_handler.InitializeDefaultPages | IMPLEMENTED |
| 53 | GET | /api/public/pages/:path | pageManagementApi.getPageByPath | path: string | CustomPage | page_handler.GetByPath | IMPLEMENTED |

---

## File Manager Module (`frontend/src/lib/api/file-manager.ts`) -- 24 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 54 | GET | /api/file | fetchFilesByPathApi | { uri, next_token? } | FileListData | file_handler.GetFilesByPath | IMPLEMENTED |
| 55 | PUT | /api/file/upload | createUploadSessionApi | { uri, size, policy_id, overwrite } | CreateUploadSessionResponse | file_handler.CreateUploadSession | IMPLEMENTED |
| 56 | POST | /api/file/upload/:sessionId/:index | uploadChunkApi | Blob (octet-stream) | unknown | file_handler.UploadChunk | IMPLEMENTED |
| 57 | DELETE | /api/file/upload | deleteUploadSessionApi | { id, uri } | unknown | file_handler.DeleteUploadSession | IMPLEMENTED |
| 58 | POST | /api/file/upload/finalize | finalizeClientUploadApi | { uri, policy_id, size } | { file_id, name, size } | file_handler.FinalizeClientUpload | IMPLEMENTED |
| 59 | POST | /api/file/create | createItemApi | { type, uri, err_on_conflict } | unknown | file_handler.CreateEmptyFile | IMPLEMENTED |
| 60 | PUT | /api/folder/view | updateFolderViewApi | { folder_id, view } | UpdateFolderViewResponse | file_handler.UpdateFolderView | IMPLEMENTED |
| 61 | GET | /api/file/upload/session/:sessionId | validateUploadSessionApi | -- | ValidateUploadSessionResponse | file_handler.GetUploadSessionStatus | IMPLEMENTED |
| 62 | DELETE | /api/file | deleteFilesApi | { ids } | unknown | file_handler.DeleteItems | IMPLEMENTED |
| 63 | PUT | /api/file/rename | renameFileApi | { id, new_name } | unknown | file_handler.RenameItem | IMPLEMENTED |
| 64 | GET | /api/file/:id | getFileDetailsApi | -- | FileInfoResponse | file_handler.GetFileInfo | IMPLEMENTED |
| 65 | GET | /api/file/download-info/:id | getDownloadInfoApi | -- | DownloadInfo | file_handler.GetDownloadInfo | IMPLEMENTED |
| 66 | GET | /api/file/download/:id | downloadFileApi | -- | Blob | file_handler.DownloadFile | IMPLEMENTED |
| 67 | GET | /api/folder/tree/:id | getFolderTreeApi | -- | FolderTreeResponse | file_handler.GetFolderTree | IMPLEMENTED |
| 68 | GET | /api/folder/size/:id | calculateFolderSize | -- | FolderSizeResponse | file_handler.GetFolderSize | IMPLEMENTED |
| 69 | POST | /api/folder/move | moveFilesApi | { sourceIDs, destinationID } | null | file_handler.MoveItems | IMPLEMENTED |
| 70 | POST | /api/folder/copy | copyFilesApi | { sourceIDs, destinationID } | null | file_handler.CopyItems | IMPLEMENTED |
| 71 | POST | /api/direct-links | createDirectLinksApi | { file_ids } | CreateDirectLinksResponse | direct_link_handler.GetOrCreateDirectLinks | IMPLEMENTED |
| 72 | GET | /api/file/preview-urls | getFilePreviewUrlsApi | { id } | FilePreviewUrlsResponse | file_handler.GetPreviewURLs | IMPLEMENTED |
| 73 | GET | /api/thumbnail/:publicId | getThumbnailCredentialApi | -- | GetThumbnailCredentialResponse | thumbnail_handler.GetThumbnailSign | IMPLEMENTED |
| 74 | POST | /api/thumbnail/regenerate | regenerateThumbnailApi | { id } | { status } | thumbnail_handler.RegenerateThumbnail | IMPLEMENTED |
| 75 | PUT | /api/file/content/:publicId | updateFileContentByPublicIdApi | { uri } + Blob body | UpdateFileContentData | file_handler.UpdateFileContentByID | IMPLEMENTED |
| 76 | POST | /api/thumbnail/regenerate/directory | regenerateDirectoryThumbnailsApi | { directoryId } | { filesToProcess } | thumbnail_handler.RegenerateThumbnailsForDirectory | IMPLEMENTED |
| 77 | POST | /api/files/share/create | createShareLinkApi | CreateShareLinkRequest | CreateShareLinkResponse | -- (not in Go router) | MISSING (Go also lacks this endpoint -- frontend-only definition) |

---

## Comment Public Module (`frontend/src/lib/api/comment.ts`) -- 8 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 78 | GET | /api/public/comments/latest | commentApi.getLatestComments | { page, pageSize } | CommentListResponse | comment_handler.ListLatest | IMPLEMENTED |
| 79 | GET | /api/public/comments | commentApi.getCommentsByPath | { target_path, page, pageSize } | CommentListResponse | comment_handler.ListByPath | IMPLEMENTED |
| 80 | GET | /api/public/comments/:id/children | commentApi.getCommentChildren | { page, pageSize } | CommentListResponse | comment_handler.ListChildren | IMPLEMENTED |
| 81 | POST | /api/public/comments | commentApi.createComment | CreateCommentPayload | Comment | comment_handler.Create | IMPLEMENTED |
| 82 | POST | /api/public/comments/:id/like | commentApi.likeComment | -- | number | comment_handler.LikeComment | IMPLEMENTED |
| 83 | POST | /api/public/comments/:id/unlike | commentApi.unlikeComment | -- | number | comment_handler.UnlikeComment | IMPLEMENTED |
| 84 | POST | /api/public/comments/upload | commentApi.uploadCommentImage | FormData (file) | UploadCommentResponse | comment_handler.UploadCommentImage | IMPLEMENTED |
| 85 | GET | /api/public/comments/qq-info | commentApi.getQQInfo | qq: string | QQInfoResponse | comment_handler.GetQQInfo | IMPLEMENTED |

---

## Comment Admin Module (`frontend/src/lib/api/comment-management.ts`) -- 8 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 86 | GET | /api/comments | commentManagementApi.getComments | AdminCommentListParams | AdminCommentListResponse | comment_handler.AdminList | IMPLEMENTED |
| 87 | DELETE | /api/comments | commentManagementApi.deleteComments | { ids } | void | comment_handler.Delete | IMPLEMENTED |
| 88 | PUT | /api/comments/:id/status | commentManagementApi.updateCommentStatus | { status } | void | comment_handler.UpdateStatus | IMPLEMENTED |
| 89 | PUT | /api/comments/:id | commentManagementApi.updateCommentContent | { content } | void | comment_handler.UpdateContent | IMPLEMENTED |
| 90 | PUT | /api/comments/:id/info | commentManagementApi.updateCommentInfo | UpdateCommentInfoRequest | void | comment_handler.UpdateCommentInfo | IMPLEMENTED |
| 91 | PUT | /api/comments/:id/pin | commentManagementApi.togglePin | { pinned } | void | comment_handler.SetPin | IMPLEMENTED |
| 92 | POST | /api/comments/export | commentManagementApi.exportComments | { ids } | Blob | comment_handler.ExportComments | IMPLEMENTED |
| 93 | POST | /api/comments/import | commentManagementApi.importComments | FormData | ImportCommentsResult | comment_handler.ImportComments | IMPLEMENTED |

---

## Friends/Links Module (`frontend/src/lib/api/friends.ts`) -- 25 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 94 | GET | /api/links | friendsApi.getLinks | AdminLinksParams | LinkListResponse | link_handler.ListLinks | IMPLEMENTED |
| 95 | POST | /api/links | friendsApi.createLink | CreateLinkRequest | LinkItem | link_handler.AdminCreateLink | IMPLEMENTED |
| 96 | PUT | /api/links/:id | friendsApi.updateLink | UpdateLinkRequest | LinkItem | link_handler.AdminUpdateLink | IMPLEMENTED |
| 97 | DELETE | /api/links/:id | friendsApi.deleteLink | -- | void | link_handler.AdminDeleteLink | IMPLEMENTED |
| 98 | DELETE | /api/links/batch-delete | friendsApi.batchDeleteLinks | { ids } | BatchDeleteLinksResponse | link_handler.AdminBatchDeleteLinks | IMPLEMENTED |
| 99 | PUT | /api/links/:id/review | friendsApi.reviewLink | ReviewLinkRequest | void | link_handler.ReviewLink | IMPLEMENTED |
| 100 | GET | /api/links/categories | friendsApi.getCategories | -- | LinkCategory[] | link_handler.ListCategories | IMPLEMENTED |
| 101 | POST | /api/links/categories | friendsApi.createCategory | CreateCategoryRequest | LinkCategory | link_handler.CreateCategory | IMPLEMENTED |
| 102 | PUT | /api/links/categories/:id | friendsApi.updateCategory | UpdateCategoryRequest | LinkCategory | link_handler.UpdateCategory | IMPLEMENTED |
| 103 | DELETE | /api/links/categories/:id | friendsApi.deleteCategory | -- | void | link_handler.DeleteCategory | IMPLEMENTED |
| 104 | GET | /api/links/tags | friendsApi.getTags | -- | LinkTag[] | link_handler.ListAllTags | IMPLEMENTED |
| 105 | POST | /api/links/tags | friendsApi.createTag | CreateTagRequest | LinkTag | link_handler.CreateTag | IMPLEMENTED |
| 106 | PUT | /api/links/tags/:id | friendsApi.updateTag | UpdateTagRequest | LinkTag | link_handler.UpdateTag | IMPLEMENTED |
| 107 | DELETE | /api/links/tags/:id | friendsApi.deleteTag | -- | void | link_handler.DeleteTag | IMPLEMENTED |
| 108 | POST | /api/links/import | friendsApi.importLinks | ImportLinksRequest | ImportLinksResponse | link_handler.ImportLinks | IMPLEMENTED |
| 109 | GET | /api/links/export | friendsApi.exportLinks | ExportLinksParams | ExportLinksResponse | link_handler.ExportLinks | IMPLEMENTED |
| 110 | POST | /api/links/health-check | friendsApi.triggerHealthCheck | -- | LinkHealthCheckResponse | link_handler.CheckLinksHealth | IMPLEMENTED |
| 111 | GET | /api/links/health-check/status | friendsApi.getHealthCheckStatus | -- | LinkHealthCheckResponse | link_handler.GetHealthCheckStatus | IMPLEMENTED |
| 112 | PUT | /api/links/sort | friendsApi.batchUpdateSort | BatchUpdateLinkSortRequest | void | link_handler.BatchUpdateLinkSort | IMPLEMENTED |
| 113 | GET | /api/public/links | friendsApi.getPublicLinks | PublicLinksParams | PublicLinkListResponse | link_handler.ListPublicLinks | IMPLEMENTED |
| 114 | POST | /api/public/links | friendsApi.applyLink | ApplyLinkRequest | void | link_handler.ApplyLink | IMPLEMENTED |
| 115 | GET | /api/public/links/check-exists | friendsApi.checkLinkExists | url: string | CheckLinkExistsResponse | link_handler.CheckLinkExists | IMPLEMENTED |
| 116 | GET | /api/public/links/random | friendsApi.getRandomLinks | num: number | LinkItem[] | link_handler.GetRandomLinks | IMPLEMENTED |
| 117 | GET | /api/public/link-categories | friendsApi.getPublicCategories | -- | LinkCategory[] | link_handler.ListPublicCategories | IMPLEMENTED |
| 118 | GET | /api/public/links/applications | friendsApi.getApplications | LinkApplicationsParams | LinkListResponse | link_handler.ListAllApplications | IMPLEMENTED |

---

## Album Module (`frontend/src/lib/api/album.ts`, `album-public.ts`) -- 15 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 119 | GET | /api/albums/get | albumApi.getList | AlbumListParams | AlbumListResponse | album_handler.GetAlbums | IMPLEMENTED |
| 120 | POST | /api/albums/add | albumApi.create | AlbumForm | void | album_handler.AddAlbum | IMPLEMENTED |
| 121 | PUT | /api/albums/update/:id | albumApi.update | AlbumForm | void | album_handler.UpdateAlbum | IMPLEMENTED |
| 122 | DELETE | /api/albums/delete/:id | albumApi.delete | -- | void | album_handler.DeleteAlbum | IMPLEMENTED |
| 123 | DELETE | /api/albums/batch-delete | albumApi.batchDelete | { ids } | { deleted } | album_handler.BatchDeleteAlbums | IMPLEMENTED |
| 124 | GET | /api/album-categories | albumApi.getCategories | -- | AlbumCategory[] | album_category_handler.ListCategories | IMPLEMENTED |
| 125 | POST | /api/album-categories | albumApi.createCategory | CreateAlbumCategoryRequest | AlbumCategory | album_category_handler.CreateCategory | IMPLEMENTED |
| 126 | PUT | /api/album-categories/:id | albumApi.updateCategory | UpdateAlbumCategoryRequest | AlbumCategory | album_category_handler.UpdateCategory | IMPLEMENTED |
| 127 | DELETE | /api/album-categories/:id | albumApi.deleteCategory | -- | void | album_category_handler.DeleteCategory | IMPLEMENTED |
| 128 | POST | /api/albums/batch-import | albumApi.batchImportAlbums | BatchImportAlbumsRequest | BatchImportAlbumsResult | album_handler.BatchImportAlbums | IMPLEMENTED |
| 129 | POST | /api/albums/import | albumApi.importAlbums | FormData | ImportAlbumsResult | album_handler.ImportAlbums | IMPLEMENTED |
| 130 | POST | /api/albums/export | albumApi.exportAlbums | ExportAlbumsRequest | Blob | album_handler.ExportAlbums | IMPLEMENTED |
| 131 | GET | /api/public/albums | albumPublicApi.getPublicAlbums | PublicAlbumListParams | PublicAlbumListData | public_handler.GetPublicAlbums | IMPLEMENTED |
| 132 | GET | /api/public/album-categories | albumPublicApi.getPublicAlbumCategories | -- | PublicAlbumCategory[] | public_handler.GetPublicAlbumCategories | IMPLEMENTED |
| 133 | PUT | /api/public/stat/:id | albumPublicApi.updatePublicAlbumStat | type: string | void | public_handler.UpdateAlbumStat | IMPLEMENTED |

---

## Doc Series Module (`frontend/src/lib/api/doc-series.ts`) -- 5 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 134 | GET | /api/doc-series | docSeriesApi.getList | DocSeriesListParams | DocSeriesListResponse | doc_series_handler.List | IMPLEMENTED |
| 135 | POST | /api/doc-series | docSeriesApi.create | DocSeriesForm | DocSeries | doc_series_handler.Create | IMPLEMENTED |
| 136 | PUT | /api/doc-series/:id | docSeriesApi.update | Partial\<DocSeriesForm\> | DocSeries | doc_series_handler.Update | IMPLEMENTED |
| 137 | DELETE | /api/doc-series/:id | docSeriesApi.delete | -- | void | doc_series_handler.Delete | IMPLEMENTED |
| 138 | GET | /api/public/doc-series/:id/articles | docSeriesApi.getPublicSeriesWithArticles | -- | DocSeriesWithArticles | doc_series_handler.GetWithArticles | IMPLEMENTED |

---

## Music Module (`frontend/src/lib/api/music.ts`) -- 1 endpoint

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 139 | GET | /api/public/music/playlist | getPlaylistApi | -- | PlaylistResponse | music_handler.GetPlaylist | IMPLEMENTED |

---

## Storage Policy Module (`frontend/src/lib/api/storage-policy.ts`) -- 7 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 140 | GET | /api/policies | storagePolicyApi.listAll | -- | StoragePolicyListResponse | storage_policy_handler.List | IMPLEMENTED |
| 141 | GET | /api/policies/:id | storagePolicyApi.getById | -- | StoragePolicy | storage_policy_handler.Get | IMPLEMENTED |
| 142 | POST | /api/policies | storagePolicyApi.create | StoragePolicyCreateRequest | void | storage_policy_handler.Create | IMPLEMENTED |
| 143 | PUT | /api/policies/:id | storagePolicyApi.update | StoragePolicyUpdateRequest | void | storage_policy_handler.Update | IMPLEMENTED |
| 144 | DELETE | /api/policies/:id | storagePolicyApi.delete | -- | void | storage_policy_handler.Delete | IMPLEMENTED |
| 145 | GET | /api/policies/connect/onedrive/:id | storagePolicyApi.getOneDriveAuthUrl | -- | OneDriveAuthUrlResponse | storage_policy_handler.ConnectOneDrive | 501 NOT_IMPLEMENTED |
| 146 | POST | /api/policies/authorize/onedrive | storagePolicyApi.completeOneDriveAuth | OneDriveAuthCompleteRequest | void | storage_policy_handler.AuthorizeOneDrive | 501 NOT_IMPLEMENTED |

---

## User Management Module (`frontend/src/lib/api/user-management.ts`) -- 7 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 147 | GET | /api/admin/users | userManagementApi.getUsers | AdminUserListParams | AdminUserListResponse | user_handler.AdminListUsers | IMPLEMENTED |
| 148 | POST | /api/admin/users | userManagementApi.createUser | AdminCreateUserRequest | AdminUser | user_handler.AdminCreateUser | IMPLEMENTED |
| 149 | PUT | /api/admin/users/:id | userManagementApi.updateUser | AdminUpdateUserRequest | void | user_handler.AdminUpdateUser | IMPLEMENTED |
| 150 | DELETE | /api/admin/users/:id | userManagementApi.deleteUser | -- | void | user_handler.AdminDeleteUser | IMPLEMENTED |
| 151 | POST | /api/admin/users/:id/reset-password | userManagementApi.resetPassword | AdminResetPasswordRequest | void | user_handler.AdminResetPassword | IMPLEMENTED |
| 152 | PUT | /api/admin/users/:id/status | userManagementApi.updateUserStatus | AdminUpdateUserStatusRequest | void | user_handler.AdminUpdateUserStatus | IMPLEMENTED |
| 153 | GET | /api/admin/user-groups | userManagementApi.getUserGroups | -- | UserGroupDTO[] | user_handler.GetUserGroups | IMPLEMENTED |

---

## User Center Module (`frontend/src/lib/api/user-center.ts`) -- 5 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 154 | PUT | /api/user/profile | userCenterApi.updateProfile | UpdateUserProfileRequest | null | user_handler.UpdateUserProfile | IMPLEMENTED |
| 155 | POST | /api/user/update-password | userCenterApi.updatePassword | UpdatePasswordRequest | null | user_handler.UpdateUserPassword | IMPLEMENTED |
| 156 | POST | /api/user/avatar | userCenterApi.uploadAvatar | FormData (file) | UploadAvatarResponseData | user_handler.UploadAvatar | IMPLEMENTED |
| 157 | GET | /api/user/notification-settings | userCenterApi.getNotificationSettings | -- | UserNotificationSettings | notification_handler.GetUserNotificationSettings | IMPLEMENTED |
| 158 | PUT | /api/user/notification-settings | userCenterApi.updateNotificationSettings | UserNotificationSettings | null | notification_handler.UpdateUserNotificationSettings | IMPLEMENTED |

---

## Statistics/Admin Module (`frontend/src/lib/api/admin.ts`) -- 6 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 159 | GET | /api/statistics/summary | statisticsApi.getSummary | -- | StatisticsSummary | statistics_handler.GetStatisticsSummary | IMPLEMENTED |
| 160 | GET | /api/public/statistics/basic | statisticsApi.getBasicStats | -- | VisitorStatistics | statistics_handler.GetBasicStatistics | IMPLEMENTED |
| 161 | POST | /api/public/statistics/visit | statisticsApi.recordVisit | { url_path, page_title?, referer?, duration? } | void | statistics_handler.RecordVisit | IMPLEMENTED |
| 162 | GET | /api/statistics/trend | statisticsApi.getTrend | { period, days } | VisitorTrendData | statistics_handler.GetVisitorTrend | IMPLEMENTED |
| 163 | GET | /api/statistics/analytics | statisticsApi.getAnalytics | { start_date?, end_date? } | VisitorAnalytics | statistics_handler.GetVisitorAnalytics | IMPLEMENTED |
| 164 | GET | /api/statistics/top-pages | statisticsApi.getTopPages | { limit } | URLStatistics[] | statistics_handler.GetTopPages | IMPLEMENTED |

---

## Theme Mall Module (`frontend/src/lib/api/theme-mall.ts`) -- 20 endpoints

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 165 | GET | /api/public/theme/static-mode | themeMallApi.checkStaticMode | -- | { is_active } | theme_handler.CheckStaticMode | MISSING (Go has implementation) |
| 166 | GET | /api/public/theme/market | themeMallApi.getMarketThemes | ThemeListParams | ThemeListData | theme_handler.GetThemeMarket | MISSING (Go has implementation) |
| 167 | GET | /api/theme/current | themeMallApi.getCurrentTheme | -- | Theme | theme_handler.GetCurrentTheme | MISSING (Go has implementation) |
| 168 | GET | /api/theme/installed | themeMallApi.getInstalledThemes | -- | Theme[] | theme_handler.GetInstalledThemes | MISSING (Go has implementation) |
| 169 | POST | /api/theme/install | themeMallApi.installTheme | { theme_name, download_url, theme_market_id? } | void | theme_handler.InstallTheme | MISSING (Go has implementation) |
| 170 | POST | /api/theme/switch | themeMallApi.switchTheme | { theme_name } | void | theme_handler.SwitchTheme | MISSING (Go has implementation) |
| 171 | POST | /api/theme/official | themeMallApi.switchToOfficial | -- | void | theme_handler.SwitchToOfficial | MISSING (Go has implementation) |
| 172 | POST | /api/theme/uninstall | themeMallApi.uninstallTheme | { theme_name } | void | theme_handler.UninstallTheme | MISSING (Go has implementation) |
| 173 | POST | /api/theme/upload | themeMallApi.uploadTheme | FormData (file) | ThemeUploadResponse | theme_handler.UploadTheme | MISSING (Go has implementation) |
| 174 | POST | /api/theme/validate | themeMallApi.validateTheme | FormData (file) | ThemeValidationResult | theme_handler.ValidateTheme | MISSING (Go has implementation) |
| 175 | GET | /api/theme/settings | themeMallApi.getThemeSettings | { theme_name } | ThemeSettingGroup[] | theme_handler.GetThemeSettings | MISSING (Go has implementation) |
| 176 | GET | /api/theme/config | themeMallApi.getUserThemeConfig | { theme_name } | Record\<string, unknown\> | theme_handler.GetUserThemeConfig | MISSING (Go has implementation) |
| 177 | POST | /api/theme/config | themeMallApi.saveUserThemeConfig | ThemeConfigSaveRequest | void | theme_handler.SaveUserThemeConfig | MISSING (Go has implementation) |
| 178 | GET | /api/theme/current-config | themeMallApi.getCurrentThemeConfig | -- | ThemeConfigResponse | theme_handler.GetCurrentThemeConfig | MISSING (Go has implementation) |
| 179 | POST | /api/admin/ssr-theme/install | themeMallApi.installSSRTheme | SSRThemeInstallRequest | void | ssrtheme_handler.InstallTheme | MISSING (Go has implementation) |
| 180 | GET | /api/admin/ssr-theme/list | themeMallApi.getInstalledSSRThemes | -- | SSRThemeInfo[] | ssrtheme_handler.ListInstalledThemes | MISSING (Go has implementation) |
| 181 | DELETE | /api/admin/ssr-theme/:name | themeMallApi.uninstallSSRTheme | -- | void | ssrtheme_handler.UninstallTheme | MISSING (Go has implementation) |
| 182 | POST | /api/admin/ssr-theme/:name/start | themeMallApi.startSSRTheme | SSRThemeStartRequest? | { port } | ssrtheme_handler.StartTheme | MISSING (Go has implementation) |
| 183 | POST | /api/admin/ssr-theme/:name/stop | themeMallApi.stopSSRTheme | -- | void | ssrtheme_handler.StopTheme | MISSING (Go has implementation) |
| 184 | GET | /api/admin/ssr-theme/:name/status | themeMallApi.getSSRThemeStatus | -- | SSRThemeInfo | ssrtheme_handler.GetThemeStatus | MISSING (Go has implementation) |

---

## Changelog Module (`frontend/src/lib/api/changelog.ts`) -- 1 external endpoint

| # | Method | Path | Frontend Method | Request Type | Response Type | Go Handler Path | NestJS Status |
|---|--------|------|----------------|--------------|---------------|-----------------|---------------|
| 185 | GET | (external) https://anheyuofficialwebsiteapi.anheyu.com/api/v1/changelog | getChangelogList | ChangelogQuery | ChangelogApiResponse | N/A -- external API | N/A (external API, not proxied through backend) |

---

## Supplementary Scan

Non-apiClient API calls found in the frontend codebase outside `frontend/src/lib/api/`.

| # | Source File | Call Type | Target | Already in Main Inventory | Notes |
|---|-------------|-----------|--------|--------------------------|-------|
| 186 | frontend/src/providers/visit-statistics-tracker.tsx | apiClient (via statisticsApi) | POST /api/public/statistics/visit | Y (#161) | Uses `statisticsApi.recordVisit()` which goes through apiClient; already covered in main inventory |
| 187 | frontend/src/hooks/use-music-api.ts:396 | fetch (direct) | POST {apiBaseURL}/Song_V1 | N | Direct fetch to external music API (metings.qjqq.cn); not a backend endpoint, external service |
| 188 | frontend/src/lib/proxy-backend.ts:13 | fetch (direct) | {backendUrl}{path} | N | Server-side proxy for RSS/sitemap/robots.txt; proxies to NestJS backend, not a separate API call |
| 189 | frontend/src/hooks/use-music-api.ts:165 | fetch (direct) | {lrcValue URL} | N | Fetches lyric content from arbitrary URL (e.g. song.lrc field); not a backend endpoint |
| 190 | frontend/src/hooks/use-music-api.ts:181 | fetch (direct) | {url} (custom JSON playlist) | N | Fetches custom playlist JSON from user-configured URL; not a backend endpoint |
| 191 | frontend/src/hooks/use-color-extraction.ts:34 | fetch (direct) | {imageUrl} | N | Fetches image blob for color extraction; not a backend endpoint, client-side only |
| 192 | frontend/src/hooks/use-audio-player.ts:430 | fetch (direct) | {song.lrc} | N | Fetches lyrics from song LRC URL; not a backend endpoint, same as #189 |
| 193 | frontend/src/hooks/use-travelling-link.ts:6 | window.open | https://www.travellings.cn/go.html | N | Opens external link in new tab; not an API call |

**Summary:** Items 186-188 were identified in RESEARCH.md. Items 189-193 are additional findings. None represent missing backend API endpoints -- all are either external services, client-side utilities, or already covered in the main inventory.

---

## Cross-Reference Gap Summary

### Methodology

Every frontend endpoint (#1-#185) was cross-referenced against NestJS controller source files in `server/src/`. Controller routes were extracted from `@Controller()`, `@Get()`, `@Post()`, `@Put()`, `@Delete()` decorators and combined with the global `/api` prefix.

### NestJS Controller Route Map (for reference)

| Controller File | @Controller Prefix | Key Routes |
|----------------|-------------------|------------|
| auth.controller.ts | auth | login, refresh-token, register, activate, forgot-password, reset-password, check-email |
| captcha.controller.ts | public/captcha | config, image |
| settings.controller.ts | settings | get-by-keys, update, test-email |
| settings.controller.ts | public/site-config | (root), version |
| backup.controller.ts | config/backup | create, list, restore, delete, clean |
| article.controller.ts | articles | (root), :id, upload, export, import, batch, primary-color |
| public-article.controller.ts | public/articles | (root), home, random, archives, statistics, by-url, :id |
| post-category.controller.ts | post-categories | (root), :id |
| post-tag.controller.ts | post-tags | (root), :id |
| article-history.controller.ts | articles/:articleId/history | (root), count, compare, :version, :version/restore |
| page.controller.ts | pages | (root), :id, initialize |
| public-page.controller.ts | public/pages | *path |
| file.controller.ts | file | (root), upload, upload/session/:sessionId, upload/:sessionId/:index, upload/finalize, download/:id, download-info/:id, preview-urls, content, :id, create, content/:publicID |
| folder.controller.ts | folder | view, tree/:id, size/:id, move, copy |
| comment.controller.ts | public/comments | latest, (root), qq-info, ip-location, :id/children, (root POST), upload, :id/like, :id/unlike |
| comment-admin.controller.ts | comments | (root), (root DELETE), :id, :id/info, :id/status, :id/pin, export, import |
| link.controller.ts | (root -- no prefix) | public/links, public/links/random, public/links/applications, public/links/check-exists, public/link-categories, links, links/batch-delete, links/:id, links/:id/review, links/import, links/export, links/health-check, links/health-check/status, links/sort, links/categories, links/tags |
| album.controller.ts | (root -- no prefix) | albums/get, albums/add, albums/batch-import, albums/update/:id, albums/delete/:id, albums/batch-delete, albums/export, albums/import |
| album-category.controller.ts | (root -- no prefix) | album-categories, album-categories/:id |
| public-album.controller.ts | (root -- no prefix) | public/albums, public/album-categories, public/stat/:id |
| doc-series.controller.ts | (root -- no prefix) | public/doc-series, public/doc-series/:id, public/doc-series/:id/articles, doc-series, doc-series/:id |
| music.controller.ts | public/music | playlist, song-resources |
| storage-policy.controller.ts | policies | (root), :id, connect/onedrive/:id, authorize/onedrive |
| user.controller.ts | (root -- no prefix) | user/info, user/update-password, user/profile, user/avatar, admin/users, admin/users/:id, admin/users/:id/reset-password, admin/users/:id/status, admin/user-groups |
| notification.controller.ts | (root -- no prefix) | notification/types, user/notification-settings, user/notification-configs, user/notifications, user/notifications/:id/read, user/notifications/read-all, user/notifications/unread-count |
| statistics.controller.ts | (root -- no prefix) | public/statistics/basic, public/statistics/visit, statistics/analytics, statistics/top-pages, statistics/trend, statistics/summary, statistics/visitor-logs |
| direct-link.controller.ts | direct-links | (root POST) |
| thumbnail.controller.ts | thumbnail | regenerate, regenerate/directory, :publicID |

### IMPLEMENTED -- 155 endpoints

Frontend endpoints with matching NestJS routes that return real data:

#1, #4, #8, #9, #10, #11, #13, #14, #17, #18, #19, #20, #21, #22, #23, #24, #25, #26, #27, #28, #29, #30, #31, #32, #33, #34, #35, #36, #37, #38, #39, #40, #41, #42, #43, #44, #45, #46, #47, #48, #49, #50, #51, #52, #53, #54, #55, #56, #57, #58, #59, #60, #61, #62, #63, #64, #65, #66, #67, #68, #69, #70, #71, #72, #73, #74, #75, #76, #78, #79, #80, #81, #82, #83, #84, #85, #86, #87, #88, #89, #90, #91, #92, #93, #94, #95, #96, #97, #98, #99, #100, #101, #102, #103, #104, #105, #106, #107, #108, #109, #110, #111, #112, #113, #114, #115, #116, #117, #118, #119, #120, #121, #122, #123, #124, #125, #126, #127, #128, #129, #130, #131, #132, #133, #134, #135, #136, #137, #138, #139, #140, #141, #142, #143, #144, #147, #148, #149, #150, #151, #152, #153, #154, #155, #156, #157, #158, #159, #160, #161, #162, #163, #164

### 501 NOT_IMPLEMENTED -- 8 endpoints

NestJS routes exist but throw 501 (not implemented):

| # | Endpoint | NestJS Controller | Go Has Implementation? | Notes |
|---|----------|-------------------|----------------------|-------|
| 2 | POST /api/auth/register | AuthController.register | YES | **Compatibility gap** -- Go has real handler, NestJS returns 501 |
| 3 | GET /api/auth/check-email | AuthController.checkEmail | YES | **Compatibility gap** -- Go has real handler, NestJS returns 501 |
| 5 | POST /api/auth/forgot-password | AuthController.forgotPassword | YES | **Compatibility gap** -- Go has real handler, NestJS returns 501 |
| 6 | POST /api/auth/reset-password | AuthController.resetPassword | YES | **Compatibility gap** -- Go has real handler, NestJS returns 501 |
| 7 | POST /api/auth/activate | AuthController.activate | YES | **Compatibility gap** -- Go has real handler, NestJS returns 501 |
| 12 | POST /api/settings/test-email | SettingsController.testEmail | YES | Go has handler, NestJS returns 501 |
| 145 | GET /api/policies/connect/onedrive/:id | StoragePolicyController.connectOnedrive | YES | Go has handler, NestJS returns 501 |
| 146 | POST /api/policies/authorize/onedrive | StoragePolicyController.authorizeOnedrive | YES | Go has handler, NestJS returns 501 |

**Note on auth 501 endpoints:** The plan originally noted (D-274) that Go also does not implement these. However, Go source code verification confirms Go DOES have real handlers for register (`auth_handler.Register`), activate (`auth_handler.ActivateUser`), forgot-password (`auth_handler.ForgotPasswordRequest`), reset-password (`auth_handler.ResetPassword`), and check-email (`auth_handler.CheckEmail`). These are **compatibility gaps**, not matching behavior.

### MISSING -- 22 endpoints

No NestJS route found for these frontend endpoints:

| # | Endpoint | Go Has Implementation? | Notes |
|---|----------|----------------------|-------|
| 15 | GET /api/config/export | YES | Deferred per D-250; NestJS SettingsService has exportAll() method but no controller route |
| 16 | POST /api/config/import | YES | Deferred per D-251; NestJS SettingsService has importAll() method but no controller route |
| 77 | POST /api/files/share/create | NO | Frontend-only definition; Go router also lacks this endpoint |
| 165 | GET /api/public/theme/static-mode | YES | No theme controller in NestJS |
| 166 | GET /api/public/theme/market | YES | No theme controller in NestJS |
| 167 | GET /api/theme/current | YES | No theme controller in NestJS |
| 168 | GET /api/theme/installed | YES | No theme controller in NestJS |
| 169 | POST /api/theme/install | YES | No theme controller in NestJS |
| 170 | POST /api/theme/switch | YES | No theme controller in NestJS |
| 171 | POST /api/theme/official | YES | No theme controller in NestJS |
| 172 | POST /api/theme/uninstall | YES | No theme controller in NestJS |
| 173 | POST /api/theme/upload | YES | No theme controller in NestJS |
| 174 | POST /api/theme/validate | YES | No theme controller in NestJS |
| 175 | GET /api/theme/settings | YES | No theme controller in NestJS |
| 176 | GET /api/theme/config | YES | No theme controller in NestJS |
| 177 | POST /api/theme/config | YES | No theme controller in NestJS |
| 178 | GET /api/theme/current-config | YES | No theme controller in NestJS |
| 179 | POST /api/admin/ssr-theme/install | YES | No theme controller in NestJS |
| 180 | GET /api/admin/ssr-theme/list | YES | No theme controller in NestJS |
| 181 | DELETE /api/admin/ssr-theme/:name | YES | No theme controller in NestJS |
| 182 | POST /api/admin/ssr-theme/:name/start | YES | No theme controller in NestJS |
| 183 | POST /api/admin/ssr-theme/:name/stop | YES | No theme controller in NestJS |
| 184 | GET /api/admin/ssr-theme/:name/status | YES | No theme controller in NestJS |

### Gap Summary Totals

| Category | Count | Percentage |
|----------|-------|-----------|
| IMPLEMENTED | 155 | 83.8% |
| 501 NOT_IMPLEMENTED | 8 | 4.3% |
| MISSING | 22 | 11.9% |
| **Total** | **185** | 100% |

### MISSING Breakdown by Severity

| Severity | Endpoints | Description |
|----------|-----------|-------------|
| HIGH -- Go has implementation, NestJS missing | 21 | config/export, config/import, and all 20 theme/ssr-theme endpoints -- these are compatibility gaps requiring new controllers |
| LOW -- Go also lacks endpoint | 1 | files/share/create (#77) -- frontend-only definition, no backend needed |

### Additional NestJS Routes NOT Called by Frontend

These NestJS routes exist but are not called by any frontend API method in `frontend/src/lib/api/`:

| NestJS Route | Controller | Notes |
|-------------|------------|-------|
| GET /api/public/articles/home | PublicArticleController | Alternative listing endpoint (frontend uses root /api/public/articles) |
| GET /api/public/articles/by-url | PublicArticleController | URL-based article lookup |
| GET /api/articles/:id/history/compare | ArticleHistoryController | History comparison not used by frontend |
| GET /api/public/comments/ip-location | CommentController | IP location lookup |
| GET /api/user/info | UserController | Current user info -- frontend reads from auth store instead |
| GET /api/user/notification-configs | NotificationController | Extended notification config not used by frontend |
| GET /api/user/notifications | NotificationController | Notification list not used by frontend |
| PUT /api/user/notifications/:id/read | NotificationController | Mark notification read not used by frontend |
| PUT /api/user/notifications/read-all | NotificationController | Mark all notifications read not used by frontend |
| GET /api/user/notifications/unread-count | NotificationController | Unread notification count not used by frontend |
| GET /api/notification/types | NotificationController | Notification type admin list not used by frontend |
| GET /api/statistics/visitor-logs | StatisticsController | Visitor log list not used by frontend |
| POST /api/articles/primary-color | ArticleController | Primary color extraction not used by frontend |
| POST /api/public/music/song-resources | MusicController | Song resource proxy not used by frontend apiClient |
| GET /api/album-categories/:id | AlbumCategoryController | Single album category not used by frontend |
| GET /api/public/doc-series | DocSeriesController | Public doc series list (not used by frontend) |
| GET /api/public/doc-series/:id | DocSeriesController | Single public doc series (not used by frontend) |
| GET /api/version | VersionController | Version info not used by frontend |
| GET /api/version/string | VersionController | Version string not used by frontend |
| POST /api/public/subscribe | SubscriberController | Email subscription |
| POST /api/public/subscribe/code | SubscriberController | Verification code |
| POST /api/public/unsubscribe | SubscriberController | Unsubscribe |
| GET /api/public/unsubscribe/:token | SubscriberController | Unsubscribe by token |
| GET /api/search | SearchController | Full-text search |
| GET /api/sitemap.xml | SitemapController | Sitemap |
| GET /api/robots.txt | SitemapController | Robots.txt |
| GET /api/rss.xml | RssController | RSS feed |
| GET /api/feed.xml | RssController | Feed |
| GET /api/atom.xml | RssController | Atom feed |
| GET /api/public/weather/ip-location | WeatherController | Weather/IP location |
| GET /api/f/:publicID/*path | DirectLinkController | Direct link file serving |
| GET /api/needcache/download/:public_id | DirectLinkController | Cached download |
| GET /api/t/:signedToken | ThumbnailController | Thumbnail by signed token |

These routes are either internal/proxy routes (RSS, sitemap, direct links, thumbnails) or features not yet wired in the frontend (notifications, search, subscribers, weather).
