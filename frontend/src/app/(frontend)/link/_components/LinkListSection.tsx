"use client";

import { usePublicCategories, usePublicLinks } from "@/hooks/queries/use-friends";
import { Loader2 } from "lucide-react";
import { SiteCardGroup } from "./SiteCardGroup";
import { FlinkList } from "./FlinkList";
import type { LinkCategory } from "@/types/friends";

function CategorySection({ category }: { category: LinkCategory }) {
  const { data, isPending } = usePublicLinks({ category_id: category.id, pageSize: 200 });
  const links = data?.list || [];
  const total = data?.total || 0;

  return (
    <div className="link-group" data-category-id={category.id}>
      <div className="power_title_bar">
        <h2 id={category.name}>
          <a href={`#${category.name}`} className="headerlink">
            {category.name} ({total})
          </a>
        </h2>
        {category.description && <div className="flink-desc">{category.description}</div>}
      </div>

      {isPending && links.length === 0 && (
        <div className="site-card-group site-card-group-skeleton" aria-busy="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="site-card site-card-skeleton" />
          ))}
        </div>
      )}

      {links.length > 0 && (category.style === "card" ? <SiteCardGroup links={links} /> : <FlinkList links={links} />)}

      {isPending && links.length > 0 && (
        <div className="loading-tip">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
          正在加载...
        </div>
      )}
    </div>
  );
}

export function LinkListSection() {
  const { data: categories, isPending, isError } = usePublicCategories();

  if (isPending) {
    return (
      <div id="article-container" className="flink flink-loading" aria-busy="true">
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <div key={groupIndex} className="link-group link-group-placeholder">
            <div className="power_title_bar">
              <h2>
                <span className="link-title-skeleton" />
              </h2>
              <div className="flink-desc link-desc-skeleton" />
            </div>
            <div className="site-card-group site-card-group-skeleton">
              {Array.from({ length: 6 }).map((__, itemIndex) => (
                <div key={itemIndex} className="site-card site-card-skeleton" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm" style={{ color: "var(--anzhiyu-secondtext)" }}>
        加载友链分类失败，请稍后再试。
      </p>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--anzhiyu-secondtext)" }}>
        暂无友链分类
      </p>
    );
  }

  return (
    <div id="article-container" className="flink">
      {categories.map(category => (
        <CategorySection key={category.id} category={category} />
      ))}
    </div>
  );
}
