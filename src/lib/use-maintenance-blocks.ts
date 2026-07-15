"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  createAdminMaintenanceBlock,
  deleteAdminMaintenanceBlock,
  listAdminMaintenanceBlocks,
  type MaintenanceActionResult,
} from "@/lib/maintenance-actions";
import type { MaintenanceBlock, MaintenanceBlockDraft } from "@/lib/maintenance-blocks";

export function useMaintenanceBlocks(date: string) {
  const [blocks, setBlocks] = useState<MaintenanceBlock[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async (): Promise<MaintenanceActionResult<MaintenanceBlock[]>> => {
    setIsReady(false);
    setError(null);
    const result = await listAdminMaintenanceBlocks(date);

    if (result.ok) {
      setBlocks(result.data);
    } else {
      setBlocks([]);
      setError(result.error);
    }
    setIsReady(true);
    return result;
  }, [date]);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  return useMemo(
    () => ({
      blocks,
      isReady,
      isPending,
      error,
      refresh,
      async createBlock(draft: MaintenanceBlockDraft) {
        const result = await createAdminMaintenanceBlock(draft);
        if (result.ok) await refresh();
        return result;
      },
      async removeBlock(id: string) {
        const result = await deleteAdminMaintenanceBlock(id);
        if (result.ok) await refresh();
        return result;
      },
    }),
    [blocks, error, isPending, isReady, refresh],
  );
}
