insert into web_stats (month, visits, pages_per_visit, avg_duration)
values ('Juin 2026', 410, 6.4, '1:45')
on conflict do nothing;

insert into google_business (month, profile_views, calls, directions, reviews, avg_rating)
values ('Juin 2026', 1280, 47, 63, 18, 4.6)
on conflict do nothing;
