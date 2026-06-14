-- Table ventes (créer seulement si elle n'existe pas déjà)
create table if not exists sales (
  id uuid default gen_random_uuid() primary key,
  model text not null,
  price numeric not null,
  buy_price numeric,
  date date not null,
  km integer,
  channel text,
  days_in_stock integer,
  created_at timestamp default now()
);

-- Si la table "sales" existe déjà avec une colonne "daysInStock" (camelCase),
-- on s'assure que la colonne "buy_price" est présente pour la marge brute.
alter table sales add column if not exists buy_price numeric;

-- Table stats WordPress
create table if not exists web_stats (
  id uuid default gen_random_uuid() primary key,
  month text not null,
  visits integer,
  pages_per_visit numeric,
  avg_duration text,
  updated_at timestamp default now()
);

-- Table Google Business
create table if not exists google_business (
  id uuid default gen_random_uuid() primary key,
  month text not null,
  profile_views integer,
  calls integer,
  directions integer,
  reviews integer,
  avg_rating numeric,
  updated_at timestamp default now()
);

-- Activer Supabase Realtime sur la table sales
alter publication supabase_realtime add table sales;

-- Données initiales (optionnel) pour la visibilité web de mai 2026
insert into web_stats (month, visits, pages_per_visit, avg_duration)
values ('Mai 2026', 300, 6, '1:30')
on conflict do nothing;
