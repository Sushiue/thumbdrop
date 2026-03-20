'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import CardItem from '@/components/CardItem';
import { PACKS, PackKey, RARITY_CONFIG, SELL_PRICE } from '@/lib/game';

interface Profile { id: string; username: string; tubes: number; crystals: number; total_cards: number; }

type PackResult = {
  type: 'card' | 'channel';
  data: Record<string, unknown>;
  inventoryId?: string;
};

export default function ShopPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [opening,    setOpening]    = useState(false);
  const [results,    setResults]    = useState<PackResult[] | null>(null);
  const [revealed,   setRevealed]   = useState<boolean[]>([]);
  const [kept,       setKept]       = useState<boolean[]>([]);
  const [error,      setError]      = useState('');
  const [allReveal,  setAllReveal]  = useState(false);
  const [lang,       setLang]       = useState<'en' | 'fr'>('en');
  const [selling,    setSelling]    = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(data);
  }, [supabase, router]);

  useEffect(() => { load(); }, [load]);

  async function openPack(packKey: PackKey) {
    setError('');
    setResults(null);
    setOpening(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/open-pack', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body:    JSON.stringify({ packKey, lang }),
    });
    const data = await res.json();
    setOpening(false);

    if (!res.ok) { setError(data.error); return; }

    // Récupérer les inventory IDs des cartes ajoutées
    const { data: { user } } = await supabase.auth.getUser();
    const { data: invItems } = await supabase
      .from('inventory').select('id, card_id, channel_id')
      .eq('player_id', user!.id)
      .order('obtained_at', { ascending: false })
      .limit(data.results.length);

    const resultsWithIds = data.results.map((r: PackResult, i: number) => ({
      ...r,
      inventoryId: invItems?.[i]?.id,
    }));

    setResults(resultsWithIds);
    setRevealed(new Array(data.results.length).fill(false));
    setKept(new Array(data.results.length).fill(true));
    setAllReveal(false);
    load();
  }

  function revealCard(i: number) {
    setRevealed(prev => { const n = [...prev]; n[i] = true; return n; });
  }

  function revealAll() {
    setRevealed(new Array(results!.length).fill(true));
    setAllReveal(true);
  }

  function toggleKeep(i: number) {
    setKept(prev => { const n = [...prev]; n[i] = !n[i]; return n; });
  }

  async function sellUnkept() {
    if (!results) return;
    setSelling(true);
    const { data: { session } } = await supabase.auth.getSession();
    const toSell = results.filter((_, i) => !kept[i] && results[i].type === 'card' && results[i].inventoryId);

    for (const item of toSell) {
      await fetch('/api/sell-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ inventoryId: item.inventoryId }),
      });
    }

    setSelling(false);
    setResults(null);
    load();
  }

  const totalSellValue = results
    ? results.reduce((sum, r, i) => {
        if (kept[i] || r.type === 'channel') return sum;
        return sum + (SELL_PRICE[(r.data as Record<string,string>).rarity] ?? 10);
      }, 0)
    : 0;

  return (
    <div className="min-h-screen pb-20 sm:pb-0 sm:pl-52 pt-14">
      <Navbar username={profile?.username ?? ''} tubes={profile?.tubes ?? 0} crystals={profile?.crystals ?? 0} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-black text-white mb-2">🛍️ Boutique</h1>
        <p className="text-gray-400 text-sm mb-6">Ouvre des boosters pour obtenir des miniatures YouTube !</p>

        {error && (
          <div className="mb-6 bg-red-950/30 border border-red-800/40 text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Sélecteur de langue */}
        {!results && (
          <div className="flex items-center gap-3 mb-6">
            <span className="text-gray-400 text-sm">Langue des vidéos :</span>
            <button onClick={() => setLang('en')}
              className={`text-2xl rounded-xl px-3 py-2 border transition-all ${lang === 'en' ? 'border-blue-500 bg-blue-900/20' : 'border-[#2a2a3a] hover:border-gray-600'}`}
              title="Anglais">🇬🇧</button>
            <button onClick={() => setLang('fr')}
              className={`text-2xl rounded-xl px-3 py-2 border transition-all ${lang === 'fr' ? 'border-blue-500 bg-blue-900/20' : 'border-[#2a2a3a] hover:border-gray-600'}`}
              title="Français">🇫🇷</button>
          </div>
        )}

        {/* Résultats ouverture */}
        {results && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">🎉 Tu as obtenu !</h2>
              {!allReveal && (
                <button onClick={revealAll}
                  className="text-sm text-purple-400 hover:text-purple-300 border border-purple-700/40 rounded-lg px-3 py-1.5 transition-all">
                  Révéler tout
                </button>
              )}
            </div>

            {allReveal && (
              <p className="text-gray-400 text-xs mb-4">Clique sur les cartes que tu veux <span className="text-red-400 font-semibold">vendre</span> (croix rouge) ou <span className="text-green-400 font-semibold">garder</span> (coché)</p>
            )}

            <div className="flex flex-wrap gap-4 justify-center">
              {results.map((r, i) => (
                <div key={i} className="card-flip-container cursor-pointer relative" onClick={() => !revealed[i] && revealCard(i)}>
                  <div className={`card-flip-inner ${revealed[i] ? 'flipped' : ''} relative`} style={{ width: 160, height: 220 }}>
                    <div className="card-front absolute inset-0 rounded-xl border-2 border-purple-700 bg-gradient-to-br from-purple-900 to-indigo-950 flex flex-col items-center justify-center gap-2 select-none">
                      <span className="text-5xl">🎴</span>
                      <span className="text-purple-300 text-xs font-semibold">Cliquer pour révéler</span>
                    </div>
                    <div className="card-back absolute inset-0">
                      {revealed[i] && (
  (r.data as Record<string,unknown>)?.error ? (
    <div className="w-40 h-52 rounded-xl border-2 border-gray-700 bg-[#13131a] flex items-center justify-center text-center p-3">
      <div><p className="text-2xl mb-2">😵</p><p className="text-gray-500 text-xs">Erreur API YouTube</p></div>
    </div>
  ) : r.type === 'channel'
    ? <CardItem channel={r.data as Parameters<typeof CardItem>[0]['channel']} size="md" />
    : <CardItem card={r.data as Parameters<typeof CardItem>[0]['card']} size="md" />
)}
                    </div>
                  </div>

                  {/* Bouton garder/vendre */}
                  {revealed[i] && allReveal && r.type === 'card' && (
                    <button
                      onClick={e => { e.stopPropagation(); toggleKeep(i); }}
                      className={`absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                        kept[i]
                          ? 'bg-green-900/80 border-green-600 text-green-300'
                          : 'bg-red-900/80 border-red-600 text-red-300'
                      }`}>
                      {kept[i] ? '✅ Garder' : '❌ Vendre'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {allReveal && (
              <div className="mt-6 flex gap-3 justify-center flex-wrap">
                {totalSellValue > 0 && (
                  <button onClick={sellUnkept} disabled={selling}
                    className="px-6 py-2.5 bg-amber-700/40 hover:bg-amber-700/60 border border-amber-700/40 text-amber-400 rounded-xl font-bold text-sm transition-all disabled:opacity-40">
                    {selling ? '⏳' : `Vendre les non-gardées (+${totalSellValue} 🪙)`}
                  </button>
                )}
                <button onClick={() => setResults(null)}
                  className="px-6 py-2.5 bg-[#1e1e2a] border border-[#2a2a3a] hover:border-purple-600 text-white rounded-xl font-semibold transition-all">
                  {totalSellValue > 0 ? 'Garder toutes' : 'Retour à la boutique'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Liste des packs */}
        {!results && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(Object.entries(PACKS) as [PackKey, typeof PACKS[PackKey]][]).filter(([k]) => k !== 'weekly_reward').map(([key, pack]) => {
              const canAfford = (pack.cost.tubes === 0 || (profile?.tubes ?? 0) >= pack.cost.tubes)
                             && (pack.cost.crystals === 0 || (profile?.crystals ?? 0) >= pack.cost.crystals);
              return (
                <div key={key} className={`bg-[#13131a] border rounded-2xl overflow-hidden transition-all ${
                  canAfford ? 'border-[#2a2a3a] hover:border-purple-600/60' : 'border-[#1a1a22] opacity-60'
                }`}>
                  <div className={`h-28 bg-gradient-to-br ${pack.color} flex items-center justify-center`}>
                    <span className="text-6xl">{pack.emoji}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-white font-bold text-base mb-1">{pack.name}</h3>
                    <p className="text-gray-400 text-xs mb-3">{pack.description}</p>
                    <ul className="text-xs text-gray-500 mb-4 space-y-1">
                      <li>🎴 {pack.count} miniatures</li>
                      <li>📺 Chance Chaîne: {(pack.channelChance * 100).toFixed(1)}%</li>
                      {'guaranteedMinRarity' in pack && (
                        <li className="text-purple-400">⭐ Garanti {RARITY_CONFIG[(pack as {guaranteedMinRarity:string}).guaranteedMinRarity]?.label}+</li>
                      )}
                    </ul>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {pack.cost.tubes    > 0 && <span className="text-amber-400 font-bold text-sm">🪙 {pack.cost.tubes}</span>}
                        {pack.cost.crystals > 0 && <span className="text-cyan-400 font-bold text-sm">💎 {pack.cost.crystals}</span>}
                        {pack.cost.tubes === 0 && pack.cost.crystals === 0 && <span className="text-green-400 font-bold text-sm">Gratuit</span>}
                      </div>
                      <button onClick={() => openPack(key)} disabled={opening || !canAfford}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white font-bold text-xs transition-all">
                        {opening ? '⏳' : 'Ouvrir'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!results && (
          <div className="mt-10 bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
            <h3 className="text-white font-bold mb-3">💡 Comment gagner des ressources ?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-400">
              <div className="flex gap-2"><span>☀️</span><span>Missions quotidiennes → <span className="text-amber-400">Tubes 🪙</span></span></div>
              <div className="flex gap-2"><span>📅</span><span>Missions hebdomadaires → <span className="text-cyan-400">Cristaux 💎</span></span></div>
              <div className="flex gap-2"><span>🔄</span><span>Échanges avec d'autres joueurs</span></div>
              <div className="flex gap-2"><span>🔑</span><span>Connexion quotidienne → +50 🪙</span></div>
            </div>
          </div>
        )}

        {!results && <FavoriteChannelSection supabase={supabase} />}
      </div>
    </div>
  );
}

function FavoriteChannelSection({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [input,   setInput]   = useState('');
  const [current, setCurrent] = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('favorite_channel').eq('id', user.id).single()
        .then(({ data }) => { if (data?.favorite_channel) { setCurrent(data.favorite_channel); setInput(data.favorite_channel); } });
    });
  }, [supabase]);

  async function save() {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/set-favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ favoriteChannel: input }),
    });
    setCurrent(input);
    setSaving(false);
  }

  return (
    <div className="mt-6 bg-[#13131a] border border-purple-800/30 rounded-2xl p-5">
      <h3 className="text-white font-bold mb-1">🎯 Chaîne Favorite</h3>
      <p className="text-gray-400 text-xs mb-3">+10% de chance d'obtenir des vidéos ou la chaîne de ton choix !</p>
      {current && <p className="text-purple-400 text-xs mb-2">Actuelle : <span className="font-bold">{current}</span></p>}
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Ex: MrBeast, PewDiePie..."
          className="flex-1 bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm" />
        <button onClick={save} disabled={saving || !input}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl text-white font-bold text-sm transition-all">
          {saving ? '⏳' : 'Sauver'}
        </button>
      </div>
    </div>
  );
}