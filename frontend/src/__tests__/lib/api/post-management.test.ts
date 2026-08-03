import { afterEach, describe, expect, it } from "vitest";
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { axiosInstance } from "@/lib/api/client";
import { postManagementApi } from "@/lib/api/post-management";

const createWrappedResponse = <T>(config: AxiosRequestConfig, data: T): AxiosResponse => ({
  data: { code: 200, data, message: "ok" },
  status: 200,
  statusText: "OK",
  headers: {},
  config: config as InternalAxiosRequestConfig,
});

describe("postManagementApi.uploadArticleImage", () => {
  const originalAdapter = axiosInstance.defaults.adapter;

  afterEach(() => {
    axiosInstance.defaults.adapter = originalAdapter;
  });

  it("keeps ordinary article uploads on the default image style path", async () => {
    const file = new File(["png"], "article.png", { type: "image/png" });

    axiosInstance.defaults.adapter = async config => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/api/articles/upload");
      expect(config.data).toBeInstanceOf(FormData);

      const sentData = config.data as FormData;
      expect(sentData.get("file")).toBe(file);
      expect(sentData.has("skip_image_style")).toBe(false);

      return createWrappedResponse(config, {
        url: "/api/f/article.png/ArticleImage",
        file_id: "file-id",
      });
    };

    await expect(postManagementApi.uploadArticleImage(file)).resolves.toBe("/api/f/article.png/ArticleImage");
  });

  it("sends skip_image_style when favicon uploads request the original file URL", async () => {
    const file = new File(["icon"], "favicon.png", { type: "image/png" });

    axiosInstance.defaults.adapter = async config => {
      expect(config.method).toBe("post");
      expect(config.url).toBe("/api/articles/upload");
      expect(config.data).toBeInstanceOf(FormData);

      const sentData = config.data as FormData;
      expect(sentData.get("file")).toBe(file);
      expect(sentData.get("skip_image_style")).toBe("true");

      return createWrappedResponse(config, {
        url: "/api/f/favicon.png",
        file_id: "file-id",
      });
    };

    await expect(postManagementApi.uploadArticleImage(file, { disableImageStyle: true })).resolves.toBe(
      "/api/f/favicon.png"
    );
  });

  it("compresses Pro image proxy absolute URLs to same-origin paths", async () => {
    const file = new File(["icon"], "favicon.png", { type: "image/png" });

    axiosInstance.defaults.adapter = async config => {
      return createWrappedResponse(config, {
        url: "https://anheyu.com/api/pro/images/favicon",
        file_id: "file-id",
      });
    };

    await expect(postManagementApi.uploadArticleImage(file, { disableImageStyle: true })).resolves.toBe(
      "/api/pro/images/favicon"
    );
  });
});
