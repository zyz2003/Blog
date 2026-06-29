"use client";

import { Input, Switch } from "@heroui/react";
import { StorageSecretField } from "@/components/admin/storage/StorageSecretField";
import type { StoragePolicy } from "@/types/storage-policy";

interface UpyunFormProps {
  form: Partial<StoragePolicy>;
  onChange: (form: Partial<StoragePolicy>) => void;
}

export function UpyunForm({ form, onChange }: UpyunFormProps) {
  const settings = form.settings ?? {};
  const updateSettings = (patch: Record<string, unknown>) => {
    onChange({ ...form, settings: { ...settings, ...patch, upload_method: "server" } });
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2">又拍云配置</div>

      <Input
        label="服务名称"
        labelPlacement="outside"
        placeholder="例如 my-service"
        size="sm"
        isRequired
        value={form.bucket_name ?? ""}
        onValueChange={v => onChange({ ...form, bucket_name: v })}
        description="又拍云云存储服务名称"
      />

      <Input
        label="REST API Endpoint"
        labelPlacement="outside"
        placeholder="https://v0.api.upyun.com"
        size="sm"
        isRequired
        value={form.server ?? ""}
        onValueChange={v => onChange({ ...form, server: v })}
        description="默认可填写 https://v0.api.upyun.com"
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">路径设置</div>

      <Input
        label="云端存储根目录"
        labelPlacement="outside"
        placeholder="例如 /images 或留空"
        size="sm"
        value={form.base_path ?? ""}
        onValueChange={v => onChange({ ...form, base_path: v })}
      />

      <Input
        label="应用内挂载路径"
        labelPlacement="outside"
        placeholder="例如 /upyun"
        size="sm"
        isRequired
        value={form.virtual_path ?? ""}
        onValueChange={v => onChange({ ...form, virtual_path: v })}
        description="此策略在应用内部的访问路径，需唯一"
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">操作员密钥</div>

      <Input
        label="操作员"
        labelPlacement="outside"
        size="sm"
        isRequired
        value={form.access_key ?? ""}
        onValueChange={v => onChange({ ...form, access_key: v })}
      />

      <StorageSecretField
        label="操作员密码"
        isRequired
        value={form.secret_key ?? ""}
        onValueChange={v => onChange({ ...form, secret_key: v })}
      />

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">访问权限</div>

      <Switch size="sm" isSelected={form.is_private ?? false} onValueChange={v => onChange({ ...form, is_private: v })}>
        <span className="text-sm">私有读写</span>
      </Switch>

      <div className="text-sm font-medium text-primary border-b border-border/40 pb-2 mt-6">下载设置</div>

      <Input
        label="CDN 加速域名（可选）"
        labelPlacement="outside"
        placeholder="https://cdn.example.com"
        size="sm"
        value={settings.cdn_domain ?? ""}
        onValueChange={v => updateSettings({ cdn_domain: v })}
        description="填写后下载链接优先使用该域名"
      />

      <Switch
        size="sm"
        isSelected={settings.custom_proxy ?? false}
        onValueChange={v => updateSettings({ custom_proxy: v })}
      >
        <span className="text-sm">开启下载中转</span>
      </Switch>
    </div>
  );
}
