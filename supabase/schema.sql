-- Jobsite app database setup.
-- Paste this whole file into Supabase: SQL Editor > New query > Run.

-- 1. Who is allowed in. Only emails listed here can see or change data,
--    even if someone manages to create an account.
create table if not exists public.members (
  email text primary key,
  name text,
  created_at timestamptz default now()
);

-- Add yourself and your managers here (lowercase emails):
-- insert into public.members (email, name) values ('you@example.com', 'Aaron');

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 2. Jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  client_email text,
  client_phone text,
  address text,
  status text not null default 'active' check (status in ('active', 'on_hold', 'done')),
  notes text,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

-- 3. Tasks (to-dos)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  title text not null,
  notes text,
  due_date date,
  assigned_to text,
  done boolean not null default false,
  done_at timestamptz,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

-- 4. Invoices sent to clients
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  invoice_number text,
  client_name text,
  amount numeric(12,2) not null default 0,
  issued_date date,
  due_date date,
  -- to_bill = still needs to be sent, unpaid = sent and waiting on payment, paid = collected
  status text not null default 'to_bill' check (status in ('to_bill', 'unpaid', 'paid')),
  paid_date date,
  amount_paid numeric(12,2),
  file_path text,
  notes text,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

-- 5. Project folders: submittals and photo documentation
create table if not exists public.submittals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  title text not null,
  description text,
  submitted_on date default current_date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'approved_as_noted', 'revise', 'rejected')),
  file_path text,
  file_name text,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  path text not null,
  taken_on date not null default current_date,
  description text,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

-- 5b. Materials ordered per project
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  item text not null,
  quantity text,
  supplier text,
  ordered_on date default current_date,
  cost numeric(12,2),
  delivered boolean not null default false,
  notes text,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

-- 5c. Supporting documents per project
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  title text not null,
  description text,
  doc_date date default current_date,
  file_path text,
  file_name text,
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now()
);

-- 6. Access rules: members can do everything, nobody else can do anything.
do $$
declare t text;
begin
  foreach t in array array['jobs','tasks','invoices','submittals','photos','materials','documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "members only" on public.%I', t);
    execute format('create policy "members only" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

alter table public.members enable row level security;
drop policy if exists "members can read members" on public.members;
create policy "members can read members" on public.members
  for select to authenticated using (public.is_member());

-- Let signed-in users reach the tables (row rules above still decide what they see).
-- Newer Supabase projects don't grant this automatically.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_member() to authenticated;

-- 7. Private file storage for invoice PDFs and site photos
insert into storage.buckets (id, name, public) values ('files', 'files', false)
on conflict (id) do nothing;

drop policy if exists "members read files" on storage.objects;
drop policy if exists "members add files" on storage.objects;
drop policy if exists "members delete files" on storage.objects;
create policy "members read files" on storage.objects
  for select to authenticated using (bucket_id = 'files' and public.is_member());
create policy "members add files" on storage.objects
  for insert to authenticated with check (bucket_id = 'files' and public.is_member());
create policy "members delete files" on storage.objects
  for delete to authenticated using (bucket_id = 'files' and public.is_member());
