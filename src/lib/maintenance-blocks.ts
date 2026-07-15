import {
  ACTIVE_ROOM_IDS,
  DAY_END_MINUTES,
  SLOT_MINUTES,
  type ReservationTimeBlock,
} from "./reservations";

export type MaintenanceBlock = {
  id: string;
  date: string;
  roomId: string;
  startMinutes: number;
  endMinutes: number;
  createdBy: string;
  createdAt: string;
};

export type MaintenanceBlockDraft = Pick<
  MaintenanceBlock,
  "date" | "roomId" | "startMinutes" | "endMinutes"
>;

export type ReservationScheduleBlock = ReservationTimeBlock & { kind: "reservation" };
export type MaintenanceScheduleBlock = MaintenanceBlock & { kind: "maintenance" };
export type ScheduleBlock = ReservationScheduleBlock | MaintenanceScheduleBlock;

export type MaintenanceValidationCurrentTime = {
  date: string;
  minutes: number;
};

export const MAINTENANCE_ENDED_MESSAGE = "이미 종료된 시간에는 점검을 등록할 수 없습니다.";

export function validateMaintenanceBlockDraft(
  draft: MaintenanceBlockDraft,
  currentTime: MaintenanceValidationCurrentTime,
) {
  const errors: string[] = [];

  if (!draft.date) errors.push("날짜를 선택해 주세요.");
  if (!ACTIVE_ROOM_IDS.includes(draft.roomId)) errors.push("연습실을 선택해 주세요.");
  if (draft.startMinutes % SLOT_MINUTES !== 0 || draft.endMinutes % SLOT_MINUTES !== 0) {
    errors.push("시작 시간과 종료 시간은 30분 단위여야 합니다.");
  }
  if (draft.startMinutes < 0 || draft.endMinutes > DAY_END_MINUTES) {
    errors.push("점검 시간은 00:00부터 24:00 사이여야 합니다.");
  }
  if (draft.endMinutes <= draft.startMinutes) errors.push("종료 시간은 시작 시간보다 늦어야 합니다.");
  if (draft.date < currentTime.date || (draft.date === currentTime.date && draft.endMinutes <= currentTime.minutes)) {
    errors.push(MAINTENANCE_ENDED_MESSAGE);
  }

  return errors;
}

export function toReservationScheduleBlock(reservation: ReservationTimeBlock): ReservationScheduleBlock {
  return { kind: "reservation", ...reservation };
}

export function getScheduleBlockLabel(block: ScheduleBlock) {
  return block.kind === "maintenance" ? "점검" : block.name.trim() || "예약자";
}

export function isScheduleBlockActive(block: ScheduleBlock) {
  return block.kind === "maintenance" || block.status !== "cancelled";
}
