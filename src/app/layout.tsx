import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JH 펄스랩 예약",
  description: "JH 펄스랩 드럼 강의실 예약 시스템",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
