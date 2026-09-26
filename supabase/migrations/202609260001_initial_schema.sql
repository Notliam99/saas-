create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 120),
  schedule text not null default '',
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.punishments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  punishment_tier smallint not null check (punishment_tier between 1 and 10),
  title text not null check (length(trim(title)) between 1 and 120),
  details text not null default '',
  is_default boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint default_punishments_are_global check (not is_default or household_id is null)
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id),
  accused_id uuid not null references public.profiles (id),
  charge text not null check (length(trim(charge)) between 1 and 120),
  allegation text not null check (length(trim(allegation)) between 1 and 2000),
  prosecutor_statement text not null check (length(trim(prosecutor_statement)) between 1 and 4000),
  evidence_notes text not null default '',
  status text not null default 'awaiting_defense'
    check (status in ('awaiting_defense', 'ready_for_judgment', 'guilty', 'not_guilty', 'mistrial')),
  verdict_summary text,
  punishment_id uuid references public.punishments (id) on delete set null,
  punishment_details text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint cases_reporter_cannot_be_accused check (reporter_id <> accused_id)
);

create table public.case_defenses (
  case_id uuid primary key references public.cases (id) on delete cascade,
  defendant_id uuid not null references public.profiles (id),
  response text not null check (length(trim(response)) between 1 and 4000),
  evidence_notes text not null default '',
  submitted_at timestamptz not null default now()
);

create index household_members_user_id_idx on public.household_members (user_id);
create index chores_household_active_idx on public.chores (household_id, is_active);
create index cases_household_created_idx on public.cases (household_id, created_at desc);
create index cases_accused_status_idx on public.cases (accused_id, status);
create unique index cases_one_open_case_per_accused_idx
  on public.cases (household_id, accused_id)
  where status in ('awaiting_defense', 'ready_for_judgment');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, 'Flatmate'), '@', 1)
  );

  insert into public.profiles (id, display_name)
  values (new.id, requested_name);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_household_admin(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
      and hm.role in ('owner', 'admin')
  );
$$;

create or replace function public.are_housemates(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = target_user_id
  );
$$;

create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before creating a household';
  end if;

  insert into public.households (name, created_by)
  values (trim(household_name), auth.uid())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'owner');

  return new_household_id;
end;
$$;

create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before joining a household';
  end if;

  select id into target_household_id
  from public.households
  where invite_code = upper(trim(code));

  if target_household_id is null then
    raise exception 'Household invite code not found';
  end if;

  insert into public.household_members (household_id, user_id)
  values (target_household_id, auth.uid())
  on conflict (household_id, user_id) do nothing;

  return target_household_id;
end;
$$;

create or replace function public.mark_case_ready_after_defense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cases
  set status = 'ready_for_judgment'
  where id = new.case_id
    and accused_id = new.defendant_id
    and status = 'awaiting_defense';

  return new;
end;
$$;

create trigger on_case_defense_submitted
  after insert on public.case_defenses
  for each row execute procedure public.mark_case_ready_after_defense();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.chores enable row level security;
alter table public.punishments enable row level security;
alter table public.cases enable row level security;
alter table public.case_defenses enable row level security;

create policy "Users can read their profile and housemates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.are_housemates(id));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members can read their households"
  on public.households for select to authenticated
  using (public.is_household_member(id));

create policy "Admins can update their households"
  on public.households for update to authenticated
  using (public.is_household_admin(id))
  with check (public.is_household_admin(id));

create policy "Members can read household membership"
  on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

create policy "Admins can add household members"
  on public.household_members for insert to authenticated
  with check (public.is_household_admin(household_id));

create policy "Admins can remove household members"
  on public.household_members for delete to authenticated
  using (public.is_household_admin(household_id));

create policy "Members can read chores"
  on public.chores for select to authenticated
  using (public.is_household_member(household_id));

create policy "Members can create chores"
  on public.chores for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = (select auth.uid()));

create policy "Members can update chores"
  on public.chores for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Admins can delete chores"
  on public.chores for delete to authenticated
  using (public.is_household_admin(household_id));

create policy "Members can read default and household punishments"
  on public.punishments for select to authenticated
  using (household_id is null or public.is_household_member(household_id));

create policy "Members can add household punishments"
  on public.punishments for insert to authenticated
  with check (
    household_id is not null
    and public.is_household_member(household_id)
    and created_by = (select auth.uid())
    and not is_default
  );

create policy "Creators and admins can update household punishments"
  on public.punishments for update to authenticated
  using (
    household_id is not null
    and public.is_household_member(household_id)
    and (created_by = (select auth.uid()) or public.is_household_admin(household_id))
  )
  with check (
    household_id is not null
    and not is_default
    and public.is_household_member(household_id)
  );

create policy "Creators and admins can delete household punishments"
  on public.punishments for delete to authenticated
  using (
    household_id is not null
    and public.is_household_member(household_id)
    and (created_by = (select auth.uid()) or public.is_household_admin(household_id))
  );

create policy "Members can read household cases"
  on public.cases for select to authenticated
  using (public.is_household_member(household_id));

create policy "Household members can file cases"
  on public.cases for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and reporter_id <> accused_id
    and status = 'awaiting_defense'
    and public.is_household_member(household_id)
    and exists (
      select 1 from public.household_members accused_member
      where accused_member.household_id = cases.household_id
        and accused_member.user_id = cases.accused_id
    )
  );

create policy "Household members can read case defenses"
  on public.case_defenses for select to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_defenses.case_id
        and public.is_household_member(c.household_id)
    )
  );

create policy "Only the accused can submit a defense"
  on public.case_defenses for insert to authenticated
  with check (
    defendant_id = (select auth.uid())
    and exists (
      select 1 from public.cases c
      where c.id = case_defenses.case_id
        and c.accused_id = (select auth.uid())
        and c.status = 'awaiting_defense'
    )
  );

create policy "Only the accused can revise a defense before judgment"
  on public.case_defenses for update to authenticated
  using (
    defendant_id = (select auth.uid())
    and exists (
      select 1 from public.cases c
      where c.id = case_defenses.case_id
        and c.status = 'awaiting_defense'
    )
  )
  with check (
    defendant_id = (select auth.uid())
    and exists (
      select 1 from public.cases c
      where c.id = case_defenses.case_id
        and c.accused_id = (select auth.uid())
        and c.status = 'awaiting_defense'
    )
  );

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_admin(uuid) from public;
revoke all on function public.are_housemates(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_admin(uuid) to authenticated;
grant execute on function public.are_housemates(uuid) to authenticated;

revoke all on function public.create_household(text) from public;
revoke all on function public.join_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

grant select, update on public.profiles to authenticated;
grant select, update on public.households to authenticated;
grant select, insert, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.chores to authenticated;
grant select, insert, update, delete on public.punishments to authenticated;
grant select, insert on public.cases to authenticated;
grant select, insert, update on public.case_defenses to authenticated;

insert into public.punishments (punishment_tier, title, details, is_default)
values
  (1, 'Dish duty', 'Wash and put away dishes after one shared meal.', true),
  (2, 'Bins and recycling', 'Take out the bins and return them after collection.', true),
  (3, 'One extra chore', 'Complete one additional chore from the household rota.', true),
  (4, 'Cover a chore for a week', 'Take over one flatmate’s agreed chore for seven days.', true),
  (5, 'Cook for the flat', 'Plan and cook one shared meal for the household.', true),
  (6, 'Common-area reset', 'Deep clean one agreed shared area.', true),
  (7, 'Three-day chore run', 'Complete one extra, reasonable chore each day for three days.', true),
  (8, 'Two rota turns', 'Take the next two turns of one shared household chore.', true),
  (9, 'Weekly shared-space care', 'Keep one agreed common area tidy for the coming week.', true),
  (10, 'Household service week', 'Take one extra rota chore each day for a week, within agreed limits.', true);
