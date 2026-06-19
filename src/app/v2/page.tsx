import { formatKoreaDate, todayKoreaValue } from "@/lib/korea-date";
import { V2ReservationBoard } from "./v2-reservation-board";

export default function V2Page() {
  const today = todayKoreaValue();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-1 border-b border-border pb-4">
          <p className="text-base font-semibold text-primary">{formatKoreaDate(today)}</p>
          <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">드럼 연습실 예약</h1>
        </header>
        <V2ReservationBoard today={today} todayLabel={formatKoreaDate(today)} />
      </div>
    </main>
  );
}
