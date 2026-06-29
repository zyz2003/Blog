/*
 * @Description: 文档系列表
 * @Author: 安知鱼
 * @Date: 2025-12-30 10:00:00
 * @LastEditTime: 2025-12-30 10:00:00
 * @LastEditors: 安知鱼
 */
package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// DocSeries holds the schema definition for the DocSeries entity.
type DocSeries struct {
	ent.Schema
}

// Annotations of the DocSeries.
func (DocSeries) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("文档系列表"),
	}
}

// Fields of the DocSeries.
func (DocSeries) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),

		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("创建时间"),

		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			Comment("更新时间"),

		field.String("name").
			Comment("系列名称").
			Unique().
			NotEmpty(),

		field.String("description").
			Comment("系列描述").
			Optional(),

		field.String("cover_url").
			Comment("系列封面图URL").
			Optional(),

		field.Int("sort").
			Comment("系列排序，数值越小越靠前").
			Default(0).
			NonNegative(),

		field.Int("doc_count").
			Comment("该系列下的文档数量").
			Default(0).
			NonNegative(),
	}
}

// Edges of the DocSeries.
func (DocSeries) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("articles", Article.Type),
	}
}
