import AdminShell from "../admin-shell";
import AdminStatisticsPage from "./admin-statistics-page";

export default function AdminStatisticsRoute() {
  return (
    <AdminShell>
      <AdminStatisticsPage />
    </AdminShell>
  );
}
