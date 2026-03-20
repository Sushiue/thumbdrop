'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import CardItem from '@/components/CardItem';
import { RARITY_CONFIG, RARITIES, formatViewCount } from '@/lib/game';

interface Profile  { id: string; username: string; tubes: number; crystals: number; total_cards: number; }
interface InvItem  { id: string; obtained_at: string; card_id?: string | null; channel_id?: string | null; cards?: Record<string, unknown> | null; yt_channels?: Record<string, unknown> | null; }

const ALL_FILTER = 'all';
type Filter = 'all' | 'channel' | typeof RARITIES[number];

export default function CollectionPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [filter,    setFilter]    = useState<Filter>(ALL_FILTER);
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState<InvItem | null>(null);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);

    const { data: inv } = await supabase
      .from('inventory')
      .select('*, cards(*), yt_channels(*)')
      .eq('player_id', user.id)
      .order('obtained_at', { ascending: false });

    setInventory(inv ?? []);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { load(); }, [load]);

  const filtered = inventory.filter(inv => {
    const card    = inv.cards    as Record<string, unknown> | null;
    const channel = inv.yt_channels as Record<string, unknown> | null;

    if (filter === 'channel') return !!channel;
    if (filter !== ALL_FILTER && card) {
      if ((card.rarity as string) !== filter) return false;
    } else if (filter !== ALL_FILTER) return false;

    if (search) {
      const q = search.toLowerCase();
      const name = channel
        ? (channel.channel_name as string).toLowerCase()
        : (card?.title as string ?? '').toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  });

  // Stats par rareté
  const stats: Record<string, number> = { channel: 0 };
  for (const r of RARITIES) stats[r] = 0;
  for (const inv of inventory) {
    if (inv.yt_channels) stats.channel++;
    else if (inv.cards) {
      const r = (inv.cards as Record<string, string>).rarity;
      if (r) stats[r] = (stats[r] ?? 0) + 1;
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-purple-400 animate-pulse text-xl">Chargement...</div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 sm:pb-0 sm:pl-52 pt-14">
      <Navbar username={profile?.username ?? ''} tubes={profile?.tubes ?? 0} crystals={profile?.crystals ?? 0} />

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur p-4"
             onClick={() => setSelected(null)}>
          <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-6 max-w-sm w-full"
               onClick={e => e.stopPropagation()}>
            {selected.yt_channels ? (
              <ChannelDetail ch={selected.yt_channels as Record<string, unknown>} inv={selected} />
            ) : selected.cards ? (
              <CardDetail card={selected.cards as Record<string, unknown>} inv={selected} />
            ) : null}
            <button onClick={() => setSelected(null)}
              className="mt-4 w-full py-2 bg-[#1e1e2a] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-gray-400 rounded-xl text-sm transition-all">
              Fermer
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-white">📚 Ma Collection</h1>
          <span className="text-gray-400 text-sm">{inventory.length} cartes</span>
        </div>

        {/* Rarity stats */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[...RARITIES, 'channel' as const].map(r => {
            const cfg = RARITY_CONFIG[r];
            return stats[r] > 0 ? (
              <div key={r} className="text-xs px-2.5 py-1 rounded-full bg-[#13131a] border"
                   style={{ borderColor: cfg.color + '55', color: cfg.color }}>
                {cfg.emoji} {cfg.label}: {stats[r]}
              </div>
            ) : null;
          })}
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Chercher..."
            className="flex-1 bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm" />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[ALL_FILTER, 'channel', ...RARITIES].map(f => {
              const cfg = f === ALL_FILTER ? null : RARITY_CONFIG[f];
              return (
                <button key={f} onClick={() => setFilter(f as Filter)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    filter === f ? 'text-white' : 'text-gray-500 border-[#2a2a3a] hover:border-gray-600'
                  }`}
                  style={filter === f && cfg ? { background: cfg.color + '22', borderColor: cfg.color, color: cfg.color } : {}}>
                  {cfg ? `${cfg.emoji} ${cfg.label}` : '🔮 Tout'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500">Aucune carte trouvée.</p>
            {inventory.length === 0 && <a href="/shop" className="text-purple-400 text-sm mt-2 block hover:underline">Ouvrir des boosters →</a>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map(inv => (
              <div key={inv.id} onClick={() => setSelected(inv)} className="cursor-pointer">
                {inv.yt_channels
                  ? <CardItem channel={inv.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="sm" />
                  : <CardItem card={inv.cards as Parameters<typeof CardItem>[0]['card']} size="sm" />
                }
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CardDetail({ card, inv }: { card: Record<string, unknown>; inv: InvItem }) {
  const cfg = RARITY_CONFIG[card.rarity as string] ?? RARITY_CONFIG.basic;
  return (
    <div>
      <img src={card.thumbnail_url as string} alt={card.title as string} className="w-full rounded-xl mb-3" />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.color + '33', color: cfg.color }}>
          {cfg.emoji} {cfg.label}
        </span>
      </div>
      <h3 className="text-white font-bold text-sm mb-0.5 line-clamp-2">{card.title as string}</h3>
      <p className="text-gray-400 text-xs mb-1">{card.channel_name as string}</p>
      <p className="text-gray-500 text-xs">{formatViewCount(card.view_count as number)} vues • {formatViewCount(card.like_count as number)} likes</p>
      <p className="text-gray-600 text-xs mt-2">Obtenu le {new Date(inv.obtained_at).toLocaleDateString('fr-FR')}</p>
    </div>
  );
}

function ChannelDetail({ ch, inv }: { ch: Record<string, unknown>; inv: InvItem }) {
  const cfg = RARITY_CONFIG.channel;
  return (
    <div className="text-center">
      <img src={ch.thumbnail_url as string} alt={ch.channel_name as string}
           className="w-24 h-24 rounded-full mx-auto mb-3 border-4" style={{ borderColor: cfg.color }} />
      <div className="mb-2">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.color + '33', color: cfg.color }}>
          {cfg.emoji} Chaîne Exclusive
        </span>
      </div>
      <h3 className="text-white font-bold text-lg mb-1">{ch.channel_name as string}</h3>
      <p className="text-yellow-400 font-semibold">{formatViewCount(ch.subscriber_count as number)} abonnés</p>
      <p className="text-gray-500 text-xs mt-1">Tu es le seul propriétaire de cette chaîne !</p>
      <p className="text-gray-600 text-xs mt-2">Obtenu le {new Date(inv.obtained_at).toLocaleDateString('fr-FR')}</p>
    </div>
  );
}
