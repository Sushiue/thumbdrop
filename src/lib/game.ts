// ============================================================
// ThumbDrop — Game Logic
// ============================================================

export const RARITIES = ['basic','rare','super_rare','epic','mythic','legendary','ultra_legendary','secret'] as const;
export type Rarity = typeof RARITIES[number];

export const RARITY_CONFIG: Record<string, { label: string; color: string; glow: string; emoji: string }> = {
  basic:          { label: 'Basique',          color: '#9ca3af', glow: 'shadow-gray-400',   emoji: '⚪' },
  rare:           { label: 'Rare',             color: '#22c55e', glow: 'shadow-green-400',  emoji: '🟢' },
  super_rare:     { label: 'Super Rare',       color: '#3b82f6', glow: 'shadow-blue-400',   emoji: '🔵' },
  epic:           { label: 'Épique',           color: '#a855f7', glow: 'shadow-purple-400', emoji: '🟣' },
  mythic:         { label: 'Mythique',         color: '#f59e0b', glow: 'shadow-amber-400',  emoji: '🟡' },
  legendary:      { label: 'Légendaire',       color: '#ef4444', glow: 'shadow-red-400',    emoji: '🔴' },
  ultra_legendary:{ label: 'Ultra Légendaire', color: '#ec4899', glow: 'shadow-pink-400',   emoji: '🌟' },
  secret:         { label: 'Secret',           color: '#06b6d4', glow: 'shadow-cyan-400',   emoji: '✨' },
  channel:        { label: 'Chaîne YouTube',   color: '#ffd700', glow: 'shadow-yellow-400', emoji: '📺' },
};

// Rareté en fonction des vues
// Secret = vidéos avec MOINS de 100 vues (ultra obscures)
// Le reste est basé sur un seuil réduit
export function rarityFromViews(views: number): Rarity {
  if (views < 100)          return 'secret';        // < 100 vues → Secret ✨
  if (views >= 200_000_000) return 'ultra_legendary'; // 200M+
  if (views >= 50_000_000)  return 'legendary';      // 50M+
  if (views >= 10_000_000)  return 'mythic';         // 10M+
  if (views >= 1_000_000)   return 'epic';           // 1M+
  if (views >= 100_000)     return 'super_rare';     // 100K+
  if (views >= 10_000)      return 'rare';           // 10K+
  return 'basic';                                    // < 10K
}

// ===== PACKS =====
export const PACKS = {
  basic: {
    name: 'Basic Pack',
    description: 'Le classique — 3 miniatures aléatoires',
    cost: { tubes: 200, crystals: 0 },
    count: 3,
    emoji: '📦',
    color: 'from-gray-700 to-gray-900',
    rarityBoost: 0,
    channelChance: 0.02,   // 2%
  },
  premium: {
    name: 'Premium Pack',
    description: '5 miniatures — meilleures chances sur les raretés élevées',
    cost: { tubes: 500, crystals: 0 },
    count: 5,
    emoji: '🎁',
    color: 'from-blue-700 to-blue-900',
    rarityBoost: 1,
    channelChance: 0.05,   // 5%
  },
  crystal: {
    name: 'Crystal Pack',
    description: '5 miniatures — garantie Épique minimum + 10% chance Chaîne',
    cost: { tubes: 0, crystals: 15 },
    count: 5,
    emoji: '💎',
    color: 'from-purple-700 to-pink-900',
    rarityBoost: 2,
    channelChance: 0.10,   // 10%
    guaranteedMinRarity: 'epic' as Rarity,
  },
  weekly_reward: {
    name: 'Récompense Hebdo',
    description: 'Pack spécial mission hebdomadaire',
    cost: { tubes: 0, crystals: 0 },
    count: 4,
    emoji: '🏆',
    color: 'from-amber-600 to-orange-800',
    rarityBoost: 1,
    channelChance: 0.05,   // 5%
  },
} as const;

export type PackKey = keyof typeof PACKS;

// ===== YOUTUBE API =====
const SEARCH_QUERIES = [
  'most viewed youtube video', 'viral video', 'funny moments', 'gaming highlights',
  'music video official', 'trending video', 'epic fail compilation', 'world record',
  'amazing moments', 'best of youtube', 'popular film', 'viral clip 2023',
  'reaction video', 'tutorial popular', 'minecraft highlights',
  'movie trailer', 'sports best moments', 'cooking viral', 'science experiment',
  'documentary', 'animals funny', 'fails compilation', 'car review',
];

export async function fetchRandomYouTubeVideo(rarityBoost = 0) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not set');

  const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
  const maxResults = 25;

  // 1. Recherche — videoDuration=medium exclut les Shorts (< 4 min)
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&videoDuration=medium&key=${apiKey}`
  );
  const searchData = await searchRes.json();
  if (!searchData.items?.length) throw new Error('No YouTube results');

  // Sélection aléatoire
  const item = searchData.items[Math.floor(Math.random() * searchData.items.length)];
  const videoId = item.id.videoId;

  // 2. Statistiques
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoId}&key=${apiKey}`
  );
  const statsData = await statsRes.json();
  const video = statsData.items?.[0];
  if (!video) throw new Error('Video stats not found');

  // Double vérification : exclure les vidéos < 4 minutes (Shorts qui passent quand même)
  const duration = video.contentDetails?.duration as string ?? '';
  const isShort  = /^PT(\d+S|[0-3]M\d*S?)$/.test(duration);
  if (isShort) throw new Error('Short detected, retry');

  const viewCount = parseInt(video.statistics.viewCount || '0', 10);
  const likeCount = parseInt(video.statistics.likeCount || '0', 10);

  // Rareté avec boost
  const boostedViews = rarityBoost === 0 ? viewCount
    : rarityBoost === 1 ? viewCount * 3
    : viewCount * 10;

  return {
    videoId,
    title:        video.snippet.title as string,
    thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url as string,
    channelName:  video.snippet.channelTitle as string,
    channelId:    video.snippet.channelId as string,
    viewCount,
    likeCount,
    rarity:       rarityFromViews(boostedViews),
  };
}

export async function fetchRandomYouTubeChannel() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not set');

  const popularChannels = [
    'UCX6OQ3DkcsbYNE6H8uQQuVA', // MrBeast
    'UCVtFOytbRpEvzLjvqGG5gxQ', // Markiplier
    'UC-lHJZR3Gqxm24_Vd_AJ5Yw', // PewDiePie
    'UCq-Fj5jknLsUf-MWSy4_brA', // T-Series
    'UC29ju8bIPH5as8OGnQzwJyA', // Jacksepticeye
    'UChXi_PlJkRMPYFQBOJ3MpxA', // Ninja
    'UCnUYZLuoy1rq1aVMwx4aTzw', // Graham Stephan
    'UC0C-w0YjGpqDXGB8IHb662A', // PewDiePie Alt
    'UCpko_-a4wgz2u_DgDgd9fqA', // Sssniperwolf
    'UCY30JRSgfhYXA6i6xX1erWg', // Philza
    'UCddiUEpeqJcYeBxX1IVBKvQ', // TheOdd1sOut
    'UCbmNph6atAoGfqLoCL_duAg', // Veritasium
    'UCsXVk37bltHxD1rDPwtNM8Q', // Kurzgesagt
    'UCJXGnmNKr_8pEi1HwYOCUvQ', // Vsauce
    'UCHnyfMqiRRG1u-2MsSQLbXA', // Vsauce2
    'UCWX3yGbODM3pzEoSMQNrBLg', // Dude Perfect
    'UCo8bcnLyZH8tBIH9V1mLgqQ', // Dream
    'UC7_YxT-KID8kRbqZo7MyscQ', // Markiplier 2
    'UCam8T03EOFBsNdR2thrHhtA', // Linus Tech Tips
  ];

  const channelId = popularChannels[Math.floor(Math.random() * popularChannels.length)];

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
  );
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) throw new Error('Channel not found');

  return {
    channelId:       ch.id as string,
    channelName:     ch.snippet.title as string,
    subscriberCount: parseInt(ch.statistics.subscriberCount || '0', 10),
    thumbnailUrl:    ch.snippet.thumbnails?.high?.url || ch.snippet.thumbnails?.default?.url as string,
  };
}

// ===== MISSIONS =====
export function getDailyExpiry(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function getWeeklyExpiry(): Date {
  const d = new Date();
  const day = d.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function formatViewCount(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function formatSubCount(n: number): string {
  return formatViewCount(n);
}