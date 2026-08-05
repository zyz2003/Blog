"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiCloseLine,
  RiDeleteBin6Line,
  RiDownload2Line,
  RiEdit2Line,
  RiFileCopyLine,
  RiFolderTransferLine,
  RiLinkM,
  RiSearch2Line,
  RiShareLine,
  RiUpload2Line,
  RiRefreshLine,
} from "react-icons/ri";
import { Button, addToast } from "@heroui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { springTransition } from "@/lib/motion";
import { migrateDiskFilesApi } from "@/lib/api/file-manager";
import styles from "./FileHeader.module.css";

interface FileHeaderProps {
  hasSelection: boolean;
  isSingleSelection: boolean;
  selectionCountLabel: string;
  onOpenNewMenu: (event: MouseEvent) => void;
  onTriggerSearch: (element: Element) => void;
  onClearSelection: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onMove: () => void;
  onRename: () => void;
  onShare: () => void;
  onGetDirectLink: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

export function FileHeader({
  hasSelection,
  isSingleSelection,
  selectionCountLabel,
  onOpenNewMenu,
  onClearSelection,
  onDownload,
  onCopy,
  onMove,
  onRename,
  onShare,
  onGetDirectLink,
  onDelete,
  onTriggerSearch,
  onRefresh,
}: FileHeaderProps) {
  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      const res = await migrateDiskFilesApi();
      if (res.code === 200 && res.data) {
        const { dirs, files, skipped } = res.data;
        addToast({
          title: "扫描完成",
          description: `新增 ${dirs} 个目录、${files} 个文件记录${skipped > 0 ? `，跳过 ${skipped} 个已有记录` : ""}`,
          color: "success",
        });
        onRefresh();
      }
    } catch {
      addToast({ title: "扫描失败", color: "danger" });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className={styles["file-heard-actions"]}>
      <div className={styles["primary-actions"]}>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <Button
            className={styles["new-btn"]}
            color="primary"
            startContent={<RiUpload2Line />}
            onPress={e => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              onOpenNewMenu(
                new MouseEvent("contextmenu", {
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.bottom,
                  bubbles: true,
                })
              );
            }}
          >
            新建
          </Button>
        </motion.div>
        <Tooltip content="搜索" placement="bottom" showArrow={false}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}>
            <Button
              isIconOnly
              className={styles["search-btn"]}
              variant="bordered"
              onPress={e => onTriggerSearch(e.target)}
              aria-label="搜索"
            >
              <RiSearch2Line />
            </Button>
          </motion.div>
        </Tooltip>
        <Tooltip content="扫描磁盘文件（补录旧文件到文件管理器）" placement="bottom" showArrow={false}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}>
            <Button
              isIconOnly
              className={styles["search-btn"]}
              variant="bordered"
              isLoading={isMigrating}
              onPress={handleMigrate}
              aria-label="扫描磁盘"
            >
              <RiRefreshLine />
            </Button>
          </motion.div>
        </Tooltip>
      </div>

      <AnimatePresence mode="wait">
        {hasSelection ? (
          <motion.div
            key="selection-toolbar"
            className={styles["selection-toolbar"]}
            initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 20, filter: "blur(4px)" }}
            transition={springTransition}
          >
            <div className={styles["action-group"]}>
              <Tooltip content="取消选择" placement="bottom" showArrow={false}>
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onClearSelection}>
                    <RiCloseLine />
                  </Button>
                </motion.div>
              </Tooltip>
              <span className={styles["selection-count"]}>{selectionCountLabel}</span>
            </div>

            <div className={styles["action-group"]}>
              <Tooltip content="下载" placement="bottom" showArrow={false}>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                  <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onDownload}>
                    <RiDownload2Line />
                  </Button>
                </motion.div>
              </Tooltip>
              <Tooltip content="复制" placement="bottom" showArrow={false}>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                  <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onCopy}>
                    <RiFileCopyLine />
                  </Button>
                </motion.div>
              </Tooltip>
              <Tooltip content="移动" placement="bottom" showArrow={false}>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                  <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onMove}>
                    <RiFolderTransferLine />
                  </Button>
                </motion.div>
              </Tooltip>
              {isSingleSelection ? (
                <>
                  <Tooltip content="重命名" placement="bottom" showArrow={false}>
                    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                      <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onRename}>
                        <RiEdit2Line />
                      </Button>
                    </motion.div>
                  </Tooltip>
                  <Tooltip content="分享（PRO 功能）" placement="bottom" showArrow={false}>
                    <motion.div className={styles["pro-action"]} whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        isIconOnly
                        aria-label="分享（PRO 功能）"
                        className={styles["action-btn"]}
                        variant="light"
                        onPress={onShare}
                      >
                        <RiShareLine />
                        <span className={styles["pro-badge"]}>PRO</span>
                      </Button>
                    </motion.div>
                  </Tooltip>
                  <Tooltip content="获取直链" placement="bottom" showArrow={false}>
                    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                      <Button isIconOnly className={styles["action-btn"]} variant="light" onPress={onGetDirectLink}>
                        <RiLinkM />
                      </Button>
                    </motion.div>
                  </Tooltip>
                </>
              ) : null}
              <Tooltip content="删除" placement="bottom" showArrow={false}>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    isIconOnly
                    className={`${styles["action-btn"]} ${styles["danger-btn"]}`}
                    variant="light"
                    onPress={onDelete}
                  >
                    <RiDeleteBin6Line />
                  </Button>
                </motion.div>
              </Tooltip>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
