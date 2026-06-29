/**
 * 文章管理 Query Hooks
 * 对接管理端文章 API，提供服务端分页查询和各类 mutation
 */

import { useQuery, useMutation, useQueryClient, queryOptions, keepPreviousData } from "@tanstack/react-query";
import { postManagementApi } from "@/lib/api/post-management";
import type {
  AdminArticleListParams,
  CreateArticleRequest,
  UpdateArticleRequest,
  ImportArticlesParams,
} from "@/types/post-management";

export const postManagementKeys = {
  all: ["post-management"] as const,
  lists: () => [...postManagementKeys.all, "list"] as const,
  list: (params: AdminArticleListParams) => [...postManagementKeys.lists(), params] as const,
  detail: (id: string) => [...postManagementKeys.all, "detail", id] as const,
  editDetail: (id: string) => [...postManagementKeys.all, "edit-detail", id] as const,
};

export const adminArticlesQueryOptions = (params: AdminArticleListParams = {}) =>
  queryOptions({
    queryKey: postManagementKeys.list(params),
    queryFn: () => postManagementApi.getArticles(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });

export const adminArticleDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: postManagementKeys.detail(id),
    queryFn: () => postManagementApi.getArticle(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

export const adminArticleEditDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: postManagementKeys.editDetail(id),
    queryFn: () => postManagementApi.getArticleForEdit(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

export function useAdminArticles(params: AdminArticleListParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    ...adminArticlesQueryOptions(params),
    enabled: options?.enabled ?? true,
  });
}

export function useAdminArticleDetail(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    ...adminArticleDetailQueryOptions(id),
    enabled: (options?.enabled ?? true) && !!id,
  });
}

export function useArticleForEdit(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    ...adminArticleEditDetailQueryOptions(id),
    enabled: (options?.enabled ?? true) && !!id,
  });
}

export function useCreateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateArticleRequest) => postManagementApi.createArticle(data),
    onSuccess: () => {
      // refetchType: all — 列表页未挂载时（如在编辑器）也需预刷新缓存；全局 refetchOnMount 为 false 时否则返回列表仍显示旧数据
      queryClient.invalidateQueries({ queryKey: postManagementKeys.lists(), refetchType: "all" });
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateArticleRequest }) => postManagementApi.updateArticle(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: postManagementKeys.lists(), refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: postManagementKeys.detail(variables.id), refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: postManagementKeys.editDetail(variables.id), refetchType: "all" });
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => postManagementApi.deleteArticle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postManagementKeys.lists(), refetchType: "all" });
    },
  });
}

export function useBatchDeleteArticles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (articleIds: string[]) => postManagementApi.batchDeleteArticles(articleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postManagementKeys.lists(), refetchType: "all" });
    },
  });
}

/**
 * 导出文章（成功后触发浏览器下载 ZIP）
 */
export function useExportArticles() {
  return useMutation({
    mutationFn: (articleIds: string[]) => postManagementApi.exportArticles(articleIds),
    onSuccess: blob => {
      const url = URL.createObjectURL(blob);
      try {
        const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
        const link = document.createElement("a");
        link.href = url;
        link.download = `articles-export-${timestamp}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  });
}

export function useImportArticles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ImportArticlesParams) => postManagementApi.importArticles(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postManagementKeys.lists(), refetchType: "all" });
    },
  });
}
