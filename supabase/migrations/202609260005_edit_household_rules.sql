create table public.household_default_punishment_overrides (
  household_id uuid not null references public.households (id) on delete cascade,
  punishment_id uuid not null references public.punishments (id) on delete cascade,
  punishment_tier smallint not null check (punishment_tier between 1 and 10),
  title text not null check (length(trim(title)) between 1 and 120),
  details text not null default '',
  created_at timestamptz not null default now(),
  primary key (household_id, punishment_id)
);

alter table public.household_default_punishment_overrides enable row level security;

create policy "Members can read default punishment overrides"
  on public.household_default_punishment_overrides for select to authenticated
  using (public.is_household_member(household_id));

create policy "Members can add default punishment overrides"
  on public.household_default_punishment_overrides for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.punishments p
      where p.id = punishment_id
        and p.is_default
        and p.household_id is null
    )
  );

create policy "Members can edit default punishment overrides"
  on public.household_default_punishment_overrides for update to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.punishments p
      where p.id = punishment_id
        and p.is_default
        and p.household_id is null
    )
  );

create policy "Members can remove default punishment overrides"
  on public.household_default_punishment_overrides for delete to authenticated
  using (public.is_household_member(household_id));

grant select, insert, update, delete on public.household_default_punishment_overrides to authenticated;

create policy "Members can edit household rules"
  on public.punishments for update to authenticated
  using (household_id is not null and public.is_household_member(household_id))
  with check (
    household_id is not null
    and not is_default
    and public.is_household_member(household_id)
  );
