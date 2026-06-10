delete from reservations;

drop index if exists reservations_lookup_idx;

alter table reservations
drop column if exists phone;

alter table reservations
alter column password_hash set not null;

create index if not exists reservations_lookup_idx
on reservations (name, password_hash, date desc, start_minutes);
