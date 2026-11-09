-- Rulează acest SQL în Supabase > SQL Editor.
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  make_model text not null,
  plate text not null,
  year integer,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  doc_type text not null check (doc_type in ('itp','rca','rovinieta')),
  expiry_date date not null,
  issued_date date,
  cost numeric(10,2),
  notes text,
  created_at timestamptz not null default now()
);
alter table public.vehicles enable row level security;
alter table public.vehicle_documents enable row level security;
create policy "Users manage own vehicles" on public.vehicles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own documents" on public.vehicle_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists vehicles_user_id_idx on public.vehicles(user_id);
create index if not exists docs_user_id_idx on public.vehicle_documents(user_id);
create index if not exists docs_vehicle_id_idx on public.vehicle_documents(vehicle_id);