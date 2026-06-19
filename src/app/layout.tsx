import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "JH 펄스랩 예약",
  description: "JH 펄스랩 드럼 연습실 예약 시스템",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
