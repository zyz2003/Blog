import { describe, expect, it, vi, beforeEach } from "vitest";
import { settingsApi } from "@/lib/api/settings";

const mockPost = vi.fn();

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe("settingsApi", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("发送测试邮件时调用管理员测试接口", async () => {
    mockPost.mockResolvedValue({ code: 200, data: null, message: "测试邮件已发送" });

    await settingsApi.testEmail("ops@example.com");

    expect(mockPost).toHaveBeenCalledWith("/api/settings/test-email", {
      to_email: "ops@example.com",
    });
  });
});
