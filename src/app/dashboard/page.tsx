'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import CardItem from '@/components/CardItem';

interface Profile   { id: string; username: string; tubes: number; crystals: number; total_cards: number; }
interface Mission   { id: string; progress: number; completed: boolean; claimed: boolean; expires_at: string; missions: { id: string; title: string; description: string; reward_tubes: number; reward_crystals: number; type: string; target_count: number; }; }
interface InvItem   { id: string; obtained_at: string; cards?: Record<string, unknown> | null; yt_channels?: Record<string, unknown> | null; }

export default function Dashboard() {
  const router   = useRouter();
  const supabase = createClient();

  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [recent,   setRecent]   = useState<InvItem[]>([]);
  const [toast,    setToast]    = useState('');
  const [loading,  setLoading]  = useState(true);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/missions/claim', {
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    const { missions: m } = await res.json();
    setMissions(m ?? []);

    const { data: inv } = await supabase
      .from('inventory')
      .select('*, cards(*), yt_channels(*)')
      .eq('player_id', user.id)
      .order('obtained_at', { ascending: false })
      .limit(8);
    setRecent(inv ?? []);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  async function claimMission(pmId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/missions/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ playerMissionId: pmId }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`+${data.reward.tubes} 🪙 +${data.reward.crystals} 💎`);
      loadData();
    } else { showToast(data.error); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-purple-400 text-xl animate-pulse">Chargement...</div>
    </div>
  );

  const daily  = missions.filter(m => m.missions?.type === 'daily');
  const weekly = missions.filter(m => m.missions?.type === 'weekly');

  return (
    <div className="min-h-screen pb-20 sm:pb-0 sm:pl-52 pt-14">
      <Navbar username={profile?.username ?? ''} tubes={profile?.tubes ?? 0} crystals={profile?.crystals ?? 0} />

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-900/90 border border-green-600 text-green-300 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm backdrop-blur">
          ✅ {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/20 border border-purple-800/30 rounded-2xl p-6">
          <h1 className="text-2xl font-black text-white mb-1">Bienvenue, <span className="text-purple-400">{profile?.username}</span> 👋</h1>
          <p className="text-gray-400 text-sm mb-4">Collectionne des miniatures YouTube légendaires !</p>
          <div className="flex flex-wrap gap-4">
            {[
              { label: 'Miniatures',  value: profile?.total_cards ?? 0, emoji: '🎴' },
              { label: 'Tubes',       value: (profile?.tubes ?? 0).toLocaleString(), emoji: '🪙' },
              { label: 'Cristaux',    value: profile?.crystals ?? 0, emoji: '💎' },
            ].map(s => (
              <div key={s.label} className="bg-[#13131a] border border-[#2a2a3a] rounded-xl px-5 py-3 text-center min-w-[90px]">
                <p className="text-2xl">{s.emoji}</p>
                <p className="text-white font-bold text-xl">{s.value}</p>
                <p className="text-gray-500 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <section>
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">☀️ Missions du Jour</h2>
          <div className="space-y-3">
            {daily.map(pm => <MissionCard key={pm.id} pm={pm} onClaim={claimMission} />)}
            {daily.length === 0 && <p className="text-gray-500 text-sm">Aucune mission quotidienne active.</p>}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">📅 Missions Hebdomadaires</h2>
          <div className="space-y-3">
            {weekly.map(pm => <MissionCard key={pm.id} pm={pm} onClaim={claimMission} />)}
            {weekly.length === 0 && <p className="text-gray-500 text-sm">Aucune mission hebdo active.</p>}
          </div>
        </section>

        {recent.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">🆕 Dernières Obtenues</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recent.map(inv => (
                inv.cards ? (
                  <CardItem key={inv.id} card={inv.cards as Parameters<typeof CardItem>[0]['card']} size="sm" />
                ) : inv.yt_channels ? (
                  <CardItem key={inv.id} channel={inv.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="sm" />
                ) : null
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function MissionCard({ pm, onClaim }: { pm: Mission; onClaim: (id: string) => void }) {
  const m        = pm.missions;
  const pct      = Math.min(100, Math.round((pm.progress / m.target_count) * 100));
  const timeLeft = new Date(pm.expires_at).getTime() - Date.now();
  const hours    = Math.floor(timeLeft / 3_600_000);

  return (
    <div className={`bg-[#13131a] border rounded-xl p-4 flex items-center gap-4 transition-all ${
      pm.completed && !pm.claimed ? 'border-green-600/50 bg-green-950/20' : 'border-[#2a2a3a]'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white font-semibold text-sm">{m.title}</span>
          <span className="text-xs text-gray-500 ml-auto whitespace-nowrap">{hours}h restantes</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">{m.description}</p>
        <div className="h-1.5 bg-[#2a2a3a] rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-gray-500 text-xs mt-1">{pm.progress}/{m.target_count}</p>
      </div>
      <div className="text-right flex-shrink-0">
        {m.reward_tubes    > 0 && <p className="text-amber-400 text-sm font-bold">+{m.reward_tubes} 🪙</p>}
        {m.reward_crystals > 0 && <p className="text-cyan-400 text-sm font-bold">+{m.reward_crystals} 💎</p>}
        {pm.completed && !pm.claimed && (
          <button onClick={() => onClaim(pm.id)}
            className="mt-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-white text-xs font-bold transition-all">
            Réclamer ✨
          </button>
        )}
        {pm.claimed && <span className="text-green-600 text-xs font-bold">✓ Réclamé</span>}
      </div>
    </div>
  );
}