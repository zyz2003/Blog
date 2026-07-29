"use client";

import { useCallback } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Button,
  Pagination,
  Spinner,
  Tooltip,
} from "@heroui/react";
import { MessageCircle, Trash2, Eye } from "lucide-react";
import { TableEmptyState } from "@/components/admin/TableEmptyState";
import { formatDateTimeParts } from "@/utils/date";
import type { AiChatPageState } from "../_hooks/use-ai-chat-page";

const TABLE_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "title", label: "标题" },
  { key: "updatedAt", label: "更新时间" },
  { key: "actions", label: "操作" },
];

interface ConversationListProps {
  cm: AiChatPageState;
}

export function ConversationList({ cm }: ConversationListProps) {
  const renderCell = useCallback(
    (item: { publicId: string; title: string | null; updatedAt: string }, columnKey: React.Key) => {
      switch (columnKey) {
        case "id": {
          const truncated = item.publicId.length > 12
            ? item.publicId.slice(0, 12) + "..."
            : item.publicId;
          return (
            <span className="text-sm font-mono text-muted-foreground" title={item.publicId}>
              {truncated}
            </span>
          );
        }
        case "title":
          return (
            <span className="text-sm">
              {item.title || "无标题"}
            </span>
          );
        case "updatedAt": {
          const parts = formatDateTimeParts(item.updatedAt);
          return (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground tabular-nums">
              <div>{parts.date}</div>
              <div className="text-muted-foreground/60">{parts.time}</div>
            </div>
          );
        }
        case "actions":
          return (
            <div className="flex items-center justify-center gap-1">
              <Tooltip content="查看" placement="top" size="sm">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className="w-7 h-7 min-w-0 text-primary bg-primary/10 hover:bg-primary/20"
                  onPress={() => cm.selectConversation(item.publicId)}
                >
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content="删除" placement="top" size="sm" color="danger">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  radius="full"
                  className="w-7 h-7 min-w-0 text-danger bg-danger/10 hover:bg-danger/20"
                  onPress={() => cm.handleDeleteClick(item as typeof cm.conversations[number])}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </Tooltip>
            </div>
          );
        default:
          return null;
      }
    },
    [cm]
  );

  const bottomContent = (
    <div className="py-2 px-2 flex flex-wrap justify-between items-center gap-2">
      <span className="text-small text-muted-foreground whitespace-nowrap">
        共 {cm.total} 条
      </span>
      <div className="flex items-center gap-2">
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={cm.page}
          total={cm.totalPages}
          onChange={cm.loadPage}
        />
        <div className="hidden sm:flex gap-1.5">
          <Button
            isDisabled={cm.page <= 1}
            size="sm"
            variant="flat"
            onPress={() => cm.loadPage(cm.page - 1)}
          >
            上一页
          </Button>
          <Button
            isDisabled={cm.page >= cm.totalPages}
            size="sm"
            variant="flat"
            onPress={() => cm.loadPage(cm.page + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Table
        isHeaderSticky
        aria-label="AI 对话管理表格"
        bottomContent={bottomContent}
        bottomContentPlacement="outside"
        classNames={{
          base: "flex-1 min-h-0 flex flex-col",
          wrapper: "flex-1 min-h-0 px-3! py-0! shadow-none! rounded-none! border-none!",
          table: "border-separate border-spacing-y-1.5 -mt-1.5",
          thead: "[&>tr]:first:shadow-none! after:hidden!",
          th: "bg-[#F6F7FA] dark:bg-muted first:rounded-tl-lg! last:rounded-tr-lg!",
          tr: "rounded-xl!",
          td: "first:before:rounded-s-xl! last:before:rounded-e-xl!",
        }}
      >
        <TableHeader columns={TABLE_COLUMNS}>
          {column => (
            <TableColumn key={column.key} align={column.key === "actions" ? "center" : "start"}>
              {column.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          items={cm.conversations.map(c => ({ ...c, key: c.publicId }))}
          emptyContent={
            <TableEmptyState
              icon={MessageCircle}
              hasFilter={false}
              filterEmptyText=""
              emptyText="暂无对话记录"
              emptyHint="用户通过聊天组件发起对话后，记录将显示在这里"
            />
          }
          isLoading={cm.isLoading}
          loadingContent={<Spinner size="sm" label="加载中..." />}
        >
          {item => (
            <TableRow key={item.publicId}>
              {columnKey => <TableCell>{renderCell(item, columnKey)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
