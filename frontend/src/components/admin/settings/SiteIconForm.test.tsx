import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteIconForm } from "./SiteIconForm";
import { KEY_ICON_URL } from "@/lib/settings/setting-keys";

const formImageUploadCalls: Array<Record<string, unknown>> = [];

vi.mock("@/components/ui/form-input", () => ({
  FormInput: () => <div data-testid="form-input" />,
}));

vi.mock("@/components/ui/form-select", () => ({
  FormSelect: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormSelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/spinner", () => ({
  Spinner: () => <div>loading</div>,
}));

vi.mock("./SettingsSection", () => ({
  SettingsSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
  SettingsFieldGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/form-image-upload", () => ({
  FormImageUpload: (props: Record<string, unknown>) => {
    formImageUploadCalls.push(props);
    return <div data-testid="form-image-upload" />;
  },
}));

describe("SiteIconForm", () => {
  it("uploads favicon as the original image file instead of an image style URL", () => {
    formImageUploadCalls.length = 0;

    render(<SiteIconForm values={{ [KEY_ICON_URL]: "/api/f/icon/favicon.ico/ArticleImage" }} onChange={() => {}} />);

    const faviconUpload = formImageUploadCalls.find(call => call.placeholder === "favicon 图标地址");

    expect(faviconUpload).toMatchObject({
      disableImageStyle: true,
      accept: "image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.png,.svg,.ico",
    });
  });
});
