package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Subscriber holds the schema definition for the Subscriber entity.
type Subscriber struct {
	ent.Schema
}

// Fields of the Subscriber.
func (Subscriber) Fields() []ent.Field {
	return []ent.Field{
		field.String("email").
			Unique().
			NotEmpty().
			MaxLen(255).
			Comment("订阅者邮箱"),
		field.Bool("is_active").
			Default(true).
			Comment("是否激活"),
		field.String("token").
			Unique().
			Optional().
			MaxLen(64).
			Comment("退订令牌"),
		field.Time("created_at").
			Default(time.Now).
			Immutable().
			Comment("订阅时间"),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			Comment("更新时间"),
	}
}

// Edges of the Subscriber.
func (Subscriber) Edges() []ent.Edge {
	return nil
}

// Indexes of the Subscriber.
func (Subscriber) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("email").Unique(),
		index.Fields("token").Unique(),
		index.Fields("is_active"),
	}
}
