type ReservationsPageHeader = {
  eyebrow: string | null;
  lookupFormTitle: string | null;
  showCreateReservationLink: boolean;
  title: string;
};

export const RESERVATIONS_PAGE_HEADER: ReservationsPageHeader = {
  eyebrow: null,
  lookupFormTitle: null,
  showCreateReservationLink: false,
  title: "예약할 때 입력한 정보를 기재해 주세요",
};
