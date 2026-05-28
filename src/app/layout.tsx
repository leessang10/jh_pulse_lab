import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "JH 펄스랩 예약",
  description: "JH 펄스랩 드럼 강의실 예약 시스템",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={cn("font-sans", geist.variable)}>
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
