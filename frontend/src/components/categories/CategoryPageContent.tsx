"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCategories } from "@/hooks/queries";
import { useSiteConfigStore } from "@/store/site-config-store";
import { FaFolder } from "react-icons/fa6";
import styles from "./CategoryPage.module.css";

export function CategoryPageContent() {
  const router = useRouter();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const { data: categories = [], isLoading, isError } = useCategories();

  const isOneImageEnabled = useMemo(() => {
    const pageConfig = siteConfig?.page?.one_image?.config || siteConfig?.page?.oneImageConfig;
    return pageConfig?.categories?.enable || false;
  }, [siteConfig]);

  const goToCategory = useCallback(
    (categoryName: string) => {
      router.push(`/categories/${encodeURIComponent(categoryName)}/`);
    },
    [router]
  );

  return (
    <div className={styles.categoryCloudAmount}>
      {!isOneImageEnabled && <h1 className={styles.pageTitle}>分类</h1>}

      {isLoading && <div className={styles.loadingTip}>分类加载中...</div>}
      {isError && <div className={styles.errorTip}>加载分类失败，请稍后重试</div>}

      {!isLoading && !isError && (
        <div className={styles.categoryCloudList}>
          {categories.map(category => (
            <button key={category.id} className={styles.categoryItem} onClick={() => goToCategory(category.name)}>
              <FaFolder aria-hidden="true" />
              {category.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
