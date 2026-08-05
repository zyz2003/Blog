"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Input,
  Button,
  Spinner,
  addToast,
} from "@heroui/react";
import { Image as ImageIcon, Search, Check } from "lucide-react";
import { imageLibraryApi, type ImageLibraryItem } from "@/lib/api/image-library";
import { cn } from "@/lib/utils";

interface ImagePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export function ImagePickerDialog({
  isOpen,
  onClose,
  onSelect,
}: ImagePickerDialogProps) {
  const [images, setImages] = useState<ImageLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadImages = useCallback(
    async (resetPage?: boolean) => {
      const currentPage = resetPage ? 1 : page;
      setLoading(true);
      try {
        const res = await imageLibraryApi.list({
          page: currentPage,
          keyword: resetPage ? keyword : keyword,
        });
        if (res.code === 200 && res.data) {
          if (resetPage || currentPage === 1) {
            setImages(res.data.list);
          } else {
            setImages((prev) => [...prev, ...res.data!.list]);
          }
          setTotal(res.data.total);
        }
      } catch {
        addToast({ title: "加载图片失败", color: "danger" });
      } finally {
        setLoading(false);
      }
    },
    [page, keyword]
  );

  useEffect(() => {
    if (isOpen) {
      setImages([]);
      setKeyword("");
      setPage(1);
      setSelectedId(null);
      loadImages(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSearch = () => {
    setPage(1);
    loadImages(true);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadImages(false);
  };

  const handleConfirm = () => {
    const selected = images.find((img) => img.id === selectedId);
    if (selected) {
      onSelect(selected.displayUrl);
      onClose();
    }
  };

  const hasMore = images.length < total;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      scrollBehavior="inside"
      classNames={{
        wrapper: "!z-[99999]",
        backdrop: "!z-[99999] !bg-black/60 !opacity-100",
        base: "!bg-card",
      }}
    >
      <ModalContent>
        <ModalHeader>从文件库选择图片</ModalHeader>
        <ModalBody className="pb-6">
          {/* 搜索栏 */}
          <div className="flex gap-2 mb-4 sticky top-0 bg-background z-10 pb-2">
            <Input
              placeholder="搜索图片名称..."
              value={keyword}
              onValueChange={setKeyword}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
              size="sm"
              isClearable
              onClear={() => {
                setKeyword("");
                setPage(1);
                loadImages(true);
              }}
            />
            <Button color="primary" size="sm" onPress={handleSearch}>
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {/* 图片网格 */}
          {loading && images.length === 0 ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mb-2" />
              <p>暂无图片</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    className={cn(
                      "relative group rounded-xl overflow-hidden border-2 transition-all",
                      selectedId === img.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border/60 hover:border-primary/40"
                    )}
                    onClick={() => setSelectedId(img.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.thumbUrl}
                      alt={img.name}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                    {selectedId === img.id && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-5 h-5 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate">
                      {img.name}
                    </div>
                  </button>
                ))}
              </div>

              {/* 加载更多 */}
              {hasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="flat"
                    size="sm"
                    isLoading={loading}
                    onPress={handleLoadMore}
                  >
                    加载更多
                  </Button>
                </div>
              )}

              {/* 确认按钮 */}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="flat" onPress={onClose}>
                  取消
                </Button>
                <Button
                  color="primary"
                  isDisabled={!selectedId}
                  onPress={handleConfirm}
                >
                  确认选择
                </Button>
              </div>
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
