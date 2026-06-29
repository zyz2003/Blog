/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-13 23:40:12
 * @LastEditTime: 2025-07-31 10:01:36
 * @LastEditors: 安知鱼
 */
package mixin

import (
	"context"
	"fmt"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/mixin"
)

type SoftDeleteMutator interface {
	SetOp(ent.Op)
	SetDeletedAt(time.Time)
}

// SoftDeleteMixin 实现了软删除的 mixin.
type SoftDeleteMixin struct {
	mixin.Schema
}

// Fields 定义了 deleted_at 字段.
func (SoftDeleteMixin) Fields() []ent.Field {
	return []ent.Field{
		field.Time("deleted_at").
			Optional().
			Nillable(),
	}
}

// Hooks 实现了拦截逻辑.
func (SoftDeleteMixin) Hooks() []ent.Hook {
	return []ent.Hook{
		// 定义一个 hook 函数
		func(next ent.Mutator) ent.Mutator {
			// ent.MutateFunc 是一个适配器，方便地使用普通函数作为 Mutator
			return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
				// 检查这是否是一个 DELETE 或 DELETE_ONE 操作
				if !m.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
					return next.Mutate(ctx, m)
				}
				// 将 mutation 类型断言为定义的接口
				mx, ok := m.(SoftDeleteMutator)
				if !ok {
					return nil, fmt.Errorf("unexpected mutation type %T", m)
				}
				// 1. 将操作从 "删除" 改为 "更新"
				mx.SetOp(ent.OpUpdate)
				// 2. 设置 deleted_at 字段为当前时间
				mx.SetDeletedAt(time.Now())
				// 3. 继续执行已经被修改过的 "更新" 操作
				return next.Mutate(ctx, m)
			})
		},
	}
}
