import { describe, expect, it, vi } from "vitest";
import LoginResetPage from "./page";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("LoginResetPage", () => {
  it("保留重置参数并跳转到找回密码页面", async () => {
    await LoginResetPage({
      searchParams: Promise.resolve({
        id: "user_public_id",
        sign: "signed-token",
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith(
      "/forgot-password?id=user_public_id&sign=signed-token",
    );
  });
});
