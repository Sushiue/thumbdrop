import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PACKS, fetchRandomYouTubeVideo, fetchRandomYouTubeChannel, PackKey, RARITIES } from '@/lib/game';

const RARITY_ORDER = ['basic','rare','super_rare','epic','mythic','legendary','ultra_legendary','secret'];

export async function POST(req: NextRequest) {
  const supabase      = createClient();
  const supabaseAdmin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { packKey } = await req.json() as { packKey: PackKey };
  const pack = PACKS[packKey];
  if (!pack) return NextResponse.json({ error: 'Pack inconnu' }, { status: 400 });

  // Vérifier les fonds
  const { data: profile } = await supabase
    .from('profiles')
    .select('tubes, crystals')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  if (pack.cost.tubes > 0 && profile.tubes < pack.cost.tubes)
    return NextResponse.json({ error: 'Pas assez de Tubes 🪙' }, { status: 400 });
  if (pack.cost.crystals > 0 && profile.crystals < pack.cost.crystals)
    return NextResponse.json({ error: 'Pas assez de Cristaux 💎' }, { status: 400 });

  // Débiter
  await supabaseAdmin.from('profiles').update({
    tubes:    profile.tubes    - pack.cost.tubes,
    crystals: profile.crystals - pack.cost.crystals,
  }).eq('id', user.id);

  // Générer les cartes
  const results: Array<{ type: 'card' | 'channel'; data: Record<string, unknown> }> = [];

  for (let i = 0; i < pack.count; i++) {
    const roll = Math.random();
    const isChannel = roll < pack.channelChance;

    try {
      if (isChannel) {
        // Tenter d'obtenir une chaîne
        const chData = await fetchRandomYouTubeChannel();

        // Vérifier si déjà possédée
        const { data: existing } = await supabaseAdmin
          .from('yt_channels')
          .select('id, owner_id, channel_name, subscriber_count, thumbnail_url')
          .eq('channel_id', chData.channelId)
          .single();

        if (existing && existing.owner_id) {
          // Chaîne déjà prise → carte normale à la place
          const video = await fetchRandomYouTubeVideo(pack.rarityBoost ?? 0);
          const card  = await upsertCard(supabaseAdmin, video);
          await supabaseAdmin.from('inventory').insert({ player_id: user.id, card_id: card.id });
          results.push({ type: 'card', data: card });
        } else {
          // Nouvelle chaîne ou non possédée
          let channelRow = existing;
          if (!channelRow) {
            const { data: inserted } = await supabaseAdmin.from('yt_channels').insert({
              channel_id:      chData.channelId,
              channel_name:    chData.channelName,
              subscriber_count: chData.subscriberCount,
              thumbnail_url:   chData.thumbnailUrl,
              owner_id:        user.id,
              obtained_at:     new Date().toISOString(),
            }).select().single();
            channelRow = inserted;
          } else {
            await supabaseAdmin.from('yt_channels').update({
              owner_id:   user.id,
              obtained_at: new Date().toISOString(),
            }).eq('id', channelRow.id);
            channelRow = { ...channelRow, owner_id: user.id };
          }
          await supabaseAdmin.from('inventory').insert({ player_id: user.id, channel_id: channelRow!.id });
          results.push({ type: 'channel', data: channelRow! });
        }
      } else {
        const video = await fetchRandomYouTubeVideo(pack.rarityBoost ?? 0);

        // Garantie de rareté minimale (Crystal pack)
        let finalVideo = video;
        const minRarity = (pack as { guaranteedMinRarity?: string }).guaranteedMinRarity;
        if (minRarity && RARITY_ORDER.indexOf(video.rarity) < RARITY_ORDER.indexOf(minRarity)) {
          // Re-roll jusqu'à 3 fois pour essayer d'atteindre la rareté min
          for (let r = 0; r < 3; r++) {
            const retry = await fetchRandomYouTubeVideo((pack.rarityBoost ?? 0) + 1);
            if (RARITY_ORDER.indexOf(retry.rarity) >= RARITY_ORDER.indexOf(minRarity)) {
              finalVideo = retry;
              break;
            }
          }
        }

        const card = await upsertCard(supabaseAdmin, finalVideo);
        await supabaseAdmin.from('inventory').insert({ player_id: user.id, card_id: card.id });
        results.push({ type: 'card', data: card });
      }
    } catch (err) {
      console.error('Error fetching card', err);
      // Carte placeholder si l'API YouTube échoue
      results.push({ type: 'card', data: { error: true, rarity: 'basic' } });
    }
  }

  // Mettre à jour total_cards
  await supabaseAdmin.from('profiles')
    .update({ total_cards: (profile as unknown as { total_cards: number }).total_cards + results.length })
    .eq('id', user.id);

  // Mettre à jour progression missions
  await updateMissionProgress(supabaseAdmin, user.id, 'open_pack', 1);
  await updateMissionProgress(supabaseAdmin, user.id, 'collect_cards', results.length);

  // Vérifier si une carte épique+ a été obtenue
  const hasEpicPlus = results.some(r =>
    r.type === 'card' &&
    ['epic','mythic','legendary','ultra_legendary','secret'].includes((r.data as Record<string, string>).rarity)
  );
  if (hasEpicPlus) await updateMissionProgress(supabaseAdmin, user.id, 'reach_rarity', 1);

  return NextResponse.json({ results });
}

async function upsertCard(supabase: ReturnType<typeof createAdminClient>, video: Awaited<ReturnType<typeof fetchRandomYouTubeVideo>>) {
  const { data: existing } = await supabase.from('cards').select().eq('video_id', video.videoId).single();
  if (existing) return existing;

  const { data } = await supabase.from('cards').insert({
    video_id:      video.videoId,
    title:         video.title,
    thumbnail_url: video.thumbnailUrl,
    channel_name:  video.channelName,
    view_count:    video.viewCount,
    like_count:    video.likeCount,
    rarity:        video.rarity,
  }).select().single();

  return data!;
}

async function updateMissionProgress(supabase: ReturnType<typeof createAdminClient>, playerId: string, action: string, amount: number) {
  const now = new Date().toISOString();

  const { data: activeMissions } = await supabase
    .from('player_missions')
    .select('*, missions(*)')
    .eq('player_id', playerId)
    .eq('completed', false)
    .gt('expires_at', now);

  if (!activeMissions) return;

  for (const pm of activeMissions) {
    const mission = (pm as Record<string, unknown>).missions as Record<string, unknown>;
    if (mission?.action !== action) continue;
    const newProgress = Math.min((pm.progress as number) + amount, mission.target_count as number);
    const completed   = newProgress >= (mission.target_count as number);
    await supabase.from('player_missions').update({ progress: newProgress, completed }).eq('id', pm.id);
  }
}
