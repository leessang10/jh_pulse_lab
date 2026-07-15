"use server";

import { revalidatePath } from "next/cache";
import { getCurrentKoreaBookingTime } from "@/lib/korea-date";
import {
  validateMaintenanceBlockDraft,
  type MaintenanceBlock,
  type MaintenanceBlockDraft,
} from "@/lib/maintenance-blocks";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapMaintenanceRowToBlock,
  type MaintenanceRow,
} from "@/lib/supabase/maintenance-mappers";

export type MaintenanceActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type CreateMaintenanceResult = {
  block: MaintenanceBlock;
  cancelledCount: number;
};

const MAINTENANCE_SELECT =
  "id,date,room_id,start_minutes,end_minutes,created_by,created_at";
const ADMIN_REQUIRED_MESSAGE = "관리자 로그인이 필요합니다.";
const GENERIC_MESSAGE = "점검 시간을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

function revalidateMaintenancePaths() {
  revalidatePath("/");
  revalidatePath("/reservation");
  revalidatePath("/reservations");
  revalidatePath("/admin/timetables");
  revalidatePath("/admin/reservations");
  revalidatePath("/v2");
}

function toMaintenanceErrorMessage(error: unknown) {
  if (typeof error !== "object" || error === null) return GENERIC_MESSAGE;

  const message = "message" in error && typeof error.message === "string"
    ? error.message
    : "";

  if (message.includes("conflicts with existing maintenance")) {
    return "이미 등록된 점검 시간과 겹칩니다.";
  }
  if (message.includes("already ended")) {
    return "이미 종료된 시간에는 점검을 등록할 수 없습니다.";
  }
  if (message.includes("authentication") || message.includes("permission denied")) {
    return ADMIN_REQUIRED_MESSAGE;
  }
  return GENERIC_MESSAGE;
}

async function getAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, isAuthenticated: Boolean(data.user) };
}

export async function listAdminMaintenanceBlocks(
  date: string,
): Promise<MaintenanceActionResult<MaintenanceBlock[]>> {
  try {
    const { supabase, isAuthenticated } = await getAuthenticatedClient();
    if (!isAuthenticated) return { ok: false, error: ADMIN_REQUIRED_MESSAGE };

    const { data, error } = await supabase
      .from("maintenance_blocks")
      .select(MAINTENANCE_SELECT)
      .eq("date", date)
      .order("start_minutes", { ascending: true });
    if (error) throw error;

    return {
      ok: true,
      data: ((data ?? []) as MaintenanceRow[]).map(mapMaintenanceRowToBlock),
    };
  } catch (error) {
    return { ok: false, error: toMaintenanceErrorMessage(error) };
  }
}

export async function createAdminMaintenanceBlock(
  draft: MaintenanceBlockDraft,
): Promise<MaintenanceActionResult<CreateMaintenanceResult>> {
  const errors = validateMaintenanceBlockDraft(draft, getCurrentKoreaBookingTime());
  if (errors.length > 0) return { ok: false, error: errors[0] };

  try {
    const { supabase, isAuthenticated } = await getAuthenticatedClient();
    if (!isAuthenticated) return { ok: false, error: ADMIN_REQUIRED_MESSAGE };

    const { data, error } = await supabase.rpc("create_maintenance_block", {
      p_date: draft.date,
      p_room_id: draft.roomId,
      p_start_minutes: draft.startMinutes,
      p_end_minutes: draft.endMinutes,
    });
    if (error) throw error;

    const result = data?.[0];
    if (!result) throw new Error("maintenance RPC returned no result");

    const { data: blockRow, error: blockError } = await supabase
      .from("maintenance_blocks")
      .select(MAINTENANCE_SELECT)
      .eq("id", result.maintenance_id)
      .single();
    if (blockError) throw blockError;

    revalidateMaintenancePaths();
    return {
      ok: true,
      data: {
        block: mapMaintenanceRowToBlock(blockRow as MaintenanceRow),
        cancelledCount: Number(result.cancelled_count),
      },
    };
  } catch (error) {
    return { ok: false, error: toMaintenanceErrorMessage(error) };
  }
}

export async function deleteAdminMaintenanceBlock(
  id: string,
): Promise<MaintenanceActionResult<null>> {
  try {
    const { supabase, isAuthenticated } = await getAuthenticatedClient();
    if (!isAuthenticated) return { ok: false, error: ADMIN_REQUIRED_MESSAGE };

    const { error } = await supabase.from("maintenance_blocks").delete().eq("id", id);
    if (error) throw error;

    revalidateMaintenancePaths();
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: toMaintenanceErrorMessage(error) };
  }
}
