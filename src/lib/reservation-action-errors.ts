export const CONFLICT_MESSAGE = "이미 예약된 시간입니다.";
export const GENERIC_MESSAGE = "예약 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
export const SCHEMA_SYNC_MESSAGE = "예약 DB 설정이 아직 반영되지 않았습니다. 관리자에게 문의해 주세요.";

function isObjectWithMessage(error: unknown): error is { code?: unknown; message?: unknown } {
  return typeof error === "object" && error !== null && "message" in error;
}

export function toReservationActionErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes("conflicts")) return CONFLICT_MESSAGE;
  if (
    isObjectWithMessage(error) &&
    error.code === "42703" &&
    typeof error.message === "string" &&
    error.message.includes("password_hash")
  ) {
    return SCHEMA_SYNC_MESSAGE;
  }

  return GENERIC_MESSAGE;
}
