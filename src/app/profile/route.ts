import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabaseAdmin = createAdminClient();
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  const id       = searchParams.get('id');

  let query = supabaseAdmin.from('profiles').select(`
    id, username, total_cards, favorite_channel,
    wishlist_video, wishlist_channel,
    featured_inv_1, featured_inv_2, featured_inv_3
  `);

  if (username) query = query.eq('username', username) as typeof query;
  else if (id)  query = query.eq('id', id) as typeof query;
  else return NextResponse.json({ error: 'Paramètre manquant' }, { status: 400 });

  const { data: profile } = await query.single();
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  // Récupérer les 3 cartes mises en avant
  const featuredIds = [profile.featured_inv_1, profile.featured_inv_2, profile.featured_inv_3].filter(Boolean);
  let featured: Record<string, unknown>[] = [];
  if (featuredIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('inventory').select('*, cards(*), yt_channels(*)')
      .in('id', featuredIds);
    featured = (data ?? []) as Record<string, unknown>[];
  }

  // Récupérer les chaînes possédées
  const { data: channels } = await supabaseAdmin
    .from('yt_channels').select('*').eq('owner_id', profile.id);

  // Chercher la vidéo wishlist sur YouTube si définie
  let wishlistVideoData = null;
  if (profile.wishlist_video && process.env.YOUTUBE_API_KEY) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(profile.wishlist_video)}&type=video&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      const item = data.items?.[0];
      if (item) wishlistVideoData = {
        title:        item.snippet.title,
        thumbnail:    item.snippet.thumbnails?.high?.url,
        channelName:  item.snippet.channelTitle,
        videoId:      item.id.videoId,
      };
    } catch {}
  }

  // Chercher la chaîne wishlist
  let wishlistChannelData = null;
  if (profile.wishlist_channel && process.env.YOUTUBE_API_KEY) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(profile.wishlist_channel)}&type=channel&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      const item = data.items?.[0];
      if (item) wishlistChannelData = {
        name:      item.snippet.title,
        thumbnail: item.snippet.thumbnails?.high?.url,
        channelId: item.id.channelId,
      };
    } catch {}
  }

  return NextResponse.json({
    profile,
    featured,
    channels: channels ?? [],
    wishlistVideoData,
    wishlistChannelData,
  });
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = createAdminClient();
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const allowed = ['featured_inv_1','featured_inv_2','featured_inv_3','wishlist_video','wishlist_channel'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key] || null;
  }

  await supabaseAdmin.from('profiles').update(update).eq('id', user.id);
  return NextResponse.json({ ok: true });
}