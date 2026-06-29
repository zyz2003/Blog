// ent/schema/article_history.go

/*
 * @Description: 文章历史版本表
 * @Author: 安知鱼
 * @Date: 2026-01-13
 */
package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// ArticleHistory holds the schema definition for the ArticleHistory entity.
type ArticleHistory struct {
	ent.Schema
}

// Annotations of the ArticleHistory.
func (ArticleHistory) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.WithComments(true),
		schema.Comment("文章历史版本表"),
	}
}

// Fields of the ArticleHistory.
func (ArticleHistory) Fields() []ent.Field {
	return []ent.Field{
		field.Uint("id"),
		field.Uint("article_id").
			Comment("关联的文章ID"),
		field.Int("version").
			Comment("版本号，从1开始递增").
			Positive(),
		field.String("title").
			Comment("文章标题").
			NotEmpty(),
		field.Text("content_md").
			Comment("Markdown内容").
			Optional(),
		field.Text("content_html").
			Comment("HTML内容").
			Optional(),
		field.String("cover_url").
			Comment("封面图URL").
			Optional(),
		field.String("top_img_url").
			Comment("顶部大图URL").
			Optional(),
		field.String("primary_color").
			Comment("主色调").
			Optional(),
		field.JSON("summaries", []string{}).
			Comment("摘要列表").
			Optional(),
		field.Int("word_count").
			Comment("字数").
			Default(0).
			NonNegative(),
		field.String("keywords").
			Comment("关键词").
			Optional(),
		field.Uint("editor_id").
			Comment("编辑者ID"),
		field.String("editor_nickname").
			Comment("编辑者昵称（冗余存储）").
			Optional(),
		field.String("change_note").
			Comment("变更说明").
			Optional().
			MaxLen(500),
		field.Time("created_at").
			Comment("创建时间").
			Default(time.Now).
			Immutable(),
		// PRO版本扩展字段
		field.JSON("extra_data", map[string]interface{}{}).
			Comment("扩展数据（PRO版付费内容等）").
			Optional(),
	}
}

// Edges of the ArticleHistory.
func (ArticleHistory) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("article", Article.Type).
			Ref("histories").
			Field("article_id").
			Required().
			Unique(),
	}
}

// Indexes of the ArticleHistory.
func (ArticleHistory) Indexes() []ent.Index {
	return []ent.Index{
		// 联合唯一索引：同一文章的版本号唯一
		index.Fields("article_id", "version").Unique(),
		// 查询优化索引
		index.Fields("article_id", "created_at"),
		index.Fields("editor_id"),
	}
}
