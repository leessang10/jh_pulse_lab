"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createReservation,
  type Reservation,
  type ReservationDraft,
  type ReservationStatus,
} from "./reservations";

const STORAGE_KEY = "jh-pulse-lab-reservations";

function readReservations() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Reservation[]) : [];
  } catch {
    return [];
  }
}

export function useReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setReservations(readReservations());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
  }, [isReady, reservations]);

  return useMemo(
    () => ({
      reservations,
      isReady,
      addReservation(draft: ReservationDraft) {
        const reservation = createReservation(draft);
        setReservations((current) => [reservation, ...current]);
        return reservation;
      },
      updateReservationStatus(id: string, status: ReservationStatus) {
        setReservations((current) =>
          current.map((reservation) => (reservation.id === id ? { ...reservation, status } : reservation)),
        );
      },
      removeReservation(id: string) {
        setReservations((current) => current.filter((reservation) => reservation.id !== id));
      },
    }),
    [isReady, reservations],
  );
}
