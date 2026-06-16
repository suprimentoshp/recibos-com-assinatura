create table if not exists app_state (
  id integer primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists receipt_events (
  client_event_id text primary key,
  event_type text not null,
  receipt_id text,
  receipt_number text,
  user_login text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists receipt_events_receipt_idx on receipt_events (receipt_id);
create index if not exists receipt_events_created_idx on receipt_events (created_at desc);
