-- Daily Alpha: tabelas e regras de segurança
-- Cola tudo isto no Supabase em SQL Editor > New query e carrega em Run.

-- 1. Portfólio de cada pessoa (transações, favoritos, alertas)
create table if not exists public.portfolios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.portfolios enable row level security;

drop policy if exists "Ver o próprio portfólio" on public.portfolios;
drop policy if exists "Criar o próprio portfólio" on public.portfolios;
drop policy if exists "Alterar o próprio portfólio" on public.portfolios;
drop policy if exists "Apagar o próprio portfólio" on public.portfolios;
create policy "Ver o próprio portfólio" on public.portfolios for select to authenticated using ((select auth.uid()) = user_id);
create policy "Criar o próprio portfólio" on public.portfolios for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Alterar o próprio portfólio" on public.portfolios for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Apagar o próprio portfólio" on public.portfolios for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.portfolios to authenticated;

-- 2. Contador diário de explicações com IA (só o servidor mexe aqui)
create table if not exists public.ai_usage (
  user_id uuid references auth.users(id) on delete cascade,
  day date not null default current_date,
  n int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

create or replace function public.bump_ai_usage(uid uuid, lim int)
returns boolean language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.ai_usage(user_id, day, n) values (uid, current_date, 1)
  on conflict (user_id, day) do update set n = public.ai_usage.n + 1
  returning n into c;
  return c <= lim;
end $$;
revoke all on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid, int) to service_role;
grant select, insert, update, delete on public.ai_usage to service_role;
