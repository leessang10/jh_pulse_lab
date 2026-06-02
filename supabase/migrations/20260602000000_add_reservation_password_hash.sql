alter table reservations
add column if not exists password_hash text;

create index if not exists reservations_lookup_idx
on reservations (name, phone, password_hash, date, start_minutes);
