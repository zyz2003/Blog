/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-20 13:27:06
 * @LastEditTime: 2025-07-12 15:21:28
 * @LastEditors: 安知鱼
 */
package user

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/security"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// UserService 定义了用户相关的业务逻辑接口
type UserService interface {
	GetUserInfoByUsername(ctx context.Context, username string) (*model.User, error)
	GetUserInfoByID(ctx context.Context, userID uint) (*model.User, error)
	UpdateUserPassword(ctx context.Context, username, oldPassword, newPassword string) error
	UpdateUserPasswordByID(ctx context.Context, userID uint, oldPassword, newPassword string) error
	UpdateUserProfile(ctx context.Context, username string, nickname, website *string) error
	UpdateUserProfileByID(ctx context.Context, userID uint, nickname, website *string) error
	UpdateUserAvatar(ctx context.Context, userID uint, avatarURL string) error

	// 管理员用户管理方法
	AdminListUsers(ctx context.Context, page, pageSize int, keyword string, groupID *uint, status *int) ([]*model.User, int64, error)
	AdminCreateUser(ctx context.Context, username, password, email, nickname string, userGroupID uint) (*model.User, error)
	AdminUpdateUser(ctx context.Context, userID uint, username, email, nickname *string, userGroupID *uint, status *int) error
	AdminDeleteUser(ctx context.Context, userID uint) error
	AdminResetPassword(ctx context.Context, userID uint, newPassword string) error
	AdminUpdateUserStatus(ctx context.Context, userID uint, status int) error

	// 用户组管理方法
	ListUserGroups(ctx context.Context) ([]*model.UserGroup, error)
}

// userService 是 UserService 接口的实现
type userService struct {
	userRepo      repository.UserRepository
	userGroupRepo repository.UserGroupRepository
}

// NewUserService 是 userService 的构造函数
func NewUserService(userRepo repository.UserRepository, userGroupRepo repository.UserGroupRepository) UserService {
	return &userService{
		userRepo:      userRepo,
		userGroupRepo: userGroupRepo,
	}
}

// GetUserInfoByUsername 实现了获取用户信息的业务逻辑
func (s *userService) GetUserInfoByUsername(ctx context.Context, username string) (*model.User, error) {
	user, err := s.userRepo.FindByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("获取用户信息时数据库出错: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("用户 '%s' 不存在", username)
	}
	return user, nil
}

// GetUserInfoByID 实现了根据用户ID获取用户信息的业务逻辑
func (s *userService) GetUserInfoByID(ctx context.Context, userID uint) (*model.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("获取用户信息时数据库出错: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("用户不存在")
	}
	return user, nil
}

// UpdateUserPassword 实现了修改用户密码的业务逻辑
func (s *userService) UpdateUserPassword(ctx context.Context, username, oldPassword, newPassword string) error {
	// 1. 获取用户信息
	user, err := s.userRepo.FindByUsername(ctx, username)
	if err != nil {
		return fmt.Errorf("获取用户信息失败: %w", err)
	}
	if user == nil {
		return fmt.Errorf("当前登录用户不存在")
	}

	// 2. 校验旧密码
	if !security.CheckPasswordHash(oldPassword, user.PasswordHash) {
		return fmt.Errorf("旧密码不正确")
	}

	// 3. 哈希新密码
	newHashedPassword, err := security.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("生成新密码失败: %w", err)
	}

	// 4. 更新领域模型并保存
	user.PasswordHash = newHashedPassword
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("更新密码失败: %w", err)
	}

	return nil
}

// UpdateUserPasswordByID 实现了根据用户ID修改密码的业务逻辑
func (s *userService) UpdateUserPasswordByID(ctx context.Context, userID uint, oldPassword, newPassword string) error {
	// 1. 获取用户信息
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("获取用户信息失败: %w", err)
	}
	if user == nil {
		return fmt.Errorf("当前登录用户不存在")
	}

	// 2. 校验旧密码
	if !security.CheckPasswordHash(oldPassword, user.PasswordHash) {
		return fmt.Errorf("旧密码不正确")
	}

	// 3. 哈希新密码
	newHashedPassword, err := security.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("生成新密码失败: %w", err)
	}

	// 4. 更新领域模型并保存
	user.PasswordHash = newHashedPassword
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("更新密码失败: %w", err)
	}

	return nil
}

// UpdateUserProfile 实现了更新用户基本信息的业务逻辑
func (s *userService) UpdateUserProfile(ctx context.Context, username string, nickname, website *string) error {
	// 1. 获取用户信息
	user, err := s.userRepo.FindByUsername(ctx, username)
	if err != nil {
		return fmt.Errorf("获取用户信息失败: %w", err)
	}
	if user == nil {
		return fmt.Errorf("当前登录用户不存在")
	}

	// 2. 更新字段（仅更新提供的字段）
	if nickname != nil {
		user.Nickname = *nickname
	}
	if website != nil {
		user.Website = *website
	}

	// 3. 保存更新
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("更新用户信息失败: %w", err)
	}

	return nil
}

// UpdateUserProfileByID 实现了根据用户ID更新基本信息的业务逻辑
func (s *userService) UpdateUserProfileByID(ctx context.Context, userID uint, nickname, website *string) error {
	// 1. 获取用户信息
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("获取用户信息失败: %w", err)
	}
	if user == nil {
		return fmt.Errorf("当前登录用户不存在")
	}

	// 2. 更新字段（仅更新提供的字段）
	if nickname != nil {
		user.Nickname = *nickname
	}
	if website != nil {
		user.Website = *website
	}

	// 3. 保存更新
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("更新用户信息失败: %w", err)
	}

	return nil
}

// UpdateUserAvatar 更新用户头像
func (s *userService) UpdateUserAvatar(ctx context.Context, userID uint, avatarURL string) error {
	// 1. 获取用户信息
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("获取用户信息失败: %w", err)
	}
	if user == nil {
		return fmt.Errorf("用户不存在")
	}

	// 2. 更新头像字段
	user.Avatar = avatarURL

	// 3. 保存更新
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("更新用户头像失败: %w", err)
	}

	return nil
}

// ========== 管理员用户管理方法实现 ==========

// AdminListUsers 管理员分页获取用户列表
func (s *userService) AdminListUsers(ctx context.Context, page, pageSize int, keyword string, groupID *uint, status *int) ([]*model.User, int64, error) {
	// 参数校验
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	// 调用仓储层方法
	users, total, err := s.userRepo.List(ctx, page, pageSize, keyword, groupID, status)
	if err != nil {
		return nil, 0, fmt.Errorf("查询用户列表失败: %w", err)
	}

	return users, total, nil
}

// AdminCreateUser 管理员创建新用户
func (s *userService) AdminCreateUser(ctx context.Context, username, password, email, nickname string, userGroupID uint) (*model.User, error) {
	// 1. 参数校验
	if username == "" || password == "" {
		return nil, fmt.Errorf("用户名和密码不能为空")
	}

	// 2. 检查用户名是否已存在
	existingUser, err := s.userRepo.FindByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("检查用户名失败: %w", err)
	}
	if existingUser != nil {
		return nil, fmt.Errorf("用户名 '%s' 已存在", username)
	}

	// 3. 检查邮箱是否已存在
	if email != "" {
		existingEmail, err := s.userRepo.FindByEmail(ctx, email)
		if err != nil {
			return nil, fmt.Errorf("检查邮箱失败: %w", err)
		}
		if existingEmail != nil {
			return nil, fmt.Errorf("邮箱 '%s' 已被使用", email)
		}
	}

	// 4. 密码加密
	hashedPassword, err := security.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("密码加密失败: %w", err)
	}

	// 5. 生成默认头像（使用邮箱的 MD5）
	hasher := md5.New()
	hasher.Write([]byte(strings.ToLower(strings.TrimSpace(email))))
	avatar := "avatar/" + hex.EncodeToString(hasher.Sum(nil)) + "?d=identicon"

	// 6. 创建用户
	user := &model.User{
		Username:     username,
		PasswordHash: hashedPassword,
		Email:        email,
		Nickname:     nickname,
		Avatar:       avatar,
		UserGroupID:  userGroupID,
		Status:       1, // 默认状态为正常
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("创建用户失败: %w", err)
	}

	// 7. 重新查询用户信息（包含用户组信息）
	createdUser, err := s.userRepo.FindByID(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("查询创建的用户失败: %w", err)
	}

	return createdUser, nil
}

// AdminUpdateUser 管理员更新用户信息
func (s *userService) AdminUpdateUser(ctx context.Context, userID uint, username, email, nickname *string, userGroupID *uint, status *int) error {
	// 1. 查询用户
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("查询用户失败: %w", err)
	}
	if user == nil {
		return fmt.Errorf("用户不存在")
	}

	// 2. 更新用户名（如果提供）
	if username != nil && *username != user.Username {
		// 检查新用户名是否已存在
		existingUser, err := s.userRepo.FindByUsername(ctx, *username)
		if err != nil {
			return fmt.Errorf("检查用户名失败: %w", err)
		}
		if existingUser != nil && existingUser.ID != userID {
			return fmt.Errorf("用户名 '%s' 已存在", *username)
		}
		user.Username = *username
	}

	// 3. 更新邮箱（如果提供）
	if email != nil && *email != user.Email {
		// 检查新邮箱是否已存在
		existingEmail, err := s.userRepo.FindByEmail(ctx, *email)
		if err != nil {
			return fmt.Errorf("检查邮箱失败: %w", err)
		}
		if existingEmail != nil && existingEmail.ID != userID {
			return fmt.Errorf("邮箱 '%s' 已被使用", *email)
		}
		user.Email = *email
		// 更新头像为新邮箱的 Gravatar
		hasher := md5.New()
		hasher.Write([]byte(strings.ToLower(strings.TrimSpace(*email))))
		user.Avatar = "avatar/" + hex.EncodeToString(hasher.Sum(nil)) + "?d=identicon"
	}

	// 4. 更新昵称（如果提供）
	if nickname != nil {
		user.Nickname = *nickname
	}

	// 5. 更新用户组（如果提供）
	if userGroupID != nil {
		user.UserGroupID = *userGroupID
	}

	// 6. 更新状态（如果提供）
	if status != nil {
		user.Status = *status
	}

	// 7. 保存更新
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("更新用户失败: %w", err)
	}

	return nil
}

// AdminDeleteUser 管理员删除用户
func (s *userService) AdminDeleteUser(ctx context.Context, userID uint) error {
	// 1. 检查用户是否存在
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("查询用户失败: %w", err)
	}
	if user == nil {
		return fmt.Errorf("用户不存在")
	}

	// 2. 删除用户（软删除），相关的文件依赖处理已封装在 Delete 方法中
	if err := s.userRepo.Delete(ctx, userID); err != nil {
		return fmt.Errorf("删除用户失败: %w", err)
	}

	return nil
}

// AdminResetPassword 管理员重置用户密码
func (s *userService) AdminResetPassword(ctx context.Context, userID uint, newPassword string) error {
	// 1. 参数校验
	if newPassword == "" {
		return fmt.Errorf("新密码不能为空")
	}
	if len(newPassword) < 6 {
		return fmt.Errorf("新密码长度至少为6位")
	}

	// 2. 查询用户
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("查询用户失败: %w", err)
	}
	if user == nil {
		return fmt.Errorf("用户不存在")
	}

	// 3. 密码加密
	hashedPassword, err := security.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("密码加密失败: %w", err)
	}

	// 4. 更新密码
	user.PasswordHash = hashedPassword
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("重置密码失败: %w", err)
	}

	return nil
}

// AdminUpdateUserStatus 管理员更新用户状态
func (s *userService) AdminUpdateUserStatus(ctx context.Context, userID uint, status int) error {
	// 1. 状态校验（1:正常 2:未激活 3:已封禁）
	if status < 1 || status > 3 {
		return fmt.Errorf("无效的用户状态")
	}

	// 2. 查询用户
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("查询用户失败: %w", err)
	}
	if user == nil {
		return fmt.Errorf("用户不存在")
	}

	// 3. 更新状态
	user.Status = status
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("更新用户状态失败: %w", err)
	}

	return nil
}

// ListUserGroups 获取所有用户组列表
func (s *userService) ListUserGroups(ctx context.Context) ([]*model.UserGroup, error) {
	groups, err := s.userGroupRepo.FindAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("查询用户组列表失败: %w", err)
	}
	return groups, nil
}
