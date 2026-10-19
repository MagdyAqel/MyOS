-- Run once in your own Supabase SQL Editor. No service_role key belongs in MyOS.
create table if not exists public.myos_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (octet_length(data::text) <= 3000000),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.myos_snapshots enable row level security;
alter table public.myos_snapshots force row level security;
revoke all on public.myos_snapshots from anon;
grant select, insert, update on public.myos_snapshots to authenticated;
drop policy if exists myos_select on public.myos_snapshots;
create policy myos_select on public.myos_snapshots for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists myos_insert on public.myos_snapshots;
create policy myos_insert on public.myos_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists myos_update on public.myos_snapshots;
create policy myos_update on public.myos_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.save_myos_snapshot(expected_revision integer, payload jsonb)
returns table(new_revision integer, saved_at timestamptz)
language plpgsql security invoker set search_path = public as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if payload->>'version' is distinct from '1' or jsonb_typeof(payload->'datasets') is distinct from 'object' then
    raise exception 'Invalid snapshot' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    return query insert into public.myos_snapshots(user_id, data) values(owner_id, payload)
      on conflict (user_id) do nothing returning revision, updated_at;
  else
    return query update public.myos_snapshots set data = payload, revision = revision + 1, updated_at = now()
      where user_id = owner_id and revision = expected_revision returning revision, updated_at;
  end if;
  if not found then raise exception 'Snapshot conflict; inspect latest version' using errcode = 'PT409'; end if;
end;
$$;
revoke all on function public.save_myos_snapshot(integer, jsonb) from public, anon;
grant execute on function public.save_myos_snapshot(integer, jsonb) to authenticated;
