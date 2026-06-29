// anheyu-app/pkg/service/comment/import_export_service.go
package comment

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

// ExportCommentData 定义导出的评论数据结构
type ExportCommentData struct {
	Version  string                 `json:"version"`   // 导出格式版本
	ExportAt time.Time              `json:"export_at"` // 导出时间
	Comments []ExportCommentItem    `json:"comments"`  // 评论列表
	Meta     map[string]interface{} `json:"meta"`      // 元数据信息
}

// ExportCommentItem 单个评论的导出数据
type ExportCommentItem struct {
	// 基础信息
	ID        string    `json:"id"`         // 公共ID（用于导入时建立父子关系）
	CreatedAt time.Time `json:"created_at"` // 创建时间
	UpdatedAt time.Time `json:"updated_at"` // 更新时间
	PinnedAt  *string   `json:"pinned_at"`  // 置顶时间（ISO格式字符串）

	// 评论内容
	Content     string `json:"content"`      // Markdown原始内容
	ContentHTML string `json:"content_html"` // HTML内容

	// 目标信息
	TargetPath  string `json:"target_path"`            // 评论所属的目标路径
	TargetTitle string `json:"target_title,omitempty"` // 目标页面的标题

	// 评论者信息
	Nickname   string `json:"nickname"`              // 昵称
	Email      string `json:"email,omitempty"`       // 邮箱
	Website    string `json:"website,omitempty"`     // 个人网站
	IPAddress  string `json:"ip_address"`            // IP地址
	IPLocation string `json:"ip_location,omitempty"` // IP所在地区
	UserAgent  string `json:"user_agent"`            // User Agent

	// 父子关系
	ParentID  string `json:"parent_id,omitempty"`   // 父评论公共ID
	ReplyToID string `json:"reply_to_id,omitempty"` // 回复目标评论公共ID

	// 状态和标识
	Status         int  `json:"status"`           // 评论状态 1:已发布 2:待审核
	IsAdminComment bool `json:"is_admin_comment"` // 是否为管理员评论
	IsAnonymous    bool `json:"is_anonymous"`     // 是否为匿名评论
	LikeCount      int  `json:"like_count"`       // 点赞数
}

// ImportCommentRequest 导入评论的请求
type ImportCommentRequest struct {
	Data           ExportCommentData `json:"data"`             // 导入的数据
	SkipExisting   bool              `json:"skip_existing"`    // 是否跳过已存在的评论（根据内容+邮箱+路径判断）
	DefaultStatus  int               `json:"default_status"`   // 默认状态（1: 已发布, 2: 待审核）
	KeepCreateTime bool              `json:"keep_create_time"` // 是否保留原创建时间
}

// ImportCommentResult 导入结果
type ImportCommentResult struct {
	TotalCount   int      `json:"total_count"`   // 总数
	SuccessCount int      `json:"success_count"` // 成功数
	SkippedCount int      `json:"skipped_count"` // 跳过数
	FailedCount  int      `json:"failed_count"`  // 失败数
	Errors       []string `json:"errors"`        // 错误信息列表
}

// ExportComments 导出评论为 JSON 格式
func (s *Service) ExportComments(ctx context.Context, commentIDs []string) (*ExportCommentData, error) {
	log.Printf("[导出评论] 开始导出 %d 条评论", len(commentIDs))

	exportData := &ExportCommentData{
		Version:  "1.0",
		ExportAt: time.Now(),
		Comments: make([]ExportCommentItem, 0, len(commentIDs)),
		Meta: map[string]interface{}{
			"total_comments": len(commentIDs),
			"export_by":      "anheyu-app",
		},
	}

	// 批量获取评论（包括已删除的）
	dbIDs := make([]uint, 0, len(commentIDs))
	idMap := make(map[uint]string) // dbID -> publicID 映射

	for _, publicID := range commentIDs {
		dbID, entityType, err := idgen.DecodePublicID(publicID)
		if err != nil || entityType != idgen.EntityTypeComment {
			log.Printf("[导出评论] 跳过无效的评论ID: %s", publicID)
			continue
		}
		dbIDs = append(dbIDs, dbID)
		idMap[dbID] = publicID
	}

	comments, err := s.repo.FindManyByIDs(ctx, dbIDs)
	if err != nil {
		return nil, fmt.Errorf("获取评论失败: %w", err)
	}

	for _, comment := range comments {
		publicID := idMap[comment.ID]

		// 构建父评论公共ID
		var parentPublicID string
		if comment.ParentID != nil {
			parentPublicID, _ = idgen.GeneratePublicID(*comment.ParentID, idgen.EntityTypeComment)
		}

		// 构建回复目标评论公共ID
		var replyToPublicID string
		if comment.ReplyToID != nil {
			replyToPublicID, _ = idgen.GeneratePublicID(*comment.ReplyToID, idgen.EntityTypeComment)
		}

		// 构建置顶时间字符串
		var pinnedAtStr *string
		if comment.PinnedAt != nil {
			s := comment.PinnedAt.Format(time.RFC3339)
			pinnedAtStr = &s
		}

		// 获取邮箱和网站
		var email, website string
		if comment.Author.Email != nil {
			email = *comment.Author.Email
		}
		if comment.Author.Website != nil {
			website = *comment.Author.Website
		}

		// 获取目标标题
		var targetTitle string
		if comment.TargetTitle != nil {
			targetTitle = *comment.TargetTitle
		}

		exportItem := ExportCommentItem{
			ID:             publicID,
			CreatedAt:      comment.CreatedAt,
			UpdatedAt:      comment.UpdatedAt,
			PinnedAt:       pinnedAtStr,
			Content:        comment.Content,
			ContentHTML:    comment.ContentHTML,
			TargetPath:     comment.TargetPath,
			TargetTitle:    targetTitle,
			Nickname:       comment.Author.Nickname,
			Email:          email,
			Website:        website,
			IPAddress:      comment.Author.IP,
			IPLocation:     comment.Author.Location,
			UserAgent:      comment.Author.UserAgent,
			ParentID:       parentPublicID,
			ReplyToID:      replyToPublicID,
			Status:         int(comment.Status),
			IsAdminComment: comment.IsAdminAuthor,
			IsAnonymous:    comment.IsAnonymous,
			LikeCount:      comment.LikeCount,
		}

		exportData.Comments = append(exportData.Comments, exportItem)
	}

	log.Printf("[导出评论] 成功导出 %d 条评论", len(exportData.Comments))
	return exportData, nil
}

// ExportAllComments 导出所有评论（用于全量备份）
func (s *Service) ExportAllComments(ctx context.Context) (*ExportCommentData, error) {
	log.Printf("[导出评论] 开始导出所有评论")

	// 查询所有评论（不分页）
	params := repository.AdminListParams{
		Page:     1,
		PageSize: 100000, // 足够大的数值以获取所有评论
	}

	comments, total, err := s.repo.FindWithConditions(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("获取评论列表失败: %w", err)
	}

	log.Printf("[导出评论] 共找到 %d 条评论", total)

	exportData := &ExportCommentData{
		Version:  "1.0",
		ExportAt: time.Now(),
		Comments: make([]ExportCommentItem, 0, len(comments)),
		Meta: map[string]interface{}{
			"total_comments": total,
			"export_by":      "anheyu-app",
		},
	}

	for _, comment := range comments {
		publicID, _ := idgen.GeneratePublicID(comment.ID, idgen.EntityTypeComment)

		// 构建父评论公共ID
		var parentPublicID string
		if comment.ParentID != nil {
			parentPublicID, _ = idgen.GeneratePublicID(*comment.ParentID, idgen.EntityTypeComment)
		}

		// 构建回复目标评论公共ID
		var replyToPublicID string
		if comment.ReplyToID != nil {
			replyToPublicID, _ = idgen.GeneratePublicID(*comment.ReplyToID, idgen.EntityTypeComment)
		}

		// 构建置顶时间字符串
		var pinnedAtStr *string
		if comment.PinnedAt != nil {
			s := comment.PinnedAt.Format(time.RFC3339)
			pinnedAtStr = &s
		}

		// 获取邮箱和网站
		var email, website string
		if comment.Author.Email != nil {
			email = *comment.Author.Email
		}
		if comment.Author.Website != nil {
			website = *comment.Author.Website
		}

		// 获取目标标题
		var targetTitle string
		if comment.TargetTitle != nil {
			targetTitle = *comment.TargetTitle
		}

		exportItem := ExportCommentItem{
			ID:             publicID,
			CreatedAt:      comment.CreatedAt,
			UpdatedAt:      comment.UpdatedAt,
			PinnedAt:       pinnedAtStr,
			Content:        comment.Content,
			ContentHTML:    comment.ContentHTML,
			TargetPath:     comment.TargetPath,
			TargetTitle:    targetTitle,
			Nickname:       comment.Author.Nickname,
			Email:          email,
			Website:        website,
			IPAddress:      comment.Author.IP,
			IPLocation:     comment.Author.Location,
			UserAgent:      comment.Author.UserAgent,
			ParentID:       parentPublicID,
			ReplyToID:      replyToPublicID,
			Status:         int(comment.Status),
			IsAdminComment: comment.IsAdminAuthor,
			IsAnonymous:    comment.IsAnonymous,
			LikeCount:      comment.LikeCount,
		}

		exportData.Comments = append(exportData.Comments, exportItem)
	}

	log.Printf("[导出评论] 成功导出 %d 条评论", len(exportData.Comments))
	return exportData, nil
}

// ExportCommentsToZip 导出评论为 ZIP 压缩包
func (s *Service) ExportCommentsToZip(ctx context.Context, commentIDs []string) ([]byte, error) {
	var exportData *ExportCommentData
	var err error

	if len(commentIDs) == 0 {
		// 如果没有指定ID，则导出所有评论
		exportData, err = s.ExportAllComments(ctx)
	} else {
		exportData, err = s.ExportComments(ctx, commentIDs)
	}

	if err != nil {
		return nil, err
	}

	// 创建 ZIP buffer
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	// 添加 JSON 数据文件
	jsonData, err := json.MarshalIndent(exportData, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 JSON 失败: %w", err)
	}

	jsonFile, err := zipWriter.Create("comments.json")
	if err != nil {
		return nil, fmt.Errorf("创建 ZIP 文件失败: %w", err)
	}
	if _, err := jsonFile.Write(jsonData); err != nil {
		return nil, fmt.Errorf("写入 JSON 数据失败: %w", err)
	}

	// 添加 README 文件
	readme, err := zipWriter.Create("README.md")
	if err == nil {
		readmeContent := fmt.Sprintf(`# 评论导出包

- 导出时间: %s
- 导出版本: %s
- 评论总数: %d

## 文件说明

- comments.json: 包含所有评论的完整数据（JSON格式）

## 导入说明

使用本系统的导入功能，选择 comments.json 文件或此 ZIP 包即可导入所有评论。

## 数据格式说明

每条评论包含以下字段：
- id: 评论公共ID
- content: Markdown格式的评论内容
- content_html: HTML格式的评论内容
- target_path: 评论所属页面路径
- nickname: 评论者昵称
- email: 评论者邮箱
- status: 评论状态 (1: 已发布, 2: 待审核)
- parent_id: 父评论ID（如果是回复）
- created_at: 创建时间
`,
			exportData.ExportAt.Format("2006-01-02 15:04:05"),
			exportData.Version,
			len(exportData.Comments),
		)
		readme.Write([]byte(readmeContent))
	}

	// 关闭 ZIP writer
	if err := zipWriter.Close(); err != nil {
		return nil, fmt.Errorf("关闭 ZIP 文件失败: %w", err)
	}

	return buf.Bytes(), nil
}

// ImportComments 从导出的数据导入评论
func (s *Service) ImportComments(ctx context.Context, req *ImportCommentRequest) (*ImportCommentResult, error) {
	log.Printf("[导入评论] 开始导入 %d 条评论", len(req.Data.Comments))

	result := &ImportCommentResult{
		TotalCount: len(req.Data.Comments),
		Errors:     make([]string, 0),
	}

	// 旧ID -> 新ID 的映射（用于处理父子关系）
	idMapping := make(map[string]uint)

	// 先处理顶级评论（没有 parent_id 的）
	topLevelComments := make([]ExportCommentItem, 0)
	childComments := make([]ExportCommentItem, 0)

	for _, comment := range req.Data.Comments {
		if comment.ParentID == "" {
			topLevelComments = append(topLevelComments, comment)
		} else {
			childComments = append(childComments, comment)
		}
	}

	log.Printf("[导入评论] 顶级评论: %d, 子评论: %d", len(topLevelComments), len(childComments))

	// 导入顶级评论
	for _, commentData := range topLevelComments {
		newID, isSkipped, err := s.importSingleComment(ctx, commentData, idMapping, req)
		if err != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, err.Error())
			continue
		}
		// 无论是新导入还是跳过的已存在评论，都要加入映射以便子评论能找到父评论
		idMapping[commentData.ID] = newID
		if isSkipped {
			result.SkippedCount++
			log.Printf("[导入评论] 跳过已存在的评论: %s (使用已存在ID: %d)", commentData.Nickname, newID)
		} else {
			result.SuccessCount++
		}
	}

	// 导入子评论（可能需要多次迭代处理深层嵌套）
	maxIterations := 10
	for iteration := 0; iteration < maxIterations && len(childComments) > 0; iteration++ {
		remainingChildren := make([]ExportCommentItem, 0)

		for _, commentData := range childComments {
			// 检查父评论是否已经导入
			if _, ok := idMapping[commentData.ParentID]; !ok {
				remainingChildren = append(remainingChildren, commentData)
				continue
			}

			newID, isSkipped, err := s.importSingleComment(ctx, commentData, idMapping, req)
			if err != nil {
				result.FailedCount++
				result.Errors = append(result.Errors, err.Error())
				continue
			}
			// 无论是新导入还是跳过的已存在评论，都要加入映射以便更深层子评论能找到父评论
			idMapping[commentData.ID] = newID
			if isSkipped {
				result.SkippedCount++
				log.Printf("[导入评论] 跳过已存在的评论: %s (使用已存在ID: %d)", commentData.Nickname, newID)
			} else {
				result.SuccessCount++
			}
		}

		childComments = remainingChildren
	}

	// 如果还有未处理的子评论，记录错误
	for _, commentData := range childComments {
		result.FailedCount++
		result.Errors = append(result.Errors, fmt.Sprintf("无法导入评论 '%s': 找不到父评论 '%s'", commentData.ID, commentData.ParentID))
	}

	log.Printf("[导入评论] 导入完成 - 总数: %d, 成功: %d, 跳过: %d, 失败: %d",
		result.TotalCount, result.SuccessCount, result.SkippedCount, result.FailedCount)

	return result, nil
}

// importSingleComment 导入单条评论
// 返回值: (新评论ID, 是否为跳过的已存在评论, 错误)
func (s *Service) importSingleComment(ctx context.Context, commentData ExportCommentItem, idMapping map[string]uint, req *ImportCommentRequest) (uint, bool, error) {
	// 检查是否跳过已存在的评论
	if req.SkipExisting && commentData.Email != "" {
		// 简单检查：同路径、同邮箱、同内容的评论视为已存在
		email := commentData.Email
		content := commentData.Content
		targetPath := commentData.TargetPath
		params := repository.AdminListParams{
			Page:       1,
			PageSize:   1,
			Email:      &email,
			Content:    &content,
			TargetPath: &targetPath,
		}
		existing, _, err := s.repo.FindWithConditions(ctx, params)
		if err == nil && len(existing) > 0 {
			// 返回已存在评论的ID，以便建立父子关系映射
			return existing[0].ID, true, nil
		}
	}

	// 确定状态
	status := commentData.Status
	if status == 0 && req.DefaultStatus > 0 {
		status = req.DefaultStatus
	}
	if status == 0 {
		status = int(model.StatusPending) // 默认待审核
	}

	// 构建父评论ID
	var parentID *uint
	if commentData.ParentID != "" {
		if mappedID, ok := idMapping[commentData.ParentID]; ok {
			parentID = &mappedID
		}
	}

	// 构建回复目标ID
	var replyToID *uint
	if commentData.ReplyToID != "" {
		if mappedID, ok := idMapping[commentData.ReplyToID]; ok {
			replyToID = &mappedID
		}
	}

	// 准备邮箱和网站指针
	var emailPtr *string
	if commentData.Email != "" {
		emailPtr = &commentData.Email
	}

	var websitePtr *string
	if commentData.Website != "" {
		websitePtr = &commentData.Website
	}

	// 准备目标标题指针
	var targetTitlePtr *string
	if commentData.TargetTitle != "" {
		targetTitlePtr = &commentData.TargetTitle
	}

	// 准备 UserAgent 指针
	var userAgentPtr *string
	if commentData.UserAgent != "" {
		userAgentPtr = &commentData.UserAgent
	}

	// 计算邮箱 MD5
	var emailMD5 string
	if commentData.Email != "" {
		emailLower := strings.ToLower(commentData.Email)
		emailMD5 = fmt.Sprintf("%x", md5.Sum([]byte(emailLower)))
	}

	// 处理创建时间和更新时间
	var createdAtPtr, updatedAtPtr *time.Time
	if req.KeepCreateTime && !commentData.CreatedAt.IsZero() {
		createdAtPtr = &commentData.CreatedAt
	}
	if req.KeepCreateTime && !commentData.UpdatedAt.IsZero() {
		updatedAtPtr = &commentData.UpdatedAt
	}

	// 创建评论
	createParams := &repository.CreateCommentParams{
		TargetPath:     commentData.TargetPath,
		TargetTitle:    targetTitlePtr,
		ParentID:       parentID,
		ReplyToID:      replyToID,
		Nickname:       commentData.Nickname,
		Email:          emailPtr,
		EmailMD5:       emailMD5,
		Website:        websitePtr,
		Content:        commentData.Content,
		ContentHTML:    commentData.ContentHTML,
		Status:         status,
		IsAdminComment: commentData.IsAdminComment,
		IsAnonymous:    commentData.IsAnonymous,
		IPAddress:      commentData.IPAddress,
		IPLocation:     commentData.IPLocation,
		UserAgent:      userAgentPtr,
		CreatedAt:      createdAtPtr,
		UpdatedAt:      updatedAtPtr,
		LikeCount:      commentData.LikeCount,
	}

	newComment, err := s.repo.Create(ctx, createParams)
	if err != nil {
		return 0, false, fmt.Errorf("导入评论 '%s' 失败: %v", commentData.Nickname, err)
	}

	// 如果有置顶时间，设置置顶状态
	if commentData.PinnedAt != nil && *commentData.PinnedAt != "" {
		if pinnedAt, err := time.Parse(time.RFC3339, *commentData.PinnedAt); err == nil {
			_, _ = s.repo.SetPin(ctx, newComment.ID, &pinnedAt)
		}
	}

	log.Printf("[导入评论] 成功导入评论: %s (ID: %d)", commentData.Nickname, newComment.ID)
	return newComment.ID, false, nil
}

// ImportCommentsFromJSON 从 JSON 数据导入评论
func (s *Service) ImportCommentsFromJSON(ctx context.Context, jsonData []byte, req *ImportCommentRequest) (*ImportCommentResult, error) {
	var exportData ExportCommentData
	if err := json.Unmarshal(jsonData, &exportData); err != nil {
		return nil, fmt.Errorf("解析 JSON 数据失败: %w", err)
	}

	req.Data = exportData
	return s.ImportComments(ctx, req)
}

// ImportCommentsFromZip 从 ZIP 压缩包导入评论
func (s *Service) ImportCommentsFromZip(ctx context.Context, zipData []byte, req *ImportCommentRequest) (*ImportCommentResult, error) {
	// 读取 ZIP 内容
	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("读取 ZIP 文件失败: %w", err)
	}

	// 查找 comments.json 文件
	var jsonData []byte
	for _, file := range zipReader.File {
		if file.Name == "comments.json" {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("打开 comments.json 失败: %w", err)
			}
			defer rc.Close()

			jsonData, err = io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("读取 comments.json 失败: %w", err)
			}
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("ZIP 文件中未找到 comments.json")
	}

	return s.ImportCommentsFromJSON(ctx, jsonData, req)
}
