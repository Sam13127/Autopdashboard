import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CURRENT_MONTH = 'Mai 2026';

export default function WebStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ visits: '', pages_per_visit: '', avg_duration: '' });

  const fetchStats = async () => {
    const { data, error } = await supabase
      .from('web_stats')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) console.error('Erreur fetch web_stats:', error);

    if (data) {
      setStats(data);
      setForm({ visits: data.visits ?? '', pages_per_visit: data.pages_per_visit ?? '', avg_duration: data.avg_duration ?? '' });
    } else {
      const defaults = { month: CURRENT_MONTH, visits: 300, pages_per_visit: 6, avg_duration: '1:30' };
      setStats(defaults);
      setForm({ visits: defaults.visits, pages_per_visit: defaults.pages_per_visit, avg_duration: defaults.avg_duration });
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        month: stats?.month || CURRENT_MONTH,
        visits: form.visits ? parseInt(form.visits) : null,
        pages_per_visit: form.pages_per_visit ? parseFloat(form.pages_per_visit) : null,
        avg_duration: form.avg_duration || null,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (stats?.id) {
        ({ error } = await supabase.from('web_stats').update(payload).eq('id', stats.id));
      } else {
        ({ error } = await supabase.from('web_stats').insert([payload]));
      }
      if (error) throw error;

      await fetchStats();
      setEditing(false);
    } catch (err) {
      alert('Erreur lors de la sauvegarde : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-text-primary">Visibilité web</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-accent hover:text-accent/80 text-sm font-medium transition-colors">
            Modifier
          </button>
        )}
      </div>
      <span className="inline-block mb-4 px-2.5 py-1 bg-accent-light text-accent rounded-lg text-xs font-medium">
        Source : WordPress Stats — {stats?.month || CURRENT_MONTH}
      </span>

      {loading ? (
        <div className="text-text-secondary text-sm">Chargement...</div>
      ) : editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Visites mensuelles</label>
            <input type="number" value={form.visits} onChange={(e) => setForm(f => ({ ...f, visits: e.target.value }))}
              className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Pages par visite</label>
            <input type="number" step="0.1" value={form.pages_per_visit} onChange={(e) => setForm(f => ({ ...f, pages_per_visit: e.target.value }))}
              className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Durée moyenne de visite (mm:ss)</label>
            <input type="text" value={form.avg_duration} onChange={(e) => setForm(f => ({ ...f, avg_duration: e.target.value }))}
              placeholder="1:30"
              className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-text-primary font-medium rounded-xl transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium rounded-xl transition-colors disabled:opacity-50">
              {saving ? '...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold text-text-primary">{stats?.visits ?? '-'}</div>
            <div className="text-text-secondary text-xs mt-1">Visites mensuelles</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">{stats?.pages_per_visit ?? '-'}</div>
            <div className="text-text-secondary text-xs mt-1">Pages par visite</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">{stats?.avg_duration ?? '-'}</div>
            <div className="text-text-secondary text-xs mt-1">Durée moyenne</div>
          </div>
        </div>
      )}
    </div>
  );
}
