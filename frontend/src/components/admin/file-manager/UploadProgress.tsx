"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCheckboxCircleFill,
  RiCheckLine,
  RiCloseCircleFill,
  RiCloseLine,
  RiDeleteBin6Line,
  RiEditLine,
  RiExchangeLine,
  RiFileTextLine,
  RiLoader4Line,
  RiMore2Fill,
  RiRefreshLine,
  RiAlertLine,
} from "react-icons/ri";
import type { UploadItem } from "@/types/file-manager";
import type { UploadGlobalCommand, UploadGlobalCommandValue } from "@/hooks/file-manager/types";
import { formatBytes } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { slideInFromBottom, springTransition, staggerItem, gentleSpring } from "@/lib/motion";
import styles from "./UploadProgress.module.css";

interface UploadProgressProps {
  visible: boolean;
  isCollapsed: boolean;
  queue: UploadItem[];
  speedMode: "instant" | "average";
  isGlobalOverwrite: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  onAddFiles: () => void;
  onRetryItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onResolveConflict: (itemId: string, strategy: "overwrite" | "rename") => void;
  onGlobalCommand: (command: UploadGlobalCommand, value?: UploadGlobalCommandValue) => void;
}

/**
 * UploadProgress 固定右下角上传队列面板：标题统计、HeroUI Dropdown 更多菜单、分状态条目行。
 */
export function UploadProgress({
  visible,
  isCollapsed,
  queue,
  speedMode,
  isGlobalOverwrite,
  onClose,
  onToggleCollapse,
  onAddFiles,
  onRetryItem,
  onRemoveItem,
  onResolveConflict,
  onGlobalCommand,
}: UploadProgressProps) {
  const [hideCompleted, setHideCompleted] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const hasActiveItems = queue.some(item => !["success", "canceled"].includes(item.status));
  const hideCompletedEffective = hideCompleted && !hasActiveItems;

  const processedQueue = useMemo(() => {
    const list = hideCompletedEffective
      ? queue.filter(item => !["success", "canceled"].includes(item.status))
      : queue;
    return [...list].sort((a, b) =>
      sortOrder === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
    );
  }, [queue, hideCompletedEffective, sortOrder]);

  const queueStats = useMemo(() => {
    let active = 0;
    let resumable = 0;
    let ok = 0;
    let fail = 0;
    let conflict = 0;
    for (const item of queue) {
      if (["pending", "uploading", "processing"].includes(item.status)) active += 1;
      else if (item.status === "resumable") resumable += 1;
      else if (item.status === "success") ok += 1;
      else if (item.status === "error") fail += 1;
      else if (item.status === "conflict") conflict += 1;
    }
    return { active, resumable, ok, fail, conflict };
  }, [queue]);

  const handleDropdownAction = (key: React.Key) => {
    const k = String(key);
    if (k === "speed-instant") onGlobalCommand("set-speed-mode", "instant");
    else if (k === "speed-average") onGlobalCommand("set-speed-mode", "average");
    else if (k === "toggle-hide") setHideCompleted(v => !v);
    else if (k === "sort-asc") setSortOrder("asc");
    else if (k === "sort-desc") setSortOrder("desc");
    else if (k === "set-concurrency") onGlobalCommand("set-concurrency");
    else if (k === "toggle-overwrite") onGlobalCommand("set-overwrite-all", !isGlobalOverwrite);
    else if (k === "retry-all") onGlobalCommand("retry-all");
    else if (k === "clear-finished") onGlobalCommand("clear-finished");
    else if (k === "cancel-all-active") onGlobalCommand("cancel-all-active");
    else if (k === "clear-all-failed") onGlobalCommand("clear-all-failed");
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className={`${styles["upload-progress-panel"]} ${isCollapsed ? styles["is-collapsed"] : ""}`}
          variants={slideInFromBottom}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={springTransition}
        >
          <div className={styles["panel-header"]}>
            <Tooltip content="关闭" placement="bottom" showArrow={false}>
              <span className={styles["icon-wrapper"]} onClick={onClose}>
                <RiCloseLine />
              </span>
            </Tooltip>
            <div className={styles["panel-title-wrap"]}>
              <span className={styles["panel-title-main"]}>上传队列</span>
              {queue.length > 0 ? (
                <span className={styles["panel-title-stats"]}>
                  进行中 {queueStats.active}
                  {queueStats.resumable > 0 ? ` · 可续传 ${queueStats.resumable}` : ""} · 成功 {queueStats.ok} · 失败{" "}
                  {queueStats.fail}
                  {queueStats.conflict > 0 ? ` · 冲突 ${queueStats.conflict}` : ""}
                </span>
              ) : null}
            </div>
            <div className={styles["header-actions"]}>
              <Tooltip content="添加文件" placement="bottom" showArrow={false}>
                <span className={styles["icon-wrapper"]} onClick={onAddFiles}>
                  <RiAddLine />
                </span>
              </Tooltip>
              <Tooltip content="更多操作" placement="bottom" showArrow={false}>
                <Dropdown
                  placement="bottom-end"
                  offset={4}
                  classNames={{ content: styles["upload-dropdown-content"] }}
                >
                  <DropdownTrigger>
                    <Button
                      isIconOnly
                      variant="light"
                      aria-label="更多操作"
                      className={styles["dropdown-icon-trigger"]}
                    >
                      <RiMore2Fill />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="上传队列更多操作" onAction={handleDropdownAction}>
                    <DropdownItem
                      key="speed-instant"
                      textValue="瞬时速度"
                      startContent={speedMode === "instant" ? <RiCheckLine className={styles["menu-check"]} /> : null}
                    >
                      瞬时速度
                    </DropdownItem>
                    <DropdownItem
                      key="speed-average"
                      textValue="平均速度"
                      startContent={speedMode === "average" ? <RiCheckLine className={styles["menu-check"]} /> : null}
                    >
                      平均速度
                    </DropdownItem>
                    <DropdownItem key="toggle-hide" showDivider textValue="隐藏已完成任务">
                      {hideCompleted ? "显示已完成任务" : "隐藏已完成任务"}
                    </DropdownItem>
                    <DropdownItem
                      key="sort-asc"
                      textValue="最先添加靠前"
                      startContent={sortOrder === "asc" ? <RiCheckLine className={styles["menu-check"]} /> : null}
                    >
                      最先添加靠前
                    </DropdownItem>
                    <DropdownItem
                      key="sort-desc"
                      textValue="最后添加靠前"
                      startContent={sortOrder === "desc" ? <RiCheckLine className={styles["menu-check"]} /> : null}
                    >
                      最后添加靠前
                    </DropdownItem>
                    <DropdownItem key="set-concurrency" showDivider textValue="设置并发数">
                      设置并发数
                    </DropdownItem>
                    <DropdownItem
                      key="toggle-overwrite"
                      textValue="覆盖所有同名文件"
                      startContent={isGlobalOverwrite ? <RiCheckLine className={styles["menu-check"]} /> : null}
                    >
                      覆盖所有同名文件
                    </DropdownItem>
                    <DropdownItem key="retry-all" showDivider textValue="重试所有失败任务">
                      重试所有失败任务
                    </DropdownItem>
                    <DropdownItem key="clear-finished" textValue="清除已完成任务">
                      清除已完成任务
                    </DropdownItem>
                    <DropdownItem key="cancel-all-active" showDivider textValue="取消全部进行中">
                      取消全部进行中
                    </DropdownItem>
                    <DropdownItem key="clear-all-failed" textValue="清除全部失败任务">
                      清除全部失败任务
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </Tooltip>
              <Tooltip content={isCollapsed ? "展开" : "收起"} placement="bottom" showArrow={false}>
                <motion.span
                  className={styles["icon-wrapper"]}
                  onClick={onToggleCollapse}
                  animate={{ rotate: isCollapsed ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <RiArrowDownSLine />
                </motion.span>
              </Tooltip>
            </div>
          </div>

          <AnimatePresence>
            {!isCollapsed ? (
              <motion.div
                className={styles["panel-body"]}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={gentleSpring}
              >
                {processedQueue.length === 0 ? (
                  <div className={styles["empty-queue"]}>
                    {queue.length > 0 && queue.every(item => ["success", "canceled"].includes(item.status))
                      ? "所有任务已处理完毕"
                      : queue.length > 0
                        ? "所有活动任务已完成"
                        : "没有上传任务"}
                  </div>
                ) : null}
                <AnimatePresence>
                  {processedQueue.map(item => (
                    <motion.div
                      key={item.id}
                      variants={staggerItem}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={springTransition}
                      layout
                    >
                      <UploadItemRow
                        item={item}
                        speedMode={speedMode}
                        onRetry={() => onRetryItem(item.id)}
                        onRemove={() => onRemoveItem(item.id)}
                        onResolveConflict={strategy => onResolveConflict(item.id, strategy)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * UploadItemRow 单条上传任务：进度/状态、错误条、悬停操作；无 hover 设备上同时展示状态与按钮。
 */
function UploadItemRow({
  item,
  speedMode,
  onRetry,
  onRemove,
  onResolveConflict,
}: {
  item: UploadItem;
  speedMode: "instant" | "average";
  onRetry: () => void;
  onRemove: () => void;
  onResolveConflict: (strategy: "overwrite" | "rename") => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [noHoverDevice, setNoHoverDevice] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const sync = () => setNoHoverDevice(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const speed = speedMode === "instant" ? item.instantSpeed : item.averageSpeed;
  const showActionsAlways = noHoverDevice;

  /** 非 error/conflict 的简短状态文案（错误详情仅在 item-error-display 展示）。 */
  const getStatusText = () => {
    switch (item.status) {
      case "pending":
        return "等待上传...";
      case "canceled":
        return "已取消";
      case "resumable":
        return "可续传";
      case "processing":
        return "正在准备上传…";
      default:
        return "";
    }
  };

  const statusClass =
    item.status === "success"
      ? styles["status-success"]
      : item.status === "error"
        ? styles["status-error"]
        : item.status === "uploading" || item.status === "processing"
          ? styles["status-uploading"]
          : item.status === "conflict"
            ? styles["status-conflict"]
            : "";

  const statusBlock =
    item.status === "success" ? (
      <div className={styles["item-detail-info"]}>
        <span className={`${styles["item-message"]} ${styles["is-success"]}`}>上传成功</span>
        <span className={styles["size-info"]}>
          100% · {formatBytes(item.size)}
        </span>
      </div>
    ) : ["uploading", "processing", "resumable"].includes(item.status) ? (
      <div className={styles["item-detail-info"]}>
        <span className={styles["progress-percent"]}>{item.progress}%</span>
        <span className={styles["speed-badge"]}>{speed ? `${formatBytes(speed)}/s` : "--"}</span>
        <span className={styles["size-info"]}>
          {formatBytes(item.uploadedSize)} / {formatBytes(item.size)}
        </span>
      </div>
    ) : (
      <div
        className={`${styles["item-message"]} ${
          item.status === "error" ? styles["is-error"] : item.status === "conflict" ? styles["is-conflict"] : ""
        }`}
      >
        {item.status === "error"
          ? "上传失败"
          : item.status === "conflict"
            ? "文件冲突"
            : getStatusText()}
      </div>
    );

  const actionButtons = (
    <>
      {item.status === "success" && (
        <Tooltip content="删除记录" placement="top" showArrow={false}>
          <button type="button" className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
            <RiDeleteBin6Line />
          </button>
        </Tooltip>
      )}
      {item.status === "error" && (
        <>
          <Tooltip content="重试" placement="top" showArrow={false}>
            <button type="button" className={styles["action-btn"]} onClick={onRetry}>
              <RiRefreshLine />
            </button>
          </Tooltip>
          <Tooltip content="删除" placement="top" showArrow={false}>
            <button type="button" className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
              <RiDeleteBin6Line />
            </button>
          </Tooltip>
        </>
      )}
      {item.status === "conflict" && (
        <>
          <Tooltip content="覆盖" placement="top" showArrow={false}>
            <button type="button" className={styles["action-btn"]} onClick={() => onResolveConflict("overwrite")}>
              <RiExchangeLine />
            </button>
          </Tooltip>
          <Tooltip content="重命名" placement="top" showArrow={false}>
            <button type="button" className={styles["action-btn"]} onClick={() => onResolveConflict("rename")}>
              <RiEditLine />
            </button>
          </Tooltip>
          <Tooltip content="删除" placement="top" showArrow={false}>
            <button type="button" className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
              <RiDeleteBin6Line />
            </button>
          </Tooltip>
        </>
      )}
      {item.status === "resumable" && (
        <>
          <Tooltip content="继续上传" placement="top" showArrow={false}>
            <button type="button" className={styles["action-btn"]} onClick={onRetry}>
              <RiRefreshLine />
            </button>
          </Tooltip>
          <Tooltip content="删除任务" placement="top" showArrow={false}>
            <button type="button" className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
              <RiDeleteBin6Line />
            </button>
          </Tooltip>
        </>
      )}
      {["uploading", "pending", "processing"].includes(item.status) && (
        <Tooltip content="取消" placement="top" showArrow={false}>
          <button type="button" className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
            <RiCloseLine />
          </button>
        </Tooltip>
      )}
      {item.status === "canceled" && (
        <Tooltip content="删除记录" placement="top" showArrow={false}>
          <button type="button" className={`${styles["action-btn"]} ${styles.danger}`} onClick={onRemove}>
            <RiDeleteBin6Line />
          </button>
        </Tooltip>
      )}
    </>
  );

  return (
    <div
      className={`${styles["upload-item"]} ${statusClass} ${showActionsAlways ? styles["touch-layout"] : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {(item.status === "uploading" || item.status === "pending" || item.status === "processing") && (
        <motion.div
          className={styles["progress-fill"]}
          animate={{ width: `${item.progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      )}

      <div className={styles["item-icon"]}>
        {item.status === "success" ? (
          <RiCheckboxCircleFill className={styles["icon-success"]} />
        ) : item.status === "error" ? (
          <RiCloseCircleFill className={styles["icon-error"]} />
        ) : item.status === "uploading" || item.status === "processing" ? (
          <RiLoader4Line className={styles["icon-uploading"]} />
        ) : item.status === "conflict" ? (
          <RiAlertLine className={styles["icon-conflict"]} />
        ) : (
          <RiFileTextLine className={styles["icon-default"]} />
        )}
      </div>

      <div className={styles["item-info"]}>
        <div className={styles["item-name"]}>
          <span title={item.name}>{item.name}</span>
          {item.isResuming && item.status !== "success" && <span className={styles["resume-tag"]}>断点续传</span>}
        </div>

        {item.errorMessage && ["error", "conflict"].includes(item.status) ? (
          <div className={styles["item-error-display"]}>
            <RiAlertLine className={styles["item-error-icon"]} aria-hidden />
            <span>{item.errorMessage}</span>
          </div>
        ) : null}

        <div className={styles["status-action-wrapper"]}>
          {showActionsAlways ? (
            <div className={styles["touch-stack"]}>
              <div className={styles["touch-status"]}>{statusBlock}</div>
              <div className={styles["item-actions"]}>{actionButtons}</div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {!isHovered ? (
                <motion.div
                  key={`status-${item.id}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {statusBlock}
                </motion.div>
              ) : (
                <motion.div
                  key={`actions-${item.id}`}
                  className={styles["item-actions"]}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {actionButtons}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
