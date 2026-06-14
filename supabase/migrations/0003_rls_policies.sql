-- Active RLS et autorise les utilisateurs authentifiés à tout faire
-- sur les tables de l'application (lecture/écriture complète).

alter table sales enable row level security;
alter table stock enable row level security;
alter table web_stats enable row level security;
alter table google_business enable row level security;

create policy "authenticated_full_access_sales" on sales
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access_stock" on stock
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access_web_stats" on web_stats
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access_google_business" on google_business
  for all to authenticated using (true) with check (true);
