import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc
} from 'firebase/firestore';
import './App.css';

// ─── REMPLACE ICI PAR TA CONFIG FIREBASE ───────────────────────
const firebaseConfig = {
  apiKey: "REMPLACE_PAR_TA_CLE",
  authDomain: "REMPLACE.firebaseapp.com",
  projectId: "REMPLACE_PAR_TON_PROJECT_ID",
  storageBucket: "REMPLACE.appspot.com",
  messagingSenderId: "REMPLACE",
  appId: "REMPLACE"
};
// ────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CHANNELS = ['LeBonCoin', 'La Centrale', 'Site web', 'Autre'];

export default function App() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    model: '', price: '', date: '', km: '', channel: 'LeBonCoin', daysInStock: ''
  });

  // Écoute Firestore en temps réel
  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSales(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // KPIs calculés
  const kpis = React.useMemo(() => {
    if (sales.length === 0) return { totalVehicles: 0, totalCA: 0, avgPrice: 0, avgDays: 0, bestChannel: '-', rotationRate: 0 };
    const totalCA = sales.reduce((a, s) => a + (parseFloat(s.price) || 0), 0);
    const avgPrice = totalCA / sales.length;
    const days = sales.filter(s => s.daysInStock).map(s => parseInt(s.daysInStock));
    const avgDays = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
    const channelCount = {};
    sales.forEach(s => { channelCount[s.channel] = (channelCount[s.channel] || 0) + 1; });
    const bestChannel = Object.entries(channelCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const rotationRate = avgDays > 0 ? Math.round((30 / avgDays) * 10) / 10 : 0;
    return { totalVehicles: sales.length, totalCA, avgPrice, avgDays, bestChannel, rotationRate };
  }, [sales]);

  // Ventes des 30 derniers jours par canal
  const channelStats = React.useMemo(() => {
    const stats = {};
    CHANNELS.forEach(c => stats[c] = 0);
    sales.forEach(s => { if (s.channel) stats[s.channel] = (stats[s.channel] || 0) + 1; });
    const max = Math.max(...Object.values(stats), 1);
    return { stats, max };
  }, [sales]);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.model || !form.price || !form.date) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'sales'), {
        ...form,
        price: parseFloat(form.price),
        daysInStock: form.daysInStock ? parseInt(form.daysInStock) : null,
        timestamp: new Date()
      });
      setForm({ model: '', price: '', date: '', km: '', channel: 'LeBonCoin', daysInStock: '' });
      setShowForm(false);
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette vente ?')) return;
    await deleteDoc(doc(db, 'sales', id));
  };

  const fmtPrice = v => `${(parseFloat(v) || 0).toLocaleString('fr-FR')} €`;

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-mark">A</span>
          <span className="logo-text">Auto'P</span>
        </div>
        <nav className="sidebar-nav">
          <a className="nav-item active" href="#dashboard">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Dashboard
          </a>
          <a className="nav-item" href="#ventes">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>
            Ventes
          </a>
        </nav>
        <div className="sidebar-badge">
          <span className="badge-dot"></span>
          Temps réel Firebase
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* TOP BAR */}
        <div className="topbar">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Suivi des ventes en temps réel — Auto'P Automobile, Aix-en-Provence</p>
          </div>
          <button className="btn-add" onClick={() => setShowForm(true)}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
            Ajouter une vente
          </button>
        </div>

        {/* KPI GRID */}
        <div className="kpi-grid">
          <div className="kpi-card kpi-primary">
            <div className="kpi-label">Chiffre d'affaires total</div>
            <div className="kpi-value">{fmtPrice(kpis.totalCA)}</div>
            <div className="kpi-sub">{kpis.totalVehicles} véhicule{kpis.totalVehicles > 1 ? 's' : ''} vendu{kpis.totalVehicles > 1 ? 's' : ''}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Prix moyen de vente</div>
            <div className="kpi-value">{fmtPrice(kpis.avgPrice)}</div>
            <div className="kpi-sub kpi-neutral">par véhicule</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Délai moyen de vente</div>
            <div className="kpi-value">{kpis.avgDays} <span className="kpi-unit">jours</span></div>
            <div className={`kpi-sub ${kpis.avgDays < 45 ? 'kpi-good' : 'kpi-warn'}`}>
              {kpis.avgDays < 45 ? '✓ Sous les 45j' : '⚠ Au-dessus des 45j'}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Rotation du stock</div>
            <div className="kpi-value">{kpis.rotationRate} <span className="kpi-unit">rot/mois</span></div>
            <div className="kpi-sub kpi-neutral">canal principal : {kpis.bestChannel}</div>
          </div>
        </div>

        {/* CHANNEL BARS + TABLE */}
        <div className="content-grid">
          {/* CHANNEL CHART */}
          <div className="card chart-card">
            <h2 className="card-title">Ventes par canal</h2>
            <div className="bar-chart">
              {CHANNELS.map(channel => {
                const count = channelStats.stats[channel] || 0;
                const pct = channelStats.max > 0 ? (count / channelStats.max) * 100 : 0;
                return (
                  <div key={channel} className="bar-row">
                    <span className="bar-label">{channel}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="bar-count">{count}</span>
                  </div>
                );
              })}
            </div>
            {sales.length === 0 && <p className="empty-chart">Aucune donnée</p>}
          </div>

          {/* LIVE INDICATOR */}
          <div className="card live-card">
            <h2 className="card-title">Statut</h2>
            <div className="live-indicator">
              <span className="live-dot"></span>
              <span>Connecté à Firebase</span>
            </div>
            <div className="stats-list">
              <div className="stat-row">
                <span>Total enregistrements</span>
                <strong>{sales.length}</strong>
              </div>
              <div className="stat-row">
                <span>Dernière mise à jour</span>
                <strong>{new Date().toLocaleTimeString('fr-FR')}</strong>
              </div>
              <div className="stat-row">
                <span>Source</span>
                <strong>Cloud Firestore</strong>
              </div>
            </div>
          </div>
        </div>

        {/* SALES TABLE */}
        <div className="card table-card" id="ventes">
          <h2 className="card-title">Historique des ventes</h2>
          {loading ? (
            <div className="loading">Connexion à Firebase...</div>
          ) : sales.length === 0 ? (
            <div className="empty-state">
              <p>Aucune vente enregistrée.</p>
              <button className="btn-add-inline" onClick={() => setShowForm(true)}>Ajouter la première vente →</button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Modèle</th>
                    <th>Prix de vente</th>
                    <th>Date</th>
                    <th>Kilométrage</th>
                    <th>Canal</th>
                    <th>Jours en stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <tr key={sale.id}>
                      <td className="td-model">{sale.model}</td>
                      <td className="td-price">{fmtPrice(sale.price)}</td>
                      <td>{sale.date}</td>
                      <td>{sale.km ? `${parseInt(sale.km).toLocaleString('fr-FR')} km` : '—'}</td>
                      <td><span className="channel-tag">{sale.channel}</span></td>
                      <td>{sale.daysInStock ? `${sale.daysInStock}j` : '—'}</td>
                      <td>
                        <button className="btn-delete" onClick={() => handleDelete(sale.id)} title="Supprimer">
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
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

      {/* MODAL FORM */}
      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Nouvelle vente</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Modèle du véhicule *</label>
                <input name="model" value={form.model} onChange={handleChange} placeholder="ex : Renault Clio 5, Peugeot 308…" required />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Prix de vente (€) *</label>
                  <input name="price" type="number" value={form.price} onChange={handleChange} placeholder="6000" required />
                </div>
                <div className="form-group">
                  <label>Date de vente *</label>
                  <input name="date" type="date" value={form.date} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Kilométrage</label>
                  <input name="km" type="number" value={form.km} onChange={handleChange} placeholder="85000" />
                </div>
                <div className="form-group">
                  <label>Jours en stock</label>
                  <input name="daysInStock" type="number" value={form.daysInStock} onChange={handleChange} placeholder="32" />
                </div>
              </div>
              <div className="form-group">
                <label>Canal de vente</label>
                <select name="channel" value={form.channel} onChange={handleChange}>
                  {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Annuler</button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? 'Enregistrement...' : 'Enregistrer la vente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
