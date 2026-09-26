begin;

create table if not exists public.case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  evidence_side text not null check (evidence_side in ('prosecution', 'defense')),
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists case_evidence_case_id_idx
  on public.case_evidence (case_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-evidence',
  'case-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.case_evidence enable row level security;

grant select, insert, delete on public.case_evidence to authenticated;

drop policy if exists "Household members can read case evidence records" on public.case_evidence;
create policy "Household members can read case evidence records"
  on public.case_evidence for select to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_evidence.case_id
        and public.is_household_member(c.household_id)
    )
  );

drop policy if exists "Case parties can add their own photo evidence" on public.case_evidence;
create policy "Case parties can add their own photo evidence"
  on public.case_evidence for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.cases c
      where c.id = case_evidence.case_id
        and c.status = 'awaiting_defense'
        and public.is_household_member(c.household_id)
        and (
          (case_evidence.evidence_side = 'prosecution' and c.reporter_id = (select auth.uid()))
          or (case_evidence.evidence_side = 'defense' and c.accused_id = (select auth.uid()))
        )
    )
  );

drop policy if exists "Case parties can remove their own unsubmitted photo evidence" on public.case_evidence;
create policy "Case parties can remove their own unsubmitted photo evidence"
  on public.case_evidence for delete to authenticated
  using (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.cases c
      where c.id = case_evidence.case_id
        and c.status = 'awaiting_defense'
        and (
          (case_evidence.evidence_side = 'prosecution' and c.reporter_id = (select auth.uid()))
          or (case_evidence.evidence_side = 'defense' and c.accused_id = (select auth.uid()))
        )
    )
  );

drop policy if exists "Household members can view case evidence photos" on storage.objects;
create policy "Household members can view case evidence photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'case-evidence'
    and array_length(storage.foldername(name), 1) = 4
    and exists (
      select 1 from public.cases c
      where c.id::text = (storage.foldername(name))[2]
        and c.household_id::text = (storage.foldername(name))[1]
        and public.is_household_member(c.household_id)
    )
  );

drop policy if exists "Case parties can upload case evidence photos" on storage.objects;
create policy "Case parties can upload case evidence photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'case-evidence'
    and array_length(storage.foldername(name), 1) = 4
    and (storage.foldername(name))[4] = (select auth.uid())::text
    and exists (
      select 1 from public.cases c
      where c.id::text = (storage.foldername(name))[2]
        and c.household_id::text = (storage.foldername(name))[1]
        and c.status = 'awaiting_defense'
        and public.is_household_member(c.household_id)
        and (
          ((storage.foldername(name))[3] = 'prosecution' and c.reporter_id = (select auth.uid()))
          or ((storage.foldername(name))[3] = 'defense' and c.accused_id = (select auth.uid()))
        )
    )
  );

drop policy if exists "Case parties can delete their own unsubmitted photos" on storage.objects;
create policy "Case parties can delete their own unsubmitted photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'case-evidence'
    and array_length(storage.foldername(name), 1) = 4
    and (storage.foldername(name))[4] = (select auth.uid())::text
    and exists (
      select 1 from public.cases c
      where c.id::text = (storage.foldername(name))[2]
        and c.household_id::text = (storage.foldername(name))[1]
        and c.status = 'awaiting_defense'
        and (
          ((storage.foldername(name))[3] = 'prosecution' and c.reporter_id = (select auth.uid()))
          or ((storage.foldername(name))[3] = 'defense' and c.accused_id = (select auth.uid()))
        )
    )
  );

commit;
