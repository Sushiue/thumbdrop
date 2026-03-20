'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import CardItem from '@/components/CardItem';
import { RARITY_CONFIG } from '@/lib/game';

interface Profile { id: string; username: string; tubes: number; crystals: number; total_cards: number; favorite_channel: string; featured_inv_1: string; featured_inv_2: string; featured_inv_3: string; wishlist_video: string; wishlist_channel: string; }
interface InvItem { id: string; cards?: Record<string, unknown> | null; yt_channels?: Record<string, unknown> | null; }

export default function ProfilePage() {
  const router   = useRouter();
  const supabase = createClient();

  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [toast,     setToast]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [wishlistVideo,   setWishlistVideo]   = useState('');
  const [wishlistChannel, setWishlistChannel] = useState('');
  const [featured,  setFeatured]  = useState<(string | null)[]>([null, null, null]);
  const [picking,   setPicking]   = useState<number | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);
    setWishlistVideo(prof?.wishlist_video ?? '');
    setWishlistChannel(prof?.wishlist_channel ?? '');
    setFeatured([prof?.featured_inv_1 ?? null, prof?.featured_inv_2 ?? null, prof?.featured_inv_3 ?? null]);

    const { data: inv } = await supabase
      .from('inventory').select('*, cards(*), yt_channels(*)')
      .eq('player_id', user.id).order('obtained_at', { ascending: false });
    setInventory(inv ?? []);
  }, [supabase, router]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        featured_inv_1:  featured[0],
        featured_inv_2:  featured[1],
        featured_inv_3:  featured[2],
        wishlist_video:  wishlistVideo,
        wishlist_channel: wishlistChannel,
      }),
    });
    setSaving(false);
    showToast('Profil sauvegardé !');
    load();
  }

  function pickFeatured(slot: number, invId: string) {
    setFeatured(prev => { const n = [...prev]; n[slot] = invId; return n; });
    setPicking(null);
  }

  const featuredItems = featured.map(id => inventory.find(i => i.id === id) ?? null);

  return (
    <div className="min-h-screen pb-20 sm:pb-0 sm:pl-52 pt-14">
      <Navbar username={profile?.username ?? ''} tubes={profile?.tubes ?? 0} crystals={profile?.crystals ?? 0} />

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-900/90 border border-green-600 text-green-300 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm">
          ✅ {toast}
        </div>
      )}

      {/* Picker modal */}
      {picking !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur p-4 overflow-y-auto" onClick={() => setPicking(null)}>
          <div className="max-w-2xl mx-auto bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-6 mt-10" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-4">Choisis une carte pour le slot {picking + 1}</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {inventory.map(inv => (
                <div key={inv.id} onClick={() => pickFeatured(picking, inv.id)} className="cursor-pointer hover:scale-105 transition-transform">
                  {inv.yt_channels
                    ? <CardItem channel={inv.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="sm" />
                    : <CardItem card={inv.cards as Parameters<typeof CardItem>[0]['card']} size="sm" />
                  }
                </div>
              ))}
            </div>
            <button onClick={() => setPicking(null)} className="mt-4 w-full py-2 bg-[#1e1e2a] border border-[#2a2a3a] text-gray-400 rounded-xl text-sm">Annuler</button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">👤 Mon Profil</h1>
          <p className="text-gray-400 text-sm">Personnalise ce que les autres voient sur ton profil</p>
        </div>

        {/* Cartes en vedette */}
        <section className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
          <h2 className="text-white font-bold mb-1">⭐ Cartes en Vedette</h2>
          <p className="text-gray-500 text-xs mb-4">3 miniatures affichées sur ton profil public</p>
          <div className="flex gap-4 flex-wrap">
            {[0, 1, 2].map(slot => (
              <div key={slot} onClick={() => setPicking(slot)}
                className="cursor-pointer hover:scale-105 transition-transform">
                {featuredItems[slot] ? (
                  <div className="relative">
                    {featuredItems[slot]!.yt_channels
                      ? <CardItem channel={featuredItems[slot]!.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="sm" />
                      : <CardItem card={featuredItems[slot]!.cards as Parameters<typeof CardItem>[0]['card']} size="sm" />
                    }
                    <div className="absolute top-1 right-1 bg-black/70 rounded-full w-5 h-5 flex items-center justify-center text-xs text-red-400 hover:text-red-300"
                      onClick={e => { e.stopPropagation(); setFeatured(prev => { const n = [...prev]; n[slot] = null; return n; }); }}>✕</div>
                  </div>
                ) : (
                  <div className="w-32 h-48 border-2 border-dashed border-[#2a2a3a] hover:border-purple-600 rounded-xl flex items-center justify-center text-gray-600 hover:text-purple-400 transition-all">
                    <div className="text-center"><p className="text-2xl">+</p><p className="text-xs mt-1">Slot {slot + 1}</p></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Wishlist */}
        <section className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-bold mb-1">🎯 Wishlist</h2>
          <p className="text-gray-500 text-xs mb-4">Une vidéo et une chaîne que tu aimerais obtenir</p>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Vidéo souhaitée (titre)</label>
            <input value={wishlistVideo} onChange={e => setWishlistVideo(e.target.value)}
              placeholder="Ex: Gangnam Style, Baby Shark..."
              className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm" />
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Chaîne souhaitée</label>
            <input value={wishlistChannel} onChange={e => setWishlistChannel(e.target.value)}
              placeholder="Ex: MrBeast, Squeezie..."
              className="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm" />
          </div>
        </section>

        {/* Chaîne favorite */}
        {profile?.favorite_channel && (
          <section className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
            <h2 className="text-white font-bold mb-2">🎯 Chaîne Favorite</h2>
            <p className="text-purple-400 font-semibold">{profile.favorite_channel}</p>
            <p className="text-gray-500 text-xs mt-1">Modifiable dans la Boutique</p>
          </section>
        )}

        <button onClick={save} disabled={saving}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl text-white font-bold transition-all shadow-lg shadow-purple-900/30">
          {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder le profil'}
        </button>

        {/* Aperçu */}
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
          <p className="text-gray-500 text-xs mb-2">🔗 Ton profil public :</p>
          <a href={`/u/${profile?.username}`} target="_blank"
            className="text-purple-400 hover:underline text-sm font-semibold">
            thumbdrop-one.vercel.app/u/{profile?.username}
          </a>
        </div>
      </div>
    </div>
  );
}