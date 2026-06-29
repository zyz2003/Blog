/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-13 10:16:04
 * @LastEditTime: 2025-08-13 10:16:10
 * @LastEditors: 安知鱼
 */
package dto

type TestEmailRequest struct {
	ToEmail string `json:"to_email" binding:"required,email"`
}
