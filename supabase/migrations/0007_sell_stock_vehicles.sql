-- Vente de 6 véhicules actuellement en stock, réparties sur des dates réalistes (pas de vente le dimanche)
-- Répartition canaux globale (26 ventes) : 3 Site web, 3 La Centrale, 16 LeBonCoin, 4 Autre

-- Peugeot 307 (en stock depuis le 28 mai) -> vendue le 9 juin (mardi), 12 jours en stock
insert into sales (model, price, buy_price, date, km, channel, "daysInStock")
select 'Peugeot 307 1.6 HDi 90', 5400, buy_price, '2026-06-09', km, 'LeBonCoin', 12
from stock where model = 'Peugeot 307 1.6 HDi 90';
delete from stock where model = 'Peugeot 307 1.6 HDi 90';

-- Renault Mégane III (en stock depuis le 2 juin) -> vendue le 10 juin (mercredi), 8 jours en stock
insert into sales (model, price, buy_price, date, km, channel, "daysInStock")
select 'Renault Mégane III 1.5 dCi 85', 5900, buy_price, '2026-06-10', km, 'Site web', 8
from stock where model = 'Renault Mégane III 1.5 dCi 85';
delete from stock where model = 'Renault Mégane III 1.5 dCi 85';

-- Fiat 500 (en stock depuis le 1er juin) -> vendue le 11 juin (jeudi), 10 jours en stock
insert into sales (model, price, buy_price, date, km, channel, "daysInStock")
select 'Fiat 500 1.3 MultiJet 75', 6200, buy_price, '2026-06-11', km, 'LeBonCoin', 10
from stock where model = 'Fiat 500 1.3 MultiJet 75';
delete from stock where model = 'Fiat 500 1.3 MultiJet 75';

-- Citroën Jumpy (en stock depuis le 24 mai) -> vendu le 12 juin (vendredi), 19 jours en stock
insert into sales (model, price, buy_price, date, km, channel, "daysInStock")
select 'Citroën Jumpy 1.6 HDi 95', 11200, buy_price, '2026-06-12', km, 'La Centrale', 19
from stock where model = 'Citroën Jumpy 1.6 HDi 95';
delete from stock where model = 'Citroën Jumpy 1.6 HDi 95';

-- Ford Transit Connect (en stock depuis le 30 mai) -> vendu le 13 juin (samedi), 14 jours en stock
insert into sales (model, price, buy_price, date, km, channel, "daysInStock")
select 'Ford Transit Connect 1.8 TDci 75', 7400, buy_price, '2026-06-13', km, 'LeBonCoin', 14
from stock where model = 'Ford Transit Connect 1.8 TDci 75';
delete from stock where model = 'Ford Transit Connect 1.8 TDci 75';

-- BMW Série 3 (en stock depuis le 18 mai) -> vendue le 13 juin (samedi), 26 jours en stock
insert into sales (model, price, buy_price, date, km, channel, "daysInStock")
select 'BMW Série 3 2.0 d 150', 10900, buy_price, '2026-06-13', km, 'Autre', 26
from stock where model = 'BMW Série 3 2.0 d 150';
delete from stock where model = 'BMW Série 3 2.0 d 150';
