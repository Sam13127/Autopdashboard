-- Table stock : véhicules achetés et pas encore vendus
create table if not exists stock (
  id uuid default gen_random_uuid() primary key,
  model text not null,
  buy_price numeric,
  km integer,
  year integer,
  entry_date date not null default current_date,
  created_at timestamp default now()
);

-- Activer Supabase Realtime sur la table stock
alter publication supabase_realtime add table stock;
