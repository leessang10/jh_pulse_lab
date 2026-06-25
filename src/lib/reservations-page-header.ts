type ReservationsPageHeader = {
  eyebrow: string | null;
  lookupFormDescription: string | null;
  lookupFormTitle: string | null;
  showCreateReservationLink: boolean;
  title: string;
};

export const RESERVATIONS_PAGE_HEADER: ReservationsPageHeader = {
  eyebrow: null,
  lookupFormDescription: "예약할 때 입력한 이름과 비밀번호를 입력해 주세요.",
  lookupFormTitle: "예약 정보 입력",
  showCreateReservationLink: false,
  title: "예약조회",
};
