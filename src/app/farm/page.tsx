'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import CardItem from '@/components/CardItem';
import { PASSIVE_INCOME, RARITY_CONFIG } from '@/lib/game';

interface Profile { id: string; username: string; tubes: number; crystals: number; total_cards: number; last_income_collected: string; }
interface InvItem  { id: string; is_active: boolean; cards?: Record<string, unknown> | null; yt_channels?: Record<string, unknown> | null; }

export default function FarmPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [inventory,  setInventory]  = useState<InvItem[]>([]);
  const [toast,      setToast]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [collecting, setCollecting] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);
    const { data: inv } = await supabase
      .from('inventory').select('*, cards(*), yt_channels(*)')
      .eq('player_id', user.id).order('is_active', { ascending: false });
    setInventory(inv ?? []);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(inv: InvItem) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/collect-income', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ inventoryId: inv.id, active: !inv.is_active }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error); return; }
    load();
  }

  async function collectIncome() {
    setCollecting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/collect-income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    });
    const data = await res.json();
    setCollecting(false);
    if (!res.ok) { showToast(data.error); return; }
    showToast(`+${data.earned} 🪙 collectés (${data.hoursElapsed}h)`);
    load();
  }

  const activeCards   = inventory.filter(i => i.is_active);
  const inactiveCards = inventory.filter(i => !i.is_active);

  const incomePerHour = activeCards.reduce((sum, inv) => {
    const rarity = inv.yt_channels ? 'channel' : (inv.cards as Record<string,string>)?.rarity ?? 'basic';
    return sum + (PASSIVE_INCOME[rarity] ?? 2);
  }, 0);

  const hoursElapsed = profile
    ? Math.min((Date.now() - new Date(profile.last_income_collected).getTime()) / 3_600_000, 24)
    : 0;
  const pendingIncome = Math.floor(incomePerHour * hoursElapsed);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-purple-400 animate-pulse text-xl">Chargement...</div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 sm:pb-0 sm:pl-52 pt-14">
      <Navbar username={profile?.username ?? ''} tubes={profile?.tubes ?? 0} crystals={profile?.crystals ?? 0} />

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-900/90 border border-green-600 text-green-300 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm">
          ✅ {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-black text-white mb-1">🌾 Ferme à Tubes</h1>
        <p className="text-gray-400 text-sm mb-6">Place jusqu'à 5 cartes pour générer des Tubes à l'heure !</p>

        {/* Revenus en attente */}
        <div className="bg-gradient-to-r from-amber-900/30 to-yellow-900/20 border border-amber-700/30 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-amber-400 text-3xl font-black">+{pendingIncome} 🪙</p>
              <p className="text-gray-400 text-sm">En attente ({Math.round(hoursElapsed * 10) / 10}h)</p>
              <p className="text-gray-500 text-xs mt-1">{incomePerHour} 🪙/heure • Max 24h de stockage</p>
            </div>
            <button
              onClick={collectIncome}
              disabled={collecting || pendingIncome === 0}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-black font-black text-sm transition-all shadow-lg shadow-amber-900/30">
              {collecting ? '⏳' : '💰 Collecter'}
            </button>
          </div>
        </div>

        {/* Slots actifs */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-3">
            ⚡ Cartes actives <span className="text-gray-500 font-normal text-sm">({activeCards.length}/5)</span>
          </h2>
          {activeCards.length === 0 ? (
            <div className="border-2 border-dashed border-[#2a2a3a] rounded-2xl p-8 text-center text-gray-500">
              Aucune carte active. Sélectionne des cartes ci-dessous !
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {activeCards.map(inv => {
                const rarity = inv.yt_channels ? 'channel' : (inv.cards as Record<string,string>)?.rarity ?? 'basic';
                const income = PASSIVE_INCOME[rarity] ?? 2;
                return (
                  <div key={inv.id} className="relative cursor-pointer" onClick={() => toggleActive(inv)}>
                    {inv.yt_channels
                      ? <CardItem channel={inv.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="sm" />
                      : <CardItem card={inv.cards as Parameters<typeof CardItem>[0]['card']} size="sm" />
                    }
                    <div className="absolute top-1 left-1 bg-black/70 rounded-lg px-2 py-0.5 text-xs font-bold text-amber-400">
                      +{income}/h
                    </div>
                    <div className="absolute bottom-8 inset-x-0 flex justify-center">
                      <span className="text-xs bg-red-900/80 text-red-300 px-2 py-0.5 rounded-full">Retirer</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inventaire disponible */}
        <div>
          <h2 className="text-lg font-bold text-white mb-3">🎴 Ton inventaire</h2>
          {inactiveCards.length === 0 ? (
            <p className="text-gray-500 text-sm">Toutes tes cartes sont dans la ferme !</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {inactiveCards.map(inv => {
                const rarity = inv.yt_channels ? 'channel' : (inv.cards as Record<string,string>)?.rarity ?? 'basic';
                const income = PASSIVE_INCOME[rarity] ?? 2;
                const canAdd = activeCards.length < 5;
                return (
                  <div key={inv.id}
                    onClick={() => canAdd && toggleActive(inv)}
                    className={`relative ${canAdd ? 'cursor-pointer hover:scale-105' : 'opacity-50 cursor-not-allowed'} transition-transform`}>
                    {inv.yt_channels
                      ? <CardItem channel={inv.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="sm" />
                      : <CardItem card={inv.cards as Parameters<typeof CardItem>[0]['card']} size="sm" />
                    }
                    <div className="absolute top-1 left-1 bg-black/70 rounded-lg px-2 py-0.5 text-xs font-bold text-amber-400">
                      +{income}/h
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Table des revenus */}
        <div className="mt-10 bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
          <h3 className="text-white font-bold mb-3">📊 Revenus par rareté</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(PASSIVE_INCOME).map(([rarity, income]) => {
              const cfg = RARITY_CONFIG[rarity];
              if (!cfg) return null;
              return (
                <div key={rarity} className="flex items-center gap-2 bg-[#0a0a0f] rounded-xl px-3 py-2">
                  <span>{cfg.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
                    <p className="text-amber-400 text-xs font-bold">+{income} 🪙/h</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}