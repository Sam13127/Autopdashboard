import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const CHANNELS = ['LeBonCoin', 'La Centrale', 'Site web', 'Autre'];

export default function Dashboard() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Auth state
  const [user, setUser] = useState(null);

  const [form, setForm] = useState({
    model: '', price: '', date: new Date().toISOString().split('T')[0], km: '', channel: 'LeBonCoin', daysInStock: ''
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

    // Setup Supabase Realtime
    const subscription = supabase
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

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Logical KPIs
  const kpis = useMemo(() => {
    if (sales.length === 0) return { totalVehicles: 0, totalCA: 0, avgPrice: 0, avgDays: 0, bestChannel: '-', rotationRate: 0 };
    
    const totalCA = sales.reduce((acc, s) => acc + (parseFloat(s.price) || 0), 0);
    const avgPrice = totalCA / sales.length;
    
    const days = sales.filter(s => s.daysInStock != null && s.daysInStock !== '').map(s => parseInt(s.daysInStock));
    const avgDays = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
    
    const channelCount = {};
    sales.forEach(s => { channelCount[s.channel] = (channelCount[s.channel] || 0) + 1; });
    const bestChannel = Object.entries(channelCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    
    // Rotation rate: logic fix (times per year instead of times per month is more standard, but let's stick to times per month if they want)
    const rotationRate = avgDays > 0 ? Math.round((30 / avgDays) * 10) / 10 : 0;
    
    return { totalVehicles: sales.length, totalCA, avgPrice, avgDays, bestChannel, rotationRate };
  }, [sales]);

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
        date: form.date,
        km: form.km ? parseFloat(form.km) : null,
        channel: form.channel,
        daysInStock: form.daysInStock ? parseInt(form.daysInStock) : null,
      }]);
      
      if (error) throw error;
      
      setForm({ model: '', price: '', date: new Date().toISOString().split('T')[0], km: '', channel: 'LeBonCoin', daysInStock: '' });
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fmtPrice = (v) => `${(parseFloat(v) || 0).toLocaleString('fr-FR')} €`;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex">
      {/* SIDEBAR */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col p-6 fixed h-full z-10">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-accent/20">
            A
          </div>
          <span className="text-xl font-bold tracking-tight">Auto'P</span>
        </div>

        <nav className="flex-1 space-y-2">
          <a href="#dashboard" className="flex items-center gap-3 px-4 py-3 bg-accent/10 text-accent rounded-xl font-medium transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Dashboard
          </a>
          <a href="#ventes" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-xl font-medium transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>
            Ventes
          </a>
        </nav>

        <div className="mt-auto space-y-4">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 rounded-xl text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
            Supabase Connecté
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Déconnexion
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="ml-64 flex-1 p-8 md:p-10 max-w-7xl">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 text-white">Vue d'ensemble</h1>
            <p className="text-gray-400">Suivi des ventes en temps réel — Auto'P Automobile</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-accent to-blue-700 p-6 rounded-2xl border border-accent/20 shadow-lg shadow-accent/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            <div className="text-blue-100 text-sm font-medium mb-1">Chiffre d'affaires</div>
            <div className="text-3xl font-bold text-white mb-1">{fmtPrice(kpis.totalCA)}</div>
            <div className="text-blue-200 text-xs">{kpis.totalVehicles} véhicule(s) vendu(s)</div>
          </div>
          
          <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-sm">
            <div className="text-gray-400 text-sm font-medium mb-1">Prix moyen</div>
            <div className="text-2xl font-bold text-white mb-1">{fmtPrice(kpis.avgPrice)}</div>
            <div className="text-gray-500 text-xs">par véhicule</div>
          </div>

          <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-sm">
            <div className="text-gray-400 text-sm font-medium mb-1">Délai moyen</div>
            <div className="text-2xl font-bold text-white mb-1">{kpis.avgDays} <span className="text-base font-normal text-gray-500">jours</span></div>
            <div className={`text-xs mt-1 font-medium ${kpis.avgDays > 0 && kpis.avgDays < 45 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {kpis.avgDays === 0 ? '-' : kpis.avgDays < 45 ? '✓ Rapide (< 45j)' : '⚠ À surveiller (> 45j)'}
            </div>
          </div>

          <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-sm">
            <div className="text-gray-400 text-sm font-medium mb-1">Rotation du stock</div>
            <div className="text-2xl font-bold text-white mb-1">{kpis.rotationRate} <span className="text-base font-normal text-gray-500">/ mois</span></div>
            <div className="text-gray-500 text-xs">Top canal: <span className="text-gray-300 font-medium">{kpis.bestChannel}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* CHARTS */}
          <div className="lg:col-span-2 bg-gray-900 p-6 rounded-2xl border border-gray-800">
            <h2 className="text-lg font-bold text-white mb-6">Performances par canal</h2>
            <div className="space-y-4">
              {CHANNELS.map(channel => {
                const count = channelStats.stats[channel] || 0;
                const pct = channelStats.max > 0 ? (count / channelStats.max) * 100 : 0;
                return (
                  <div key={channel} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-gray-400 font-medium">{channel}</span>
                    <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="w-8 text-right font-bold text-white">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SYSTEM STATUS */}
          <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex flex-col">
            <h2 className="text-lg font-bold text-white mb-6">Système</h2>
            <div className="flex-1 flex flex-col justify-center space-y-6">
              <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <span className="text-gray-400">Enregistrements</span>
                <strong className="text-white">{sales.length}</strong>
              </div>
              <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <span className="text-gray-400">Dernière synchro</span>
                <strong className="text-white">{new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Utilisateur</span>
                <strong className="text-white text-sm truncate max-w-[120px]" title={user?.email}>{user?.email || '-'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div id="ventes" className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Historique des ventes</h2>
          </div>
          
          {loading ? (
             <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
               <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full"></div>
               Chargement des données...
             </div>
          ) : sales.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="mb-4">Aucune vente enregistrée pour le moment.</p>
              <button onClick={() => setShowForm(true)} className="text-accent hover:text-accent-light font-medium transition-colors">
                + Ajouter la première vente
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-400 text-sm">
                    <th className="p-4 font-medium">Modèle</th>
                    <th className="p-4 font-medium">Prix de vente</th>
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium">Kilométrage</th>
                    <th className="p-4 font-medium">Canal</th>
                    <th className="p-4 font-medium">Jours en stock</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-sm">
                  {sales.map(sale => (
                    <tr key={sale.id} className="hover:bg-gray-800/20 transition-colors">
                      <td className="p-4 font-medium text-white">{sale.model}</td>
                      <td className="p-4 text-emerald-400 font-medium">{fmtPrice(sale.price)}</td>
                      <td className="p-4 text-gray-400">{sale.date}</td>
                      <td className="p-4 text-gray-400">{sale.km ? `${parseInt(sale.km).toLocaleString('fr-FR')} km` : '-'}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-gray-800 text-gray-300 rounded-lg text-xs font-medium border border-gray-700">
                          {sale.channel || '-'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">{sale.daysInStock ? `${sale.daysInStock}j` : '-'}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleDelete(sale.id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
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
      </main>

      {/* MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white">Nouvelle vente</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Modèle du véhicule *</label>
                <input name="model" value={form.model} onChange={handleChange} required
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-accent outline-none" placeholder="ex: Renault Clio 5" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Prix (€) *</label>
                  <input name="price" type="number" value={form.price} onChange={handleChange} required
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-accent outline-none" placeholder="6000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Date *</label>
                  <input name="date" type="date" value={form.date} onChange={handleChange} required
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-accent outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Kilométrage</label>
                  <input name="km" type="number" value={form.km} onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-accent outline-none" placeholder="85000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Jours en stock</label>
                  <input name="daysInStock" type="number" value={form.daysInStock} onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-accent outline-none" placeholder="32" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Canal de vente</label>
                <select name="channel" value={form.channel} onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-accent outline-none">
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors">
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
