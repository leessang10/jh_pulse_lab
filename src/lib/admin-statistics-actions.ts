"use server";

import { z } from "zod";
import {
  adminReservationStatisticsSchema,
  statisticsUnits,
  type AdminReservationStatistics,
  type StatisticsUnit,
} from "@/lib/admin-statistics";
import { todayKoreaValue } from "@/lib/korea-date";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminStatisticsActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ADMIN_REQUIRED_MESSAGE = "관리자 로그인이 필요합니다.";
const INVALID_INPUT_MESSAGE = "통계 조회 조건이 올바르지 않습니다.";
const GENERIC_MESSAGE = "예약 통계를 불러오지 못했습니다. 다시 시도해 주세요.";

const statisticsRequestSchema = z.object({
  referenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  unit: z.enum(statisticsUnits),
});

function parseRequest(input: {
  referenceMonth: string;
  unit: StatisticsUnit;
}) {
  const parsed = statisticsRequestSchema.safeParse(input);
  if (!parsed.success || parsed.data.referenceMonth > todayKoreaValue().slice(0, 7)) {
    return null;
  }
  return parsed.data;
}

export async function getAdminReservationStatistics(input: {
  referenceMonth: string;
  unit: StatisticsUnit;
}): Promise<AdminStatisticsActionResult<AdminReservationStatistics>> {
  const request = parseRequest(input);
  if (!request) return { ok: false, error: INVALID_INPUT_MESSAGE };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, error: ADMIN_REQUIRED_MESSAGE };

    const { data, error } = await supabase.rpc("get_admin_reservation_statistics", {
      p_reference_month: `${request.referenceMonth}-01`,
      p_unit: request.unit,
    });
    if (error) throw error;

    const statistics = adminReservationStatisticsSchema.safeParse(data);
    if (!statistics.success) throw statistics.error;

    return { ok: true, data: statistics.data };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
  }
}
