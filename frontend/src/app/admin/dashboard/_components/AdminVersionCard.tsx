"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import { ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { getVersionInfo, type VersionInfo } from "@/lib/version";

export function AdminVersionCard() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadVersion = async (forceRefresh = false) => {
    setLoading(true);
    try {
      setVersion(await getVersionInfo(forceRefresh));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVersion();
  }, []);

  const commit = version?.commit ? version.commit.slice(0, 8) : "未知";
  const buildDate = version?.date || "未知";

  return (
    <section className="rounded-xl border border-border/60 bg-card px-5 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">系统版本</h2>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {loading ? "读取中" : version?.version || "未知版本"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {version?.name || "anheyu-app"} · Commit {commit} · 构建 {buildDate}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            isIconOnly
            aria-label="刷新版本信息"
            isLoading={loading}
            onPress={() => loadVersion(true)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button as={Link} href="/update" size="sm" color="primary" variant="flat" endContent={<ExternalLink className="h-3.5 w-3.5" />}>
            更新日志
          </Button>
        </div>
      </div>
    </section>
  );
}
