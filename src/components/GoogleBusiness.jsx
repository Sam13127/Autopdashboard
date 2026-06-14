import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CURRENT_MONTH = 'Mai 2026';

export default function GoogleBusiness() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ profile_views: '', calls: '', directions: '', reviews: '', avg_rating: '' });

  const fetchStats = async () => {
    const { data, error } = await supabase
      .from('google_business')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) console.error('Erreur fetch google_business:', error);

    if (data) {
      setStats(data);
      setForm({
        profile_views: data.profile_views ?? '',
        calls: data.calls ?? '',
        directions: data.directions ?? '',
        reviews: data.reviews ?? '',
        avg_rating: data.avg_rating ?? '',
      });
    } else {
      setStats({ month: CURRENT_MONTH });
      setForm({ profile_views: '', calls: '', directions: '', reviews: '', avg_rating: '' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        month: stats?.month || CURRENT_MONTH,
        profile_views: form.profile_views ? parseInt(form.profile_views) : null,
        calls: form.calls ? parseInt(form.calls) : null,
        directions: form.directions ? parseInt(form.directions) : null,
        reviews: form.reviews ? parseInt(form.reviews) : null,
        avg_rating: form.avg_rating ? parseFloat(form.avg_rating) : null,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (stats?.id) {
        ({ error } = await supabase.from('google_business').update(payload).eq('id', stats.id));
      } else {
        ({ error } = await supabase.from('google_business').insert([payload]));
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
        <h2 className="text-lg font-bold text-text-primary">Google Business</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-accent hover:text-accent/80 text-sm font-medium transition-colors">
            Modifier
          </button>
        )}
      </div>
      <span className="inline-block mb-4 px-2.5 py-1 bg-accent-light text-accent rounded-lg text-xs font-medium">
        Mis à jour manuellement — {stats?.month || CURRENT_MONTH}
      </span>

      {loading ? (
        <div className="text-text-secondary text-sm">Chargement...</div>
      ) : editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Vues de la fiche</label>
              <input type="number" value={form.profile_views} onChange={(e) => setForm(f => ({ ...f, profile_views: e.target.value }))}
                className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Appels reçus</label>
              <input type="number" value={form.calls} onChange={(e) => setForm(f => ({ ...f, calls: e.target.value }))}
                className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Clics itinéraire</label>
              <input type="number" value={form.directions} onChange={(e) => setForm(f => ({ ...f, directions: e.target.value }))}
                className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Avis clients</label>
              <input type="number" value={form.reviews} onChange={(e) => setForm(f => ({ ...f, reviews: e.target.value }))}
                className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Note moyenne</label>
              <input type="number" step="0.1" min="0" max="5" value={form.avg_rating} onChange={(e) => setForm(f => ({ ...f, avg_rating: e.target.value }))}
                className="w-full px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-text-primary focus:ring-2 focus:ring-accent outline-none" />
            </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold text-text-primary">{stats?.profile_views ?? '-'}</div>
            <div className="text-text-secondary text-xs mt-1">Vues de la fiche</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">{stats?.calls ?? '-'}</div>
            <div className="text-text-secondary text-xs mt-1">Appels reçus</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">{stats?.directions ?? '-'}</div>
            <div className="text-text-secondary text-xs mt-1">Clics itinéraire</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">{stats?.reviews ?? '-'}</div>
            <div className="text-text-secondary text-xs mt-1">Avis clients</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">{stats?.avg_rating ?? '-'}{stats?.avg_rating ? ' / 5' : ''}</div>
            <div className="text-text-secondary text-xs mt-1">Note moyenne</div>
          </div>
        </div>
      )}
    </div>
  );
}
