"use client";

import { useEffect, useState, type ReactNode } from "react";

interface IdleMountProps {
  children: ReactNode;
  timeout?: number;
}

export function IdleMount({ children, timeout = 1600 }: IdleMountProps) {
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    if (shouldMount) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const mount = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      setShouldMount(true);
    };

    timerId = setTimeout(mount, timeout);

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(mount, { timeout });
    }

    return () => {
      if (timerId) clearTimeout(timerId);
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [shouldMount, timeout]);

  if (!shouldMount) return null;
  return <>{children}</>;
}