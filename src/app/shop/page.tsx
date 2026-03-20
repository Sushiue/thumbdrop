'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import CardItem from '@/components/CardItem';
import { PACKS, PackKey, RARITY_CONFIG } from '@/lib/game';

interface Profile { id: string; username: string; tubes: number; crystals: number; total_cards: number; }

type PackResult = {
  type: 'card' | 'channel';
  data: Record<string, unknown>;
};

export default function ShopPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [opening,   setOpening]   = useState(false);
  const [results,   setResults]   = useState<PackResult[] | null>(null);
  const [revealed,  setRevealed]  = useState<boolean[]>([]);
  const [error,     setError]     = useState('');
  const [allReveal, setAllReveal] = useState(false);

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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ packKey }),
    });
    const data = await res.json();
    setOpening(false);

    if (!res.ok) { setError(data.error); return; }

    setResults(data.results);
    setRevealed(new Array(data.results.length).fill(false));
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

  return (
    <div className="min-h-screen pb-20 sm:pb-0 sm:pl-52 pt-14">
      <Navbar username={profile?.username ?? ''} tubes={profile?.tubes ?? 0} crystals={profile?.crystals ?? 0} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-black text-white mb-2">🛍️ Boutique</h1>
        <p className="text-gray-400 text-sm mb-8">Ouvre des boosters pour obtenir des miniatures YouTube !</p>

        {error && (
          <div className="mb-6 bg-red-950/30 border border-red-800/40 text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {results && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">🎉 Tu as obtenu !</h2>
              {!allReveal && (
                <button onClick={revealAll}
                  className="text-sm text-purple-400 hover:text-purple-300 border border-purple-700/40 rounded-lg px-3 py-1.5 transition-all">
                  Révéler tout
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {results.map((r, i) => (
                <div key={i} className="card-flip-container cursor-pointer" onClick={() => revealCard(i)}>
                  <div className={`card-flip-inner ${revealed[i] ? 'flipped' : ''} relative`} style={{ width: 160, height: 220 }}>
                    <div className="card-front absolute inset-0 rounded-xl border-2 border-purple-700 bg-gradient-to-br from-purple-900 to-indigo-950 flex flex-col items-center justify-center gap-2 select-none">
                      <span className="text-5xl">🎴</span>
                      <span className="text-purple-300 text-xs font-semibold">Cliquer pour révéler</span>
                    </div>
                    <div className="card-back absolute inset-0">
                      {revealed[i] && (
                        r.type === 'channel'
                          ? <CardItem channel={r.data as Parameters<typeof CardItem>[0]['channel']} size="md" />
                          : <CardItem card={r.data as Parameters<typeof CardItem>[0]['card']} size="md" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {allReveal && (
              <div className="mt-6 text-center">
                <button onClick={() => setResults(null)}
                  className="px-6 py-2.5 bg-[#1e1e2a] border border-[#2a2a3a] hover:border-purple-600 text-white rounded-xl font-semibold transition-all">
                  Retour à la boutique
                </button>
              </div>
            )}
          </div>
        )}

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
      <p className="text-gray-400 text-xs mb-3">+10% de chance d'obtenir des vidéos ou la chaîne de ton choix à chaque ouverture de pack !</p>
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