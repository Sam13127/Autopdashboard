import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import Chatbot from '../components/Chatbot';
import Sidebar from '../components/Sidebar';
import WebStats from '../components/WebStats';
import GoogleBusiness from '../components/GoogleBusiness';

const CHANNELS = ['LeBonCoin', 'La Centrale', 'Site web', 'Autre'];
const STOCK_ALERT_DAYS = 45;
const MONTHLY_TARGET = 40;

export default function Dashboard() {
  const [sales, setSales] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auth state
  const [user, setUser] = useState(null);

  const [form, setForm] = useState({
    model: '', price: '', buyPrice: '', date: new Date().toISOString().split('T')[0], km: '', channel: 'LeBonCoin', daysInStock: ''
  });

  // Fetch initial data and setup realtime subscription
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();

    const fetchSales = async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) console.error('Erreur fetch:', error);
      else setSales(data || []);
      setLoading(false);
    };

    fetchSales();

    const fetchStock = async () => {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .order('entry_date', { ascending: true });

      if (error) console.error('Erreur fetch stock:', error);
      else setStock(data || []);
    };

    fetchStock();

    // Setup Supabase Realtime
    const salesSubscription = supabase
      .channel('public:sales')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSales((current) => [payload.new, ...current]);
        } else if (payload.eventType === 'DELETE') {
          setSales((current) => current.filter((sale) => sale.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setSales((current) => current.map((sale) => sale.id === payload.new.id ? payload.new : sale));
        }
      })
      .subscribe();

    const stockSubscription = supabase
      .channel('public:stock')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setStock((current) => [...current, payload.new].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date)));
        } else if (payload.eventType === 'DELETE') {
          setStock((current) => current.filter((v) => v.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setStock((current) => current.map((v) => v.id === payload.new.id ? payload.new : v));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(salesSubscription);
      supabase.removeChannel(stockSubscription);
    };
  }, []);

  // Logical KPIs
  const kpis = useMemo(() => {
    if (sales.length === 0) {
      return {
        totalVehicles: 0, totalCA: 0, avgPrice: 0, avgDays: 0, bestChannel: '-',
        rotationRate: 0, avgMargin: 0, monthSales: 0,
      };
    }

    const totalCA = sales.reduce((acc, s) => acc + (parseFloat(s.price) || 0), 0);
    const avgPrice = totalCA / sales.length;

    const days = sales.filter(s => s.daysInStock != null && s.daysInStock !== '').map(s => parseInt(s.daysInStock));
    const avgDays = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;

    const channelCount = {};
    sales.forEach(s => { channelCount[s.channel] = (channelCount[s.channel] || 0) + 1; });
    const bestChannel = Object.entries(channelCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    // Rotation du stock : nb ventes / nb jours de la période × 30
    const dates = sales.map(s => new Date(s.date)).filter(d => !isNaN(d.getTime()));
    let periodDays = 30;
    if (dates.length > 1) {
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      periodDays = Math.max(1, Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)));
    }
    const rotationRate = Math.round((sales.length / periodDays) * 30 * 10) / 10;

    // Marge brute moyenne
    const margins = sales
      .filter(s => s.buy_price != null && s.buy_price !== '')
      .map(s => (parseFloat(s.price) || 0) - (parseFloat(s.buy_price) || 0));
    const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;

    // Ventes du mois en cours (pour la progression vers l'objectif)
    const now = new Date();
    const monthSales = sales.filter(s => {
      const d = new Date(s.date);
      return !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return { totalVehicles: sales.length, totalCA, avgPrice, avgDays, bestChannel, rotationRate, avgMargin, monthSales };
  }, [sales]);

  const stockKpis = useMemo(() => {
    const now = new Date();
    const stockAlertCount = stock.filter(v => {
      const entry = new Date(v.entry_date);
      if (isNaN(entry.getTime())) return false;
      const days = Math.round((now - entry) / (1000 * 60 * 60 * 24));
      return days > STOCK_ALERT_DAYS;
    }).length;
    return { stockCount: stock.length, stockAlertCount };
  }, [stock]);

  const channelStats = useMemo(() => {
    const stats = {};
    CHANNELS.forEach(c => stats[c] = 0);
    sales.forEach(s => { if (s.channel && stats[s.channel] !== undefined) stats[s.channel] += 1; });
    const max = Math.max(...Object.values(stats), 1);
    return { stats, max };
  }, [sales]);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.model || !form.price || !form.date) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from('sales').insert([{
        model: form.model,
        price: parseFloat(form.price),
        buy_price: form.buyPrice ? parseFloat(form.buyPrice) : null,
        date: form.date,
        km: form.km ? parseFloat(form.km) : null,
        channel: form.channel,
        daysInStock: form.daysInStock ? parseInt(form.daysInStock) : null,
      }]);

      if (error) throw error;

      setForm({ model: '', price: '', buyPrice: '', date: new Date().toISOString().split('T')[0], km: '', channel: 'LeBonCoin', daysInStock: '' });
      setShowForm(false);
    } catch (err) {
      alert('Erreur lors de l\'ajout: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Confirmer la suppression ?')) return;
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) alert('Erreur lors de la suppression: ' + error.message);
  };

  const handleDeleteStock = async (id) => {
    if (!window.confirm('Confirmer la suppression ?')) return;
    const { error } = await supabase.from('stock').delete().eq('id', id);
    if (error) alert('Erreur lors de la suppression: ' + error.message);
  };

  const fmtPrice = (v) => `${Math.round(parseFloat(v) || 0).toLocaleString('fr-FR')} €`;
  const objectivePct = Math.min(100, Math.round((kpis.monthSales / MONTHLY_TARGET) * 100));

  return (
    <div className="min-h-screen bg-bg text-text-primary font-sans flex">
      {/* SIDEBAR */}
      <Sidebar />

      {/* MAIN CONTENT */}
      <main className="ml-64 flex-1 p-8 md:p-10 max-w-7xl">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 text-text-primary">Vue d'ensemble</h1>
            <p className="text-text-secondary">Suivi des ventes en temps réel — Auto'P Automobile</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-accent/20 transition-all active:scale-95"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
            Nouvelle Vente
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-gradient-to-br from-accent to-blue-700 p-6 rounded-2xl border border-accent/20 shadow-lg shadow-accent/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            <div className="text-blue-100 text-sm font-medium mb-1">Chiffre d'affaires</div>
            <div className="text-3xl font-bold text-white mb-1">{fmtPrice(kpis.totalCA)}</div>
            <div className="text-blue-200 text-xs">{kpis.totalVehicles} véhicule(s) vendu(s)</div>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-text-secondary text-sm font-medium mb-1">Prix moyen de vente</div>
            <div className="text-2xl font-bold text-text-primary mb-1">{fmtPrice(kpis.avgPrice)}</div>
            <div className="text-gray-400 text-xs">par véhicule</div>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-text-secondary text-sm font-medium mb-1">Délai moyen de vente</div>
            <div className="text-2xl font-bold text-text-primary mb-1">{kpis.avgDays} <span className="text-base font-normal text-gray-400">jours</span></div>
            <div className={`text-xs mt-1 font-medium ${kpis.avgDays > 0 && kpis.avgDays < STOCK_ALERT_DAYS ? 'text-good' : 'text-warn'}`}>
              {kpis.avgDays === 0 ? '-' : kpis.avgDays < STOCK_ALERT_DAYS ? '✓ Rapide (< 45j)' : '⚠ À surveiller (> 45j)'}
            </div>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-text-secondary text-sm font-medium mb-1">Rotation du stock</div>
            <div className="text-2xl font-bold text-text-primary mb-1">{kpis.rotationRate} <span className="text-base font-normal text-gray-400">/ mois</span></div>
            <div className="text-gray-400 text-xs">Top canal: <span className="text-text-primary font-medium">{kpis.bestChannel}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-text-secondary text-sm font-medium mb-1">Véhicules en stock</div>
            <div className="text-2xl font-bold text-text-primary mb-1">{stockKpis.stockCount}</div>
            <div className="text-gray-400 text-xs">actuellement disponibles</div>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-gray-200 shadow-sm relative">
            <div className="text-text-secondary text-sm font-medium mb-1 flex items-center gap-2">
              Stock {'>'} 45 jours
              {stockKpis.stockAlertCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-danger rounded-full text-xs font-bold">Alerte</span>
              )}
            </div>
            <div className={`text-2xl font-bold mb-1 ${stockKpis.stockAlertCount > 0 ? 'text-danger' : 'text-text-primary'}`}>{stockKpis.stockAlertCount}</div>
            <div className="text-gray-400 text-xs">véhicule(s) à surveiller</div>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-text-secondary text-sm font-medium mb-1">Marge brute moyenne</div>
            <div className="text-2xl font-bold text-text-primary mb-1">{fmtPrice(kpis.avgMargin)}</div>
            <div className="text-gray-400 text-xs">prix vente - prix achat</div>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-text-secondary text-sm font-medium mb-1">Objectif mensuel</div>
            <div className="text-2xl font-bold text-text-primary mb-2">{kpis.monthSales} <span className="text-base font-normal text-gray-400">/ {MONTHLY_TARGET}</span></div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${objectivePct}%` }}></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* CHARTS */}
          <div className="lg:col-span-2 bg-surface p-6 rounded-2xl border border-gray-200">
            <h2 className="text-lg font-bold text-text-primary mb-6">Performances par canal</h2>
            <div className="space-y-4">
              {CHANNELS.map(channel => {
                const count = channelStats.stats[channel] || 0;
                const pct = channelStats.max > 0 ? (count / channelStats.max) * 100 : 0;
                return (
                  <div key={channel} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-text-secondary font-medium">{channel}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="w-8 text-right font-bold text-text-primary">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SYSTEM STATUS */}
          <div className="bg-surface p-6 rounded-2xl border border-gray-200 flex flex-col">
            <h2 className="text-lg font-bold text-text-primary mb-6">Système</h2>
            <div className="flex-1 flex flex-col justify-center space-y-6">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <span className="text-text-secondary">Enregistrements</span>
                <strong className="text-text-primary">{sales.length}</strong>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <span className="text-text-secondary">Dernière synchro</span>
                <strong className="text-text-primary">{new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Utilisateur</span>
                <strong className="text-text-primary text-sm truncate max-w-[120px]" title={user?.email}>{user?.email || '-'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div id="ventes" className="bg-surface border border-gray-200 rounded-2xl overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-text-primary">Historique des ventes</h2>
          </div>

          {loading ? (
             <div className="p-12 text-center text-text-secondary flex flex-col items-center gap-3">
               <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full"></div>
               Chargement des données...
             </div>
          ) : sales.length === 0 ? (
            <div className="p-12 text-center text-text-secondary">
              <p className="mb-4">Aucune vente enregistrée pour le moment.</p>
              <button onClick={() => setShowForm(true)} className="text-accent hover:text-accent/80 font-medium transition-colors">
                + Ajouter la première vente
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-text-secondary text-sm">
                    <th className="p-4 font-medium">Modèle</th>
                    <th className="p-4 font-medium">Prix de vente</th>
                    <th className="p-4 font-medium">Prix d'achat</th>
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium">Kilométrage</th>
                    <th className="p-4 font-medium">Canal</th>
                    <th className="p-4 font-medium">Jours en stock</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {sales.map(sale => (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-medium text-text-primary">{sale.model}</td>
                      <td className="p-4 text-good font-medium">{fmtPrice(sale.price)}</td>
                      <td className="p-4 text-text-secondary">{sale.buy_price ? fmtPrice(sale.buy_price) : '-'}</td>
                      <td className="p-4 text-text-secondary">{sale.date}</td>
                      <td className="p-4 text-text-secondary">{sale.km ? `${parseInt(sale.km).toLocaleString('fr-FR')} km` : '-'}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-gray-100 text-text-secondary rounded-lg text-xs font-medium border border-gray-200">
                          {sale.channel || '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        {sale.daysInStock ? (
                          <span className={parseInt(sale.daysInStock) > STOCK_ALERT_DAYS ? 'px-2.5 py-1 bg-red-100 text-danger rounded-lg text-xs font-bold' : 'text-text-secondary'}>
                            {sale.daysInStock}j
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleDelete(sale.id)} className="p-2 text-gray-400 hover:text-danger hover:bg-red-50 rounded-lg transition-colors">
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* STOCK */}
        <div id="stock" className="bg-surface border border-gray-200 rounded-2xl overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-text-primary">Véhicules en stock</h2>
          </div>

          {stock.length === 0 ? (
            <div className="p-12 text-center text-text-secondary">
              Aucun véhicule en stock pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-text-secondary text-sm">
                    <th className="p-4 font-medium">Modèle</th>
                    <th className="p-4 font-medium">Année</th>
                    <th className="p-4 font-medium">Prix d'achat</th>
                    <th className="p-4 font-medium">Kilométrage</th>
                    <th className="p-4 font-medium">Entrée en stock</th>
                    <th className="p-4 font-medium">Jours en stock</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {stock.map(vehicle => {
                    const entry = new Date(vehicle.entry_date);
                    const days = !isNaN(entry.getTime()) ? Math.round((new Date() - entry) / (1000 * 60 * 60 * 24)) : null;
                    return (
                      <tr key={vehicle.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium text-text-primary">{vehicle.model}</td>
                        <td className="p-4 text-text-secondary">{vehicle.year || '-'}</td>
                        <td className="p-4 text-text-secondary">{vehicle.buy_price ? fmtPrice(vehicle.buy_price) : '-'}</td>
                        <td className="p-4 text-text-secondary">{vehicle.km ? `${parseInt(vehicle.km).toLocaleString('fr-FR')} km` : '-'}</td>
                        <td className="p-4 text-text-secondary">{vehicle.entry_date}</td>
                        <td className="p-4">
                          {days != null ? (
                            <span className={days > STOCK_ALERT_DAYS ? 'px-2.5 py-1 bg-red-100 text-danger rounded-lg text-xs font-bold' : 'text-text-secondary'}>
                              {days}j
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDeleteStock(vehicle.id)} className="p-2 text-gray-400 hover:text-danger hover:bg-red-50 rounded-lg transition-colors">
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* VISIBILITY SECTIONS */}
        <div id="visibilite" className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <WebStats />
          <GoogleBusiness />
        </div>
      </main>

      {/* CHATBOT */}
      <Chatbot />

      {/* MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-gray-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-text-primary">Nouvelle vente</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-text-primary transition-colors">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Modèle du véhicule *</label>
                <input name="model" value={form.model} onChange={handleChange} required
                  className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" placeholder="ex: Renault Clio 5" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Prix de vente (€) *</label>
                  <input name="price" type="number" value={form.price} onChange={handleChange} required
                    className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" placeholder="6000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Prix d'achat (€)</label>
                  <input name="buyPrice" type="number" value={form.buyPrice} onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" placeholder="4500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Date *</label>
                  <input name="date" type="date" value={form.date} onChange={handleChange} required
                    className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Kilométrage</label>
                  <input name="km" type="number" value={form.km} onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" placeholder="85000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Jours en stock</label>
                  <input name="daysInStock" type="number" value={form.daysInStock} onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" placeholder="32" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Canal de vente</label>
                  <select name="channel" value={form.channel} onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none">
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-text-primary font-medium rounded-xl transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium rounded-xl transition-colors disabled:opacity-50">
                  {submitting ? '...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
