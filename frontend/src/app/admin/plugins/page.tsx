"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Chip,
  Tooltip,
  Spinner,
} from "@heroui/react";
import {
  Plug,
  RefreshCw,
  Power,
  PowerOff,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react";
import { motion } from "framer-motion";
import { adminContainerVariants, adminItemVariants } from "@/lib/motion";
import { addToast } from "@heroui/react";

interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: string;
}

interface PluginInfo {
  metadata: PluginMetadata;
  status: "running" | "stopped" | "error" | "disabled";
  file_path: string;
  error?: string;
  loaded_at?: string;
}

const statusConfig = {
  running: { label: "运行中", color: "success" as const, icon: CheckCircle2 },
  stopped: { label: "已停止", color: "default" as const, icon: XCircle },
  error: { label: "异常", color: "danger" as const, icon: AlertCircle },
  disabled: { label: "已禁用", color: "warning" as const, icon: Ban },
};

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPlugins = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/plugins");
      const data = await res.json();
      if (data.code === 200) {
        setPlugins(data.data || []);
      }
    } catch {
      addToast({ title: "获取插件列表失败", color: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const handleAction = async (
    id: string,
    action: "reload" | "disable" | "enable"
  ) => {
    setActionLoading(`${id}-${action}`);
    try {
      const res = await fetch(`/api/admin/plugins/${id}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.code === 200) {
        addToast({ title: data.message || "操作成功", color: "success" });
        await fetchPlugins();
      } else {
        addToast({ title: data.message || "操作失败", color: "danger" });
      }
    } catch {
      addToast({ title: "操作失败", color: "danger" });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      variants={adminContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div
        variants={adminItemVariants}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">插件管理</h1>
          <p className="text-sm text-default-500 mt-1">
            管理运行时加载的插件。将插件二进制文件放入 data/plugins/
            目录即可自动发现。
          </p>
        </div>
        <Button
          variant="flat"
          startContent={<RefreshCw className="w-4 h-4" />}
          onPress={() => {
            setLoading(true);
            fetchPlugins();
          }}
        >
          刷新
        </Button>
      </motion.div>

      {plugins.length === 0 ? (
        <motion.div
          variants={adminItemVariants}
          className="flex flex-col items-center justify-center py-16 rounded-xl border border-default-200 bg-default-50"
        >
          <Plug className="w-12 h-12 text-default-300 mb-4" />
          <p className="text-default-500 text-lg font-medium">
            暂无已安装的插件
          </p>
          <p className="text-default-400 text-sm mt-2">
            将插件可执行文件放入 data/plugins/ 目录，系统会自动发现并加载
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={adminItemVariants}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {plugins.map((plugin) => {
            const status = statusConfig[plugin.status] || statusConfig.stopped;
            const StatusIcon = status.icon;

            return (
              <motion.div
                key={plugin.metadata.id}
                variants={adminItemVariants}
                className="relative flex flex-col gap-3 p-5 rounded-xl border border-default-200 bg-content1 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                      <Plug className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">
                        {plugin.metadata.name}
                      </h3>
                      <p className="text-xs text-default-400">
                        v{plugin.metadata.version}
                      </p>
                    </div>
                  </div>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={status.color}
                    startContent={<StatusIcon className="w-3 h-3" />}
                  >
                    {status.label}
                  </Chip>
                </div>

                <p className="text-sm text-default-500 line-clamp-2">
                  {plugin.metadata.description}
                </p>

                {plugin.error && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-danger-50 text-danger text-xs">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span className="break-all">{plugin.error}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-default-400">
                  <span>作者: {plugin.metadata.author || "未知"}</span>
                  {plugin.loaded_at && (
                    <>
                      <span>|</span>
                      <span>
                        加载于:{" "}
                        {new Date(plugin.loaded_at).toLocaleString("zh-CN")}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-default-100">
                  <Tooltip content="重新加载">
                    <Button
                      size="sm"
                      variant="flat"
                      isIconOnly
                      isLoading={
                        actionLoading ===
                        `${plugin.metadata.id}-reload`
                      }
                      onPress={() =>
                        handleAction(plugin.metadata.id, "reload")
                      }
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </Tooltip>

                  {plugin.status === "disabled" ? (
                    <Tooltip content="启用">
                      <Button
                        size="sm"
                        variant="flat"
                        color="success"
                        isIconOnly
                        isLoading={
                          actionLoading ===
                          `${plugin.metadata.id}-enable`
                        }
                        onPress={() =>
                          handleAction(plugin.metadata.id, "enable")
                        }
                      >
                        <Power className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  ) : (
                    <Tooltip content="禁用">
                      <Button
                        size="sm"
                        variant="flat"
                        color="warning"
                        isIconOnly
                        isLoading={
                          actionLoading ===
                          `${plugin.metadata.id}-disable`
                        }
                        onPress={() =>
                          handleAction(plugin.metadata.id, "disable")
                        }
                      >
                        <PowerOff className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
