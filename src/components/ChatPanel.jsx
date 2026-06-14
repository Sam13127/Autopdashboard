import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { processMessage } from '../lib/ai';

const CHANNELS = ['LeBonCoin', 'La Centrale', 'Site web', 'Autre'];

const WELCOME_MESSAGE = "Bonjour ! Je peux enregistrer une vente, gérer le stock, modifier ou supprimer des ventes, mettre à jour les stats web/Google Business, te donner les KPIs ou répondre à tes questions. Exemple : \"J'ai vendu la Clio 5 à 6500€, elle était là depuis 32 jours, via LeBonCoin\".";

export default function ChatPanel({ className = '' }) {
  const [messages, setMessages] = useState([{ role: 'bot', text: WELCOME_MESSAGE }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null); // { action, data, match, changes, message }
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const addMessage = (role, text) => setMessages((m) => [...m, { role, text }]);

  const handleKpiQuery = async (query) => {
    const { data: sales } = await supabase.from('sales').select('*');
    const list = sales || [];

    const now = new Date();
    const monthSales = list.filter(s => {
      const d = new Date(s.date);
      return !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const weekSales = list.filter(s => {
      const d = new Date(s.date);
      return !isNaN(d.getTime()) && d >= weekAgo;
    });

    const totalCA = list.reduce((acc, s) => acc + (parseFloat(s.price) || 0), 0);
    const monthCA = monthSales.reduce((acc, s) => acc + (parseFloat(s.price) || 0), 0);

    addMessage('bot',
      `📊 ${query ? `Concernant "${query}" : ` : ''}` +
      `Ce mois : ${monthSales.length} vente(s) pour ${monthCA.toLocaleString('fr-FR')} € de CA. ` +
      `Cette semaine : ${weekSales.length} vente(s). ` +
      `CA total : ${totalCA.toLocaleString('fr-FR')} € sur ${list.length} vente(s).`
    );
  };

  const handleStockQuery = async () => {
    const { data: stock, error } = await supabase.from('stock').select('*').order('entry_date', { ascending: true });
    if (error) {
      addMessage('bot', `Erreur lors de la lecture du stock : ${error.message}`);
      return;
    }
    if (!stock || stock.length === 0) {
      addMessage('bot', "Le stock est vide pour le moment.");
      return;
    }
    const lines = stock.map(v => {
      const parts = [v.model];
      if (v.year) parts.push(`(${v.year})`);
      if (v.km) parts.push(`${v.km.toLocaleString('fr-FR')} km`);
      if (v.buy_price) parts.push(`acheté ${v.buy_price.toLocaleString('fr-FR')}€`);
      return `• ${parts.join(', ')}`;
    });
    addMessage('bot', `🚗 ${stock.length} véhicule(s) en stock :\n${lines.join('\n')}`);
  };

  const summarizeSale = (data) => {
    const parts = [];
    if (data.model) parts.push(data.model);
    if (data.price) parts.push(`${data.price.toLocaleString('fr-FR')}€`);
    if (data.channel) parts.push(data.channel);
    return parts.join(', ');
  };

  // Cherche une vente correspondant au critère "match" (model et/ou la plus récente)
  const findSale = async (match) => {
    let query = supabase.from('sales').select('*');
    if (match?.model) query = query.ilike('model', `%${match.model}%`);
    query = query.order('date', { ascending: false }).limit(1);
    const { data } = await query;
    return data?.[0] || null;
  };

  const findStockVehicle = async (match) => {
    let query = supabase.from('stock').select('*');
    if (match?.model) query = query.ilike('model', `%${match.model}%`);
    query = query.order('entry_date', { ascending: false }).limit(1);
    const { data } = await query;
    return data?.[0] || null;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    addMessage('user', text);
    setInput('');
    setLoading(true);

    try {
      const result = await processMessage(text);

      switch (result.action) {
        case 'SALE':
        case 'STOCK_ADD':
        case 'STOCK_SELL':
          setPending(result);
          addMessage('bot', result.message || `${result.action} : ${summarizeSale(result.data || {})}. Je confirme ?`);
          break;

        case 'SALE_UPDATE':
        case 'SALE_DELETE': {
          const sale = await findSale(result.match);
          if (!sale) {
            addMessage('bot', "Je n'ai pas trouvé de vente correspondante.");
            break;
          }
          setPending({ ...result, target: sale });
          addMessage('bot', result.message || `Confirmer cette action sur la vente ${sale.model} ?`);
          break;
        }

        case 'STOCK_UPDATE':
        case 'STOCK_DELETE': {
          const vehicle = await findStockVehicle(result.match);
          if (!vehicle) {
            addMessage('bot', "Je n'ai pas trouvé de véhicule correspondant dans le stock.");
            break;
          }
          setPending({ ...result, target: vehicle });
          addMessage('bot', result.message || `Confirmer cette action sur ${vehicle.model} ?`);
          break;
        }

        case 'WEBSTATS_UPDATE':
        case 'GOOGLE_UPDATE':
          setPending(result);
          addMessage('bot', result.message || 'Confirmer la mise à jour ?');
          break;

        case 'STOCK_QUERY':
          if (result.message) addMessage('bot', result.message);
          await handleStockQuery();
          break;

        case 'KPI_QUERY':
          if (result.message) addMessage('bot', result.message);
          await handleKpiQuery(result.query);
          break;

        case 'ANSWER':
        case 'CHAT':
          addMessage('bot', result.message || '...');
          break;

        case 'ERROR':
          addMessage('bot', result.message || "Je n'ai pas bien compris. Peux-tu préciser ?");
          break;

        default:
          addMessage('bot', "Je n'ai pas bien compris. Peux-tu préciser ?");
      }
    } catch (err) {
      addMessage('bot', `Erreur : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setLoading(true);
    const { action, data, changes, target } = pending;

    try {
      if (action === 'SALE') {
        const { error } = await supabase.from('sales').insert([{
          model: data.model,
          price: parseFloat(data.price) || 0,
          date: data.date || new Date().toISOString().split('T')[0],
          km: data.km ? parseFloat(data.km) : null,
          channel: CHANNELS.includes(data.channel) ? data.channel : (data.channel || 'Autre'),
          daysInStock: data.daysInStock ? parseInt(data.daysInStock) : null,
          buy_price: data.buyPrice ? parseFloat(data.buyPrice) : null,
        }]);
        if (error) throw error;
        addMessage('bot', '✅ Vente enregistrée avec succès !');

      } else if (action === 'STOCK_ADD') {
        const { error } = await supabase.from('stock').insert([{
          model: data.model,
          buy_price: data.buyPrice ? parseFloat(data.buyPrice) : null,
          km: data.km ? parseFloat(data.km) : null,
          year: data.year ? parseInt(data.year) : null,
          entry_date: data.date || new Date().toISOString().split('T')[0],
        }]);
        if (error) throw error;
        addMessage('bot', '✅ Véhicule ajouté au stock !');

      } else if (action === 'STOCK_SELL') {
        // Trouve le véhicule correspondant dans le stock pour calculer les jours en stock
        const { data: stockMatches } = await supabase
          .from('stock')
          .select('*')
          .ilike('model', `%${data.model}%`)
          .limit(1);
        const match = stockMatches?.[0];

        let daysInStock = null;
        if (match?.entry_date) {
          const entry = new Date(match.entry_date);
          const saleDate = new Date(data.date || new Date().toISOString().split('T')[0]);
          daysInStock = Math.max(0, Math.round((saleDate - entry) / (1000 * 60 * 60 * 24)));
        }

        const { error: insertError } = await supabase.from('sales').insert([{
          model: data.model,
          price: parseFloat(data.price) || 0,
          date: data.date || new Date().toISOString().split('T')[0],
          channel: CHANNELS.includes(data.channel) ? data.channel : (data.channel || 'Autre'),
          daysInStock,
          buy_price: match?.buy_price ?? null,
          km: match?.km ?? null,
        }]);
        if (insertError) throw insertError;

        if (match) {
          await supabase.from('stock').delete().eq('id', match.id);
        }
        addMessage('bot', '✅ Véhicule marqué comme vendu !');

      } else if (action === 'SALE_UPDATE') {
        const payload = {};
        if (changes.model != null) payload.model = changes.model;
        if (changes.price != null) payload.price = parseFloat(changes.price);
        if (changes.buyPrice != null) payload.buy_price = parseFloat(changes.buyPrice);
        if (changes.date != null) payload.date = changes.date;
        if (changes.km != null) payload.km = parseFloat(changes.km);
        if (changes.channel != null) payload.channel = changes.channel;
        if (changes.daysInStock != null) payload.daysInStock = parseInt(changes.daysInStock);

        const { error } = await supabase.from('sales').update(payload).eq('id', target.id);
        if (error) throw error;
        addMessage('bot', '✅ Vente mise à jour !');

      } else if (action === 'SALE_DELETE') {
        const { error } = await supabase.from('sales').delete().eq('id', target.id);
        if (error) throw error;
        addMessage('bot', '✅ Vente supprimée !');

      } else if (action === 'STOCK_UPDATE') {
        const payload = {};
        if (changes.model != null) payload.model = changes.model;
        if (changes.buyPrice != null) payload.buy_price = parseFloat(changes.buyPrice);
        if (changes.km != null) payload.km = parseFloat(changes.km);
        if (changes.year != null) payload.year = parseInt(changes.year);
        if (changes.date != null) payload.entry_date = changes.date;

        const { error } = await supabase.from('stock').update(payload).eq('id', target.id);
        if (error) throw error;
        addMessage('bot', '✅ Véhicule du stock mis à jour !');

      } else if (action === 'STOCK_DELETE') {
        const { error } = await supabase.from('stock').delete().eq('id', target.id);
        if (error) throw error;
        addMessage('bot', '✅ Véhicule retiré du stock !');

      } else if (action === 'WEBSTATS_UPDATE') {
        const { data: existing } = await supabase
          .from('web_stats')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const payload = {
          month: existing?.month || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          visits: changes.visits != null ? parseInt(changes.visits) : existing?.visits ?? null,
          pages_per_visit: changes.pages_per_visit != null ? parseFloat(changes.pages_per_visit) : existing?.pages_per_visit ?? null,
          avg_duration: changes.avg_duration != null ? changes.avg_duration : existing?.avg_duration ?? null,
          updated_at: new Date().toISOString(),
        };

        let error;
        if (existing?.id) {
          ({ error } = await supabase.from('web_stats').update(payload).eq('id', existing.id));
        } else {
          ({ error } = await supabase.from('web_stats').insert([payload]));
        }
        if (error) throw error;
        addMessage('bot', '✅ Stats web mises à jour !');

      } else if (action === 'GOOGLE_UPDATE') {
        const { data: existing } = await supabase
          .from('google_business')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const payload = {
          month: existing?.month || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          profile_views: changes.profile_views != null ? parseInt(changes.profile_views) : existing?.profile_views ?? null,
          calls: changes.calls != null ? parseInt(changes.calls) : existing?.calls ?? null,
          directions: changes.directions != null ? parseInt(changes.directions) : existing?.directions ?? null,
          reviews: changes.reviews != null ? parseInt(changes.reviews) : existing?.reviews ?? null,
          avg_rating: changes.avg_rating != null ? parseFloat(changes.avg_rating) : existing?.avg_rating ?? null,
          updated_at: new Date().toISOString(),
        };

        let error;
        if (existing?.id) {
          ({ error } = await supabase.from('google_business').update(payload).eq('id', existing.id));
        } else {
          ({ error } = await supabase.from('google_business').insert([payload]));
        }
        if (error) throw error;
        addMessage('bot', '✅ Données Google Business mises à jour !');
      }
    } catch (err) {
      addMessage('bot', `Erreur lors de l'enregistrement : ${err.message}`);
    } finally {
      setPending(null);
      setLoading(false);
    }
  };

  const handleModify = () => {
    setPending(null);
    addMessage('bot', "Pas de problème, donnez-moi les informations corrigées.");
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const pendingDetails = pending ? (pending.changes || pending.data || {}) : null;

  return (
    <div className={`bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${className}`}>
      <div className="bg-[#111928] text-white px-5 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-bold text-sm">AI</span>
          <span className="font-semibold">Assistant Auto'P</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-line ${
              m.role === 'user'
                ? 'bg-accent text-white rounded-br-sm'
                : 'bg-white text-text-primary border border-gray-200 rounded-bl-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="max-w-[90%] bg-white border border-gray-200 rounded-2xl rounded-bl-sm p-3 text-sm space-y-2">
              <div className="text-text-secondary text-xs space-y-1">
                {pendingDetails?.model && <div><strong className="text-text-primary">Modèle :</strong> {pendingDetails.model}</div>}
                {!!pendingDetails?.price && <div><strong className="text-text-primary">Prix :</strong> {pendingDetails.price.toLocaleString('fr-FR')} €</div>}
                {pendingDetails?.date && <div><strong className="text-text-primary">Date :</strong> {pendingDetails.date}</div>}
                {!!pendingDetails?.km && <div><strong className="text-text-primary">Km :</strong> {pendingDetails.km.toLocaleString('fr-FR')}</div>}
                {pendingDetails?.channel && <div><strong className="text-text-primary">Canal :</strong> {pendingDetails.channel}</div>}
                {!!pendingDetails?.daysInStock && <div><strong className="text-text-primary">Jours en stock :</strong> {pendingDetails.daysInStock}</div>}
                {!!pendingDetails?.buyPrice && <div><strong className="text-text-primary">Prix d'achat :</strong> {pendingDetails.buyPrice.toLocaleString('fr-FR')} €</div>}
                {!!pendingDetails?.year && <div><strong className="text-text-primary">Année :</strong> {pendingDetails.year}</div>}
                {pendingDetails?.visits != null && <div><strong className="text-text-primary">Visites :</strong> {pendingDetails.visits}</div>}
                {pendingDetails?.pages_per_visit != null && <div><strong className="text-text-primary">Pages/visite :</strong> {pendingDetails.pages_per_visit}</div>}
                {pendingDetails?.avg_duration != null && <div><strong className="text-text-primary">Durée moy. :</strong> {pendingDetails.avg_duration}</div>}
                {pendingDetails?.profile_views != null && <div><strong className="text-text-primary">Vues fiche :</strong> {pendingDetails.profile_views}</div>}
                {pendingDetails?.calls != null && <div><strong className="text-text-primary">Appels :</strong> {pendingDetails.calls}</div>}
                {pendingDetails?.directions != null && <div><strong className="text-text-primary">Itinéraires :</strong> {pendingDetails.directions}</div>}
                {pendingDetails?.reviews != null && <div><strong className="text-text-primary">Avis :</strong> {pendingDetails.reviews}</div>}
                {pendingDetails?.avg_rating != null && <div><strong className="text-text-primary">Note :</strong> {pendingDetails.avg_rating}/5</div>}
                {pending.target?.model && pending.action.startsWith('SALE') && (
                  <div className="text-gray-400 italic">Vente concernée : {pending.target.model} ({pending.target.date})</div>
                )}
                {pending.target?.model && pending.action.startsWith('STOCK_') && pending.action !== 'STOCK_ADD' && (
                  <div className="text-gray-400 italic">Véhicule concerné : {pending.target.model}</div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50">
                  Confirmer
                </button>
                <button onClick={handleModify} disabled={loading} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-text-primary text-xs font-semibold rounded-xl transition-colors disabled:opacity-50">
                  Modifier
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-text-secondary">
              ...
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-200 bg-white flex gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || !!pending}
          placeholder="Écris un message..."
          className="flex-1 px-4 py-2.5 bg-bg border border-gray-200 rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-accent outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !!pending || !input.trim()}
          className="w-10 h-10 flex items-center justify-center bg-accent hover:bg-accent/90 text-white rounded-xl transition-colors disabled:opacity-50"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </div>
  );
}
