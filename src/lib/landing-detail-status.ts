export const LANDING_DETAIL_CENTER_LINES = ["오늘", "예약 현황"] as const;

export function getLandingDetailScheduleAriaLabel(roomName: string) {
  return `${roomName} 오늘 예약 현황을 시계처럼 보여주는 표`;
}
