"use client";
/* eslint-disable @next/next/no-img-element */

import { Icon } from "@iconify/react";
import type { PublicAlbumItem } from "@/types/album";
import { buildAlbumImageWithParam } from "../_utils/album-image-src";

interface AlbumWaterfallItemProps {
  item: PublicAlbumItem;
  index: number;
  enableComment?: boolean;
  eager?: boolean;
  onPreview: (index: number) => void;
  onComment: () => void;
}

function resolveImageDimensions(item: PublicAlbumItem): { width?: number; height?: number } {
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return { width: item.width, height: item.height };
  }

  if (item.widthAndHeight) {
    const [width, height] = item.widthAndHeight.split(/[xX*]/).map(Number);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  return {};
}

export function AlbumWaterfallItem({ item, index, eager = false, onPreview }: AlbumWaterfallItemProps) {
  const dimensions = resolveImageDimensions(item);

  return (
    <div className="album-waterfall-item" onClick={() => onPreview(index)}>
      <img
        className="waterfall-image"
        src={buildAlbumImageWithParam(item.imageUrl, item.thumbParam)}
        alt={item.title || "相册图片"}
        width={dimensions.width}
        height={dimensions.height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
        referrerPolicy="no-referrer"
      />
      {item.location?.trim() ? (
        <span className="waterfall-location-badge">
          <Icon icon="ri:map-pin-2-fill" />
          {item.location.trim()}
        </span>
      ) : null}
    </div>
  );
}
