import { apiClient } from "./client";
import type { ApiResponse } from "@/types";

export interface ImageLibraryItem {
  id: string;
  name: string;
  size: number;
  createdAt: string;
  thumbUrl: string;
  displayUrl: string;
}

export interface ImageLibraryListResponse {
  list: ImageLibraryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const imageLibraryApi = {
  list(params: {
    page?: number;
    keyword?: string;
  }): Promise<ApiResponse<ImageLibraryListResponse>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.keyword) searchParams.set("keyword", params.keyword);
    return apiClient.get<ImageLibraryListResponse>(
      `/api/image-library?${searchParams.toString()}`
    );
  },
};
