import Image from 'next/image';
import { RARITY_CONFIG, formatViewCount } from '@/lib/game';

interface CardItemProps {
  card?: {
    video_id: string;
    title: string;
    thumbnail_url: string;
    channel_name: string;
    view_count: number;
    rarity: string;
  };
  channel?: {
    channel_id: string;
    channel_name: string;
    subscriber_count: number;
    thumbnail_url: string;
  };
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function CardItem({ card, channel, size = 'md', showLabel = true }: CardItemProps) {
  const isChannel = !!channel;
  const rarity = isChannel ? 'channel' : (card?.rarity ?? 'basic');
  const cfg    = RARITY_CONFIG[rarity];

  const sizeClasses = {
    sm:  'w-32',
    md:  'w-44',
    lg:  'w-56',
  };

  return (
    <div className={`${sizeClasses[size]} flex-shrink-0`}>
      <div className={`card-${rarity} border-2 rounded-xl overflow-hidden bg-[#13131a] transition-transform hover:scale-105 cursor-default`}
           style={{ borderColor: cfg.color }}>

        {/* Thumbnail / Avatar */}
        <div className="relative aspect-video bg-black">
          {isChannel ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-yellow-900/30 to-amber-900/30">
              <img src={channel!.thumbnail_url} alt={channel!.channel_name}
                   className="w-20 h-20 rounded-full border-4 object-cover" style={{ borderColor: cfg.color }} />
            </div>
          ) : (
            <img src={card!.thumbnail_url} alt={card!.title}
                 className="w-full h-full object-cover" loading="lazy" />
          )}

          {/* Rarity badge */}
          <div className="absolute top-1.5 right-1.5 text-xs font-bold px-1.5 py-0.5 rounded-md backdrop-blur"
               style={{ background: cfg.color + '33', color: cfg.color, border: `1px solid ${cfg.color}66` }}>
            {cfg.emoji} {cfg.label}
          </div>
        </div>

        {/* Info */}
        {showLabel && (
          <div className="p-2">
            {isChannel ? (
              <>
                <p className="text-white font-bold text-xs truncate">{channel!.channel_name}</p>
                <p className="text-gray-400 text-xs">{formatViewCount(channel!.subscriber_count)} abonnés</p>
                <p className="text-yellow-400 text-xs font-semibold mt-0.5">📺 Chaîne unique</p>
              </>
            ) : (
              <>
                <p className="text-white font-semibold text-xs truncate leading-tight">{card!.title}</p>
                <p className="text-gray-400 text-xs truncate">{card!.channel_name}</p>
                <p className="text-gray-500 text-xs">{formatViewCount(card!.view_count)} vues</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
