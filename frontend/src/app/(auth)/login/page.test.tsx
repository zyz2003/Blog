import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import LoginPageWrapper from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("register=1"),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@/components/auth", () => ({
  LoginForm: ({ initialStep }: { initialStep?: string }) => <div>initial-step:{initialStep ?? "check-email"}</div>,
}));

describe("LoginPage", () => {
  it("register=1 时默认进入注册流程", async () => {
    render(<LoginPageWrapper />);
    expect(await screen.findByText("initial-step:register")).toBeInTheDocument();
  });
});
