-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Table: operators (Operadores)
create table operators (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert initial operators
insert into
    operators (name)
values ('Jesús Becerril'),
    ('Benjamín Sánchez'),
    ('Eduardo Cedillo');

-- 2. Table: units (Unidades)
create type unit_type as enum ('Madrina', 'Pipa', 'Contenedor');

create type unit_status as enum (
  'Vacia', 
  'Cargada', 
  'En Taller', 
  'Sin Operador', 
  'Transito Vacio', 
  'Transito Carga'
);

create table units (
  id uuid default uuid_generate_v4() primary key,
  economic_number text unique not null,
  type unit_type not null,
  status unit_status default 'Sin Operador',
  current_operator_id uuid references operators(id),
  last_status_update timestamp with time zone default timezone('utc'::text, now()),
  last_modified_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Table: assignments_history (Historial de Asignaciones y Cambios)
create table assignments_history (
  id uuid default uuid_generate_v4() primary key,
  unit_id uuid references units(id),
  previous_operator_id uuid references operators(id),
  new_operator_id uuid references operators(id),
  action_type text not null, -- 'Assignment', 'Status Change', 'Edit'
  modified_by text not null,
  details jsonb, -- Store extra details like previous status vs new status
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Table: expenses (Gastos - Optional, primarily for logging generated reports)
create table expenses (
  id uuid default uuid_generate_v4() primary key,
  operator_id uuid references operators(id),
  route text not null,
  total_amount numeric,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) - For rapid dev, we'll enable public access but you should secure this later
alter table operators enable row level security;

alter table units enable row level security;

alter table assignments_history enable row level security;

alter table expenses enable row level security;

-- Policies (Public Read/Write for now as per "RAPIDA" requirement, lock down in production)
create policy "Public Access Operators" on operators for all using (true);

create policy "Public Access Units" on units for all using (true);

create policy "Public Access History" on assignments_history for all using (true);

create policy "Public Access Expenses" on expenses for all using (true);