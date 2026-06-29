"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

const IMAGE_ICON_PATTERN = /^(https?:\/\/|\/|data:image\/|blob:)/i;

export function isCreativityImageUrl(icon?: string): boolean {
  const value = icon?.trim();
  return !!value && IMAGE_ICON_PATTERN.test(value);
}

export function isCreativityIconifyIcon(icon?: string): boolean {
  const value = icon?.trim();
  return !!value && value.includes(":") && !isCreativityImageUrl(value);
}

interface CreativityIconProps {
  icon?: string;
  alt?: string;
  title?: string;
  size?: number;
  className?: string;
  imageClassName?: string;
  iconifyClassName?: string;
  fallback?: ReactNode;
}

export function CreativityIcon({
  icon,
  alt = "",
  title,
  size = 20,
  className,
  imageClassName,
  iconifyClassName,
  fallback = null,
}: CreativityIconProps) {
  const value = icon?.trim();
  if (!value) return fallback;

  if (isCreativityImageUrl(value)) {
    return (
      <Image
        src={value}
        alt={alt}
        title={title}
        width={size}
        height={size}
        className={cn("object-contain", className, imageClassName)}
        unoptimized
      />
    );
  }

  if (isCreativityIconifyIcon(value)) {
    return (
      <Icon
        icon={value}
        width={size}
        height={size}
        className={cn(className, iconifyClassName)}
        aria-hidden={alt ? undefined : true}
      />
    );
  }

  return fallback;
}
