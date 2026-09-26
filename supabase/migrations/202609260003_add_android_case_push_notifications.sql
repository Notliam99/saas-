begin;

create table public.push_devices (
  expo_push_token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index push_devices_user_id_idx on public.push_devices (user_id);

create table public.push_notification_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  event_type text not null check (event_type in ('case_filed', 'defense_submitted', 'verdict')),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (case_id, event_type, recipient_id)
);

create index push_notification_events_recipient_pending_idx
  on public.push_notification_events (recipient_id, next_attempt_at)
  where status = 'pending';

alter table public.push_devices enable row level security;
alter table public.push_notification_events enable row level security;

revoke all on public.push_devices from anon, authenticated;
revoke all on public.push_notification_events from anon, authenticated;
grant all on public.push_devices, public.push_notification_events to service_role;

create or replace function public.queue_case_filed_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_notification_events (case_id, event_type, actor_id, recipient_id)
  values (new.id, 'case_filed', new.reporter_id, new.accused_id)
  on conflict (case_id, event_type, recipient_id) do nothing;

  return new;
end;
$$;

create trigger on_case_filed_queue_push
  after insert on public.cases
  for each row execute procedure public.queue_case_filed_push();

create or replace function public.queue_case_defense_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_reporter_id uuid;
begin
  select c.reporter_id into case_reporter_id
  from public.cases c
  where c.id = new.case_id;

  if case_reporter_id is not null then
    insert into public.push_notification_events (case_id, event_type, actor_id, recipient_id)
    values (new.case_id, 'defense_submitted', new.defendant_id, case_reporter_id)
    on conflict (case_id, event_type, recipient_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_case_defense_queue_push
  after insert on public.case_defenses
  for each row execute procedure public.queue_case_defense_push();

create or replace function public.queue_case_verdict_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'ready_for_judgment'
    and new.status in ('guilty', 'not_guilty', 'mistrial') then
    insert into public.push_notification_events (case_id, event_type, actor_id, recipient_id)
    values
      (new.id, 'verdict', new.reporter_id, new.reporter_id),
      (new.id, 'verdict', new.reporter_id, new.accused_id)
    on conflict (case_id, event_type, recipient_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_case_verdict_queue_push
  after update of status on public.cases
  for each row execute procedure public.queue_case_verdict_push();

revoke all on function public.queue_case_filed_push() from public;
revoke all on function public.queue_case_defense_push() from public;
revoke all on function public.queue_case_verdict_push() from public;

commit;
