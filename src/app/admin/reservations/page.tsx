import AdminReservationsPage from "../admin-reservations-page";
import AdminShell from "../admin-shell";

export default function AdminReservationsRoute() {
  return (
    <AdminShell>
      <AdminReservationsPage />
    </AdminShell>
  );
}
