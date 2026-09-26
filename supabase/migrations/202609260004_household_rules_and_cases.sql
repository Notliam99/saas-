delete from public.punishments
where is_default
  and household_id is null
  and punishment_tier > 5;

create table public.household_hidden_default_punishments (
  household_id uuid not null references public.households (id) on delete cascade,
  punishment_id uuid not null references public.punishments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, punishment_id)
);

alter table public.household_hidden_default_punishments enable row level security;

create policy "Members can read hidden default punishments"
  on public.household_hidden_default_punishments for select to authenticated
  using (public.is_household_member(household_id));

create policy "Members can hide default punishments"
  on public.household_hidden_default_punishments for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.punishments p
      where p.id = punishment_id
        and p.is_default
        and p.household_id is null
    )
  );

create policy "Members can restore default punishments"
  on public.household_hidden_default_punishments for delete to authenticated
  using (public.is_household_member(household_id));

grant select, insert, delete on public.household_hidden_default_punishments to authenticated;
