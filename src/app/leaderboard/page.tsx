'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';

interface Profile { id: string; username: string; tubes: number; crystals: number; total_cards: number; }
interface LBEntry { id: string; username: string; total_cards: number; legendary_count: number; ultra_legendary_count: number; secret_count: number; channel_count: number; }

const MEDALS = ['🥇','🥈','🥉'];

export default function LeaderboardPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [board,   setBoard]   = useState<LBEntry[]>([]);
  const [myRank,  setMyRank]  = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);

    const res  = await fetch('/api/leaderboard');
    const data = await res.json();
    setBoard(data.leaderboard ?? []);

    const rank = (data.leaderboard as LBEntry[]).findIndex(e => e.id === user.id);
    setMyRank(rank >= 0 ? rank + 1 : null);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-purple-400 animate-pulse text-xl">Chargement...</div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 sm:pb-0 sm:pl-52 pt-14">
      <Navbar username={profile?.username ?? ''} tubes={profile?.tubes ?? 0} crystals={profile?.crystals ?? 0} />

      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-black text-white mb-1">🏆 Classement Global</h1>
        <p className="text-gray-400 text-sm mb-6">Clique sur un joueur pour voir son profil</p>

        {myRank && (
          <div className="mb-6 bg-purple-900/20 border border-purple-700/30 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-white font-bold">Ton classement : #{myRank}</p>
              <p className="text-gray-400 text-sm">{profile?.total_cards} miniatures collectionnées</p>
            </div>
          </div>
        )}

        {/* Top 3 podium */}
        {board.length >= 3 && (
          <div className="flex items-end justify-center gap-4 mb-8">
            {[board[1], board[0], board[2]].map((entry, i) => {
              const positions = [2, 1, 3];
              const heights   = ['h-24', 'h-32', 'h-20'];
              const pos       = positions[i];
              return (
                <Link key={entry.id} href={`/u/${entry.username}`} className="flex flex-col items-center hover:scale-105 transition-transform">
                  <span className="text-2xl mb-1">{MEDALS[pos - 1]}</span>
                  <div className={`${entry.id === profile?.id ? 'bg-purple-900/40 border-purple-600' : 'bg-[#13131a] border-[#2a2a3a]'} border rounded-xl ${heights[i]} w-24 flex flex-col items-center justify-center gap-1 transition-all`}>
                    <p className="text-white font-bold text-xs text-center px-1 truncate w-full text-center">{entry.username}</p>
                    <p className="text-purple-300 text-xs font-bold">{entry.total_cards} 🎴</p>
                    {entry.channel_count > 0 && <p className="text-yellow-400 text-xs">{entry.channel_count} 📺</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Full list */}
        <div className="space-y-2">
          {board.map((entry, i) => (
            <Link key={entry.id} href={`/u/${entry.username}`}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all hover:border-purple-600/40 ${
                entry.id === profile?.id
                  ? 'bg-purple-900/20 border-purple-700/40'
                  : 'bg-[#13131a] border-[#2a2a3a] hover:border-[#3a3a4a]'
              }`}>
              <span className="text-lg w-7 text-center flex-shrink-0">
                {i < 3 ? MEDALS[i] : <span className="text-gray-500 text-sm font-bold">#{i + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm truncate ${entry.id === profile?.id ? 'text-purple-300' : 'text-white'}`}>
                  {entry.username} {entry.id === profile?.id && '(toi)'}
                </p>
                <div className="flex flex-wrap gap-2 mt-0.5">
                  {entry.channel_count > 0 && <span className="text-yellow-400 text-xs">{entry.channel_count} 📺</span>}
                  {entry.secret_count > 0 && <span className="text-cyan-400 text-xs">{entry.secret_count} ✨</span>}
                  {entry.ultra_legendary_count > 0 && <span className="text-pink-400 text-xs">{entry.ultra_legendary_count} 🌟</span>}
                  {entry.legendary_count > 0 && <span className="text-red-400 text-xs">{entry.legendary_count} 🔴</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white font-bold">{entry.total_cards}</p>
                <p className="text-gray-500 text-xs">cartes</p>
              </div>
            </Link>
          ))}
          {board.length === 0 && (
            <p className="text-center text-gray-500 py-12">Aucun joueur pour le moment. Sois le premier !</p>
          )}
        </div>
      </div>
    </div>
  );
}