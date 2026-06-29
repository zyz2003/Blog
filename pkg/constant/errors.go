/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-27 12:08:15
 * @LastEditTime: 2025-08-11 19:06:30
 * @LastEditors: 安知鱼
 */
package constant

import "errors"

// 定义业务逻辑相关的标准错误
var (
	// ErrNotFound 表示资源未找到，可以由 Handler 转换为 404
	ErrNotFound = errors.New("资源未找到")

	// ErrForbidden 表示无权访问，可以由 Handler 转换为 403
	ErrForbidden = errors.New("操作禁止")

	// ErrConflict 表示资源冲突，可以由 Handler 转换为 409
	ErrConflict = errors.New("资源冲突")

	// ErrInternalServer 表示服务器内部错误，可以由 Handler 转换为 500
	ErrInternalServer = errors.New("内部服务器错误")

	// ErrBadRequest 表示请求参数错误，可以由 Handler 转换为 400
	ErrBadRequest = errors.New("错误的请求")

	// ErrUnauthorized 表示未授权，可以由 Handler 转换为 401
	ErrUnauthorized = errors.New("未经授权的访问")

	// ErrInvalidToken 表示无效的令牌，可以由 Handler 转换为 401
	ErrInvalidToken = errors.New("无效令牌")

	// ErrStorageNotFound 表示存储策略未找到，可以由 Handler 转换为 404
	ErrStorageNotFound = errors.New("未找到存储策略")

	// ErrStorageConflict 表示存储策略冲突，可以由 Handler 转换为 409
	ErrStorageConflict = errors.New("存储策略冲突")

	// ErrLinkExpired 表示链接已过期，可以由 Handler 转换为 410
	ErrLinkExpired = errors.New("链接已过期")

	// ErrSignatureInvalid 表示签名无效，可以由 Handler 转换为 400
	ErrSignatureInvalid = errors.New("签名无效")

	// ErrInvalidOperation 表示不允许的操作，可以由 Handler 转换为 403
	ErrInvalidOperation = errors.New("不允许的操作")

	// ErrInvalidPolicyType 表示无效的存储策略类型，可以由 Handler 转换为 400
	ErrInvalidPolicyType = errors.New("无效的存储策略类型")

	// ErrPolicyNotFound 表示存储策略未找到，可以由 Handler 转换为 404
	ErrPolicyNotFound = errors.New("存储策略未找到")

	// ErrPolicyConflict 表示存储策略冲突，可以由 Handler 转换为 409
	ErrPolicyConflict = errors.New("存储策略冲突")

	// ErrPolicySettingsInvalid 表示存储策略设置无效，可以由 Handler 转换为 400
	ErrPolicySettingsInvalid = errors.New("存储策略设置无效")

	// ErrPolicyNameConflict 表示存储策略名称冲突，可以由 Handler 转换为 409
	ErrPolicyNameConflict = errors.New("存储策略名称冲突")

	// ErrInvalidPublicID 表示无效的公共ID，可以由 Handler 转换为 400
	ErrInvalidPublicID = errors.New("无效的公共ID")

	// ErrPolicyNotSupportAuth 表示存储策略不支持此授权方式，可以由 Handler 转换为 400
	ErrPolicyNotSupportAuth = errors.New("存储策略不支持此授权方式")

	// ErrPolicyUsedByFiles 表示存储策略正在被文件使用，无法删除，可以由 Handler 转换为 409
	ErrPolicyUsedByFiles = errors.New("存储策略正在被文件使用，无法删除")

	// ErrAdminEmailUsedByGuest 表示匿名用户尝试使用管理员邮箱发表评论
	ErrAdminEmailUsedByGuest = errors.New("此邮箱为管理员专属，请登录后发表评论")
)
