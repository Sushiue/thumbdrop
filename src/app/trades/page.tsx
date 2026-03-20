'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import CardItem from '@/components/CardItem';
import { RARITY_CONFIG } from '@/lib/game';

interface Profile  { id: string; username: string; tubes: number; crystals: number; total_cards: number; }
interface InvItem  { id: string; obtained_at: string; cards?: Record<string, unknown> | null; yt_channels?: Record<string, unknown> | null; }
interface TradeRow { id: string; status: string; created_at: string; from_player_id: string; to_player_id: string; offered_inv_id: string; requested_inv_id: string; from_profile?: { username: string }; to_profile?: { username: string }; offered_inv?: { cards?: Record<string, unknown>; yt_channels?: Record<string, unknown> }; requested_inv?: { cards?: Record<string, unknown>; yt_channels?: Record<string, unknown> }; }

type Step = 'list' | 'create_choose_mine' | 'create_choose_target_user' | 'create_choose_theirs' | 'confirm';

export default function TradesPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [profile,       setProfile]       = useState<Profile | null>(null);
  const [myInv,         setMyInv]         = useState<InvItem[]>([]);
  const [trades,        setTrades]        = useState<TradeRow[]>([]);
  const [step,          setStep]          = useState<Step>('list');
  const [myPick,        setMyPick]        = useState<InvItem | null>(null);
  const [targetUser,    setTargetUser]    = useState('');
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [theirInv,      setTheirInv]      = useState<InvItem[]>([]);
  const [theirPick,     setTheirPick]     = useState<InvItem | null>(null);
  const [toast,         setToast]         = useState('');
  const [loading,       setLoading]       = useState(true);
  const [searching,     setSearching]     = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

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
    setMyInv(inv ?? []);

    // Trades du joueur
    const { data: tr } = await supabase
      .from('trades')
      .select(`
        *,
        from_profile:profiles!trades_from_player_id_fkey(username),
        to_profile:profiles!trades_to_player_id_fkey(username),
        offered_inv:inventory!trades_offered_inv_id_fkey(cards(*), yt_channels(*)),
        requested_inv:inventory!trades_requested_inv_id_fkey(cards(*), yt_channels(*))
      `)
      .or(`from_player_id.eq.${user.id},to_player_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(20);
    setTrades((tr as unknown as TradeRow[]) ?? []);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { load(); }, [load]);

  async function searchUser() {
    setSearching(true);
    const { data } = await supabase.from('profiles').select('*').eq('username', targetUser).single();
    if (!data || data.id === profile?.id) {
      showToast('Joueur introuvable ou c\'est toi-même !');
      setSearching(false);
      return;
    }
    setTargetProfile(data);
    const { data: inv } = await supabase
      .from('inventory').select('*, cards(*), yt_channels(*)')
      .eq('player_id', data.id).order('obtained_at', { ascending: false });
    setTheirInv(inv ?? []);
    setStep('create_choose_theirs');
    setSearching(false);
  }

  async function sendTrade() {
    if (!myPick || !theirPick || !targetProfile) return;
    const res = await supabase.from('trades').insert({
      from_player_id:    profile!.id,
      to_player_id:      targetProfile.id,
      offered_inv_id:    myPick.id,
      requested_inv_id:  theirPick.id,
      status:            'pending',
    });
    if (res.error) { showToast('Erreur lors de l\'envoi.'); return; }
    showToast('Échange envoyé !');
    setStep('list');
    setMyPick(null); setTheirPick(null); setTargetProfile(null); setTargetUser('');
    load();
  }

  async function respondTrade(tradeId: string, accept: boolean) {
    if (accept) {
      // Trouver les deux inventaires et les échanger
      const trade = trades.find(t => t.id === tradeId);
      if (!trade) return;
      // Mise à jour player_id des deux items
      await supabase.from('inventory').update({ player_id: trade.to_player_id }).eq('id', trade.offered_inv_id);
      await supabase.from('inventory').update({ player_id: trade.from_player_id }).eq('id', trade.requested_inv_id);
      // Si la carte était une chaîne, mettre à jour le propriétaire
      const offInv = trades.find(t=>t.id===tradeId)?.offered_inv;
      const reqInv = trades.find(t=>t.id===tradeId)?.requested_inv;
      if (offInv?.yt_channels) {
        const chId = (offInv.yt_channels as Record<string,string>).id;
        await supabase.from('yt_channels').update({ owner_id: trade.to_player_id }).eq('id', chId);
      }
      if (reqInv?.yt_channels) {
        const chId = (reqInv.yt_channels as Record<string,string>).id;
        await supabase.from('yt_channels').update({ owner_id: trade.from_player_id }).eq('id', chId);
      }
    }
    await supabase.from('trades').update({ status: accept ? 'accepted' : 'declined' }).eq('id', tradeId);
    showToast(accept ? '✅ Échange accepté !' : '❌ Échange refusé.');
    load();
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-purple-400 animate-pulse text-xl">Chargement...</div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 sm:pb-0 sm:pl-52 pt-14">
      <Navbar username={profile?.username ?? ''} tubes={profile?.tubes ?? 0} crystals={profile?.crystals ?? 0} />

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#13131a] border border-purple-600 text-purple-300 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm">
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* === LIST === */}
        {step === 'list' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-black text-white">🔄 Échanges</h1>
                <p className="text-gray-400 text-sm">Propose ou accepte des trades avec d'autres joueurs</p>
              </div>
              <button onClick={() => setStep('create_choose_mine')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-bold text-sm transition-all">
                + Proposer
              </button>
            </div>

            {trades.length === 0 ? (
              <p className="text-gray-500 text-center py-16">Aucun échange pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {trades.map(trade => {
                  const isFromMe = trade.from_player_id === profile?.id;
                  const isPending = trade.status === 'pending';
                  const statusColors: Record<string,string> = {
                    pending: 'text-amber-400', accepted: 'text-green-400',
                    declined: 'text-red-400', cancelled: 'text-gray-500'
                  };

                  return (
                    <div key={trade.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-gray-400">
                          <span className="text-white font-semibold">{(trade.from_profile as Record<string,string>)?.username}</span>
                          {' → '}
                          <span className="text-white font-semibold">{(trade.to_profile as Record<string,string>)?.username}</span>
                        </p>
                        <span className={`text-xs font-bold ${statusColors[trade.status]}`}>
                          {trade.status === 'pending' ? '⏳ En attente' : trade.status === 'accepted' ? '✅ Accepté' : trade.status === 'declined' ? '❌ Refusé' : '🚫 Annulé'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-gray-500 text-xs mb-1">Offre</p>
                          {trade.offered_inv?.cards && <MiniCard item={trade.offered_inv.cards} />}
                          {trade.offered_inv?.yt_channels && <MiniCard item={trade.offered_inv.yt_channels} isChannel />}
                        </div>
                        <span className="text-2xl">⇄</span>
                        <div className="flex-1">
                          <p className="text-gray-500 text-xs mb-1">Demande</p>
                          {trade.requested_inv?.cards && <MiniCard item={trade.requested_inv.cards} />}
                          {trade.requested_inv?.yt_channels && <MiniCard item={trade.requested_inv.yt_channels} isChannel />}
                        </div>
                      </div>

                      {isPending && !isFromMe && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => respondTrade(trade.id, true)}
                            className="flex-1 py-2 bg-green-700 hover:bg-green-600 rounded-xl text-white text-sm font-bold transition-all">
                            ✅ Accepter
                          </button>
                          <button onClick={() => respondTrade(trade.id, false)}
                            className="flex-1 py-2 bg-red-900/50 hover:bg-red-800/50 border border-red-800/50 rounded-xl text-red-400 text-sm font-bold transition-all">
                            ❌ Refuser
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* === CHOOSE MY CARD === */}
        {step === 'create_choose_mine' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setStep('list')} className="text-gray-400 hover:text-white">←</button>
              <h2 className="text-xl font-bold text-white">Quelle carte veux-tu offrir ?</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {myInv.map(inv => (
                <div key={inv.id} onClick={() => { setMyPick(inv); setStep('create_choose_target_user'); }}
                  className={`cursor-pointer rounded-xl border-2 transition-all hover:scale-105 ${
                    myPick?.id === inv.id ? 'border-purple-500' : 'border-transparent'
                  }`}>
                  {inv.yt_channels
                    ? <CardItem channel={inv.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="sm" />
                    : <CardItem card={inv.cards as Parameters<typeof CardItem>[0]['card']} size="sm" />
                  }
                </div>
              ))}
            </div>
          </>
        )}

        {/* === TARGET USER === */}
        {step === 'create_choose_target_user' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setStep('create_choose_mine')} className="text-gray-400 hover:text-white">←</button>
              <h2 className="text-xl font-bold text-white">Avec quel joueur ?</h2>
            </div>
            <div className="flex gap-3 max-w-sm">
              <input value={targetUser} onChange={e => setTargetUser(e.target.value)}
                placeholder="Pseudo du joueur"
                className="flex-1 bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm" />
              <button onClick={searchUser} disabled={searching || !targetUser}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl text-white font-bold text-sm transition-all">
                {searching ? '⏳' : 'Chercher'}
              </button>
            </div>
          </>
        )}

        {/* === CHOOSE THEIR CARD === */}
        {step === 'create_choose_theirs' && targetProfile && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setStep('create_choose_target_user')} className="text-gray-400 hover:text-white">←</button>
              <h2 className="text-xl font-bold text-white">Quelle carte de <span className="text-purple-400">{targetProfile.username}</span> veux-tu ?</h2>
            </div>
            {theirInv.length === 0 ? (
              <p className="text-gray-500">Ce joueur n'a pas encore de cartes.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {theirInv.map(inv => (
                  <div key={inv.id} onClick={() => { setTheirPick(inv); setStep('confirm'); }}
                    className="cursor-pointer rounded-xl border-2 border-transparent hover:border-purple-500 transition-all hover:scale-105">
                    {inv.yt_channels
                      ? <CardItem channel={inv.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="sm" />
                      : <CardItem card={inv.cards as Parameters<typeof CardItem>[0]['card']} size="sm" />
                    }
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* === CONFIRM === */}
        {step === 'confirm' && myPick && theirPick && targetProfile && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setStep('create_choose_theirs')} className="text-gray-400 hover:text-white">←</button>
              <h2 className="text-xl font-bold text-white">Confirmer l'échange</h2>
            </div>
            <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-6 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-2">Tu offres</p>
                  {myPick.yt_channels
                    ? <CardItem channel={myPick.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="sm" />
                    : <CardItem card={myPick.cards as Parameters<typeof CardItem>[0]['card']} size="sm" />
                  }
                </div>
                <span className="text-3xl">⇄</span>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-2">Tu reçois</p>
                  {theirPick.yt_channels
                    ? <CardItem channel={theirPick.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="sm" />
                    : <CardItem card={theirPick.cards as Parameters<typeof CardItem>[0]['card']} size="sm" />
                  }
                </div>
              </div>
              <p className="text-center text-gray-400 text-sm mt-4">
                Avec <span className="text-white font-semibold">{targetProfile.username}</span>
              </p>
              <button onClick={sendTrade}
                className="mt-5 w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-bold transition-all shadow-lg shadow-purple-900/30">
                🚀 Envoyer la proposition
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function MiniCard({ item, isChannel = false }: { item: Record<string, unknown>; isChannel?: boolean }) {
  const rarity = isChannel ? 'channel' : (item.rarity as string ?? 'basic');
  const cfg    = RARITY_CONFIG[rarity];
  return (
    <div className="flex items-center gap-2 bg-[#0a0a0f] border rounded-lg p-2" style={{ borderColor: cfg.color + '44' }}>
      <img src={item.thumbnail_url as string} alt=""
           className={`object-cover flex-shrink-0 ${isChannel ? 'w-8 h-8 rounded-full' : 'w-12 h-8 rounded'}`} />
      <div className="min-w-0">
        <p className="text-white text-xs font-semibold truncate">{isChannel ? item.channel_name as string : item.title as string}</p>
        <p className="text-xs" style={{ color: cfg.color }}>{cfg.emoji} {cfg.label}</p>
      </div>
    </div>
  );
}
