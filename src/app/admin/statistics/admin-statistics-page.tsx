"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function AdminStatisticsPage() {
  return (
    <main className="min-h-screen w-full px-5 py-6 lg:px-8">
      <header className="flex items-start gap-3 border-b pb-5">
        <SidebarTrigger className="mt-1 md:hidden" />
        <div>
          <Badge variant="outline" className="border-border bg-background text-muted-foreground">
            예약 통계
          </Badge>
          <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">예약 통계</h1>
          <p className="mt-2 text-sm text-muted-foreground">예약 통계를 준비하고 있습니다.</p>
        </div>
      </header>

      <Card className="mt-6 border bg-card">
        <CardHeader>
          <CardTitle>통계 데이터를 불러오는 중입니다.</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </main>
  );
}
