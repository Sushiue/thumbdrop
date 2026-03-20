'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import CardItem from '@/components/CardItem';
import { RARITY_CONFIG, formatViewCount } from '@/lib/game';

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [data,    setData]    = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [myName,  setMyName]  = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('username').eq('id', user.id).single()
          .then(({ data }) => setMyName(data?.username ?? ''));
      }
    });

    fetch(`/api/profile?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [username, supabase]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-purple-400 animate-pulse text-xl">Chargement...</div>
    </div>
  );

  if (!data || data.error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center"><p className="text-4xl mb-3">👤</p><p className="text-gray-400">Profil introuvable</p>
        <Link href="/leaderboard" className="text-purple-400 text-sm mt-3 block hover:underline">← Retour au classement</Link>
      </div>
    </div>
  );

  const profile  = data.profile  as Record<string, unknown>;
  const featured = data.featured  as Record<string, unknown>[];
  const channels = data.channels  as Record<string, unknown>[];
  const wishlistVideoData   = data.wishlistVideoData   as Record<string, unknown> | null;
  const wishlistChannelData = data.wishlistChannelData as Record<string, unknown> | null;
  const isMe = myName === profile.username;

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-10">
      {/* Header */}
      <div className="bg-gradient-to-b from-purple-900/30 to-transparent px-4 pt-10 pb-6 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-3xl font-black text-white mx-auto mb-3">
          {(profile.username as string)[0].toUpperCase()}
        </div>
        <h1 className="text-2xl font-black text-white">{profile.username as string}</h1>
        <p className="text-gray-400 text-sm mt-1">{profile.total_cards as number} miniatures collectionnées</p>
        {isMe && (
          <Link href="/profile" className="inline-block mt-3 text-xs text-purple-400 border border-purple-700/40 rounded-full px-4 py-1 hover:bg-purple-900/20 transition-all">
            ✏️ Modifier mon profil
          </Link>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-6">

        {/* Cartes en vedette */}
        {featured.length > 0 && (
          <section className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
            <h2 className="text-white font-bold mb-4">⭐ Cartes en Vedette</h2>
            <div className="flex gap-4 flex-wrap justify-center">
              {featured.map((inv, i) => (
                <div key={i}>
                  {(inv.yt_channels as Record<string,unknown>)
                    ? <CardItem channel={inv.yt_channels as Parameters<typeof CardItem>[0]['channel']} size="md" />
                    : <CardItem card={inv.cards as Parameters<typeof CardItem>[0]['card']} size="md" />
                  }
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Chaînes possédées */}
        {channels.length > 0 && (
          <section className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
            <h2 className="text-white font-bold mb-4">📺 Chaînes Possédées</h2>
            <div className="space-y-3">
              {channels.map((ch: Record<string,unknown>) => (
                <div key={ch.id as string} className="flex items-center gap-3 bg-[#0a0a0f] border border-yellow-900/30 rounded-xl p-3">
                  <img src={ch.thumbnail_url as string} alt={ch.channel_name as string} className="w-10 h-10 rounded-full border-2 border-yellow-500" />
                  <div>
                    <p className="text-white font-bold text-sm">{ch.channel_name as string}</p>
                    <p className="text-yellow-400 text-xs">{formatViewCount(ch.subscriber_count as number)} abonnés</p>
                  </div>
                  <span className="ml-auto text-yellow-400 text-xs font-bold">📺 Exclusif</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Chaîne favorite */}
        {profile.favorite_channel && (
          <section className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
            <h2 className="text-white font-bold mb-2">🎯 Chaîne Favorite</h2>
            <p className="text-purple-400 font-semibold">{profile.favorite_channel as string}</p>
          </section>
        )}

        {/* Wishlist */}
        {(wishlistVideoData || wishlistChannelData) && (
          <section className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
            <h2 className="text-white font-bold mb-4">🎁 Wishlist</h2>
            <div className="space-y-4">
              {wishlistVideoData && (
                <div>
                  <p className="text-gray-400 text-xs mb-2">Vidéo souhaitée</p>
                  <div className="flex gap-3 items-center bg-[#0a0a0f] rounded-xl p-3 border border-[#2a2a3a]">
                    <img src={wishlistVideoData.thumbnail as string} alt="" className="w-20 h-12 rounded-lg object-cover" />
                    <div>
                      <p className="text-white text-sm font-semibold line-clamp-2">{wishlistVideoData.title as string}</p>
                      <p className="text-gray-400 text-xs">{wishlistVideoData.channelName as string}</p>
                    </div>
                  </div>
                </div>
              )}
              {wishlistChannelData && (
                <div>
                  <p className="text-gray-400 text-xs mb-2">Chaîne souhaitée</p>
                  <div className="flex gap-3 items-center bg-[#0a0a0f] rounded-xl p-3 border border-[#2a2a3a]">
                    <img src={wishlistChannelData.thumbnail as string} alt="" className="w-10 h-10 rounded-full" />
                    <p className="text-white font-semibold text-sm">{wishlistChannelData.name as string}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <Link href="/leaderboard" className="block text-center text-gray-500 text-sm hover:text-gray-300 transition-colors">
          ← Retour au classement
        </Link>
      </div>
    </div>
  );
}