import type { MaintenanceBlock } from "@/lib/maintenance-blocks";

export type MaintenanceRow = {
  id: string;
  date: string;
  room_id: string;
  start_minutes: number;
  end_minutes: number;
  created_by: string;
  created_at: string;
};

export function mapMaintenanceRowToBlock(row: MaintenanceRow): MaintenanceBlock {
  return {
    id: row.id,
    date: row.date,
    roomId: row.room_id,
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
