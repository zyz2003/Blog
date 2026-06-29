import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailSettingsForm } from "./EmailSettingsForm";

const mockAddToast = vi.fn();
const mockTestEmail = vi.fn();

vi.mock("@heroui/react", () => ({
  addToast: (...args: unknown[]) => mockAddToast(...args),
  Button: ({ children, onPress, isDisabled, isLoading }: Record<string, unknown>) => (
    <button type="button" onClick={onPress as () => void} disabled={Boolean(isDisabled) || Boolean(isLoading)}>
      {children as React.ReactNode}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Send: () => <span data-icon="send" />,
}));

vi.mock("@/lib/api/settings", () => ({
  settingsApi: {
    testEmail: (...args: unknown[]) => mockTestEmail(...args),
  },
}));

vi.mock("@/components/ui/form-input", () => ({
  FormInput: ({ label, value, onValueChange, type = "text", description }: Record<string, unknown>) => (
    <label>
      <span>{label as string}</span>
      <input
        aria-label={label as string}
        type={type as string}
        value={(value as string) ?? ""}
        onChange={event => (onValueChange as (value: string) => void)?.(event.target.value)}
      />
      {description ? <small>{description as React.ReactNode}</small> : null}
    </label>
  ),
}));

vi.mock("@/components/ui/form-switch", () => ({
  FormSwitch: ({ label, checked, onCheckedChange }: Record<string, unknown>) => (
    <label>
      <span>{label as string}</span>
      <input
        type="checkbox"
        aria-label={label as string}
        checked={Boolean(checked)}
        onChange={event => (onCheckedChange as (value: boolean) => void)?.(event.target.checked)}
      />
    </label>
  ),
}));

vi.mock("@/components/ui/form-monaco-editor", () => ({
  FormMonacoEditor: ({ label }: Record<string, unknown>) => <div>{label as string}</div>,
}));

vi.mock("@/components/ui/placeholder-help-panel", () => ({
  PlaceholderHelpPanel: ({ title }: Record<string, unknown>) => <div>{title as string}</div>,
}));

vi.mock("@/components/ui/spinner", () => ({
  Spinner: () => <div>loading</div>,
}));

vi.mock("./SettingsSection", () => ({
  SettingsSection: ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  ),
  SettingsFieldGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("EmailSettingsForm", () => {
  beforeEach(() => {
    mockAddToast.mockReset();
    mockTestEmail.mockReset();
  });

  it("使用发件人邮箱作为测试收件邮箱默认值", () => {
    render(<EmailSettingsForm values={{ SMTP_SENDER_EMAIL: "sender@example.com" }} onChange={() => {}} />);

    expect(screen.getByLabelText("测试收件邮箱")).toHaveValue("sender@example.com");
    expect(screen.getByRole("button", { name: /发送测试邮件/ })).toBeInTheDocument();
  });

  it("加载完成后回填测试收件邮箱默认值", async () => {
    const { rerender } = render(<EmailSettingsForm values={{}} onChange={() => {}} loading />);

    expect(screen.getByText("loading")).toBeInTheDocument();

    rerender(<EmailSettingsForm values={{ SMTP_SENDER_EMAIL: "sender@example.com" }} onChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByLabelText("测试收件邮箱")).toHaveValue("sender@example.com");
    });
  });

  it("点击发送测试邮件时调用测试接口并提示成功", async () => {
    const user = userEvent.setup();
    mockTestEmail.mockResolvedValue({ code: 200, data: null, message: "测试邮件已发送，请检查收件箱" });

    render(<EmailSettingsForm values={{ SMTP_SENDER_EMAIL: "sender@example.com" }} onChange={() => {}} />);

    await user.clear(screen.getByLabelText("测试收件邮箱"));
    await user.type(screen.getByLabelText("测试收件邮箱"), "ops@example.com");
    await user.click(screen.getByRole("button", { name: /发送测试邮件/ }));

    await waitFor(() => {
      expect(mockTestEmail).toHaveBeenCalledWith("ops@example.com");
    });
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "测试邮件已发送，请检查收件箱",
        color: "success",
      })
    );
  });
});
