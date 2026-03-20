import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { SELL_PRICE } from '@/lib/game';

export async function POST(req: NextRequest) {
  const supabaseAdmin = createAdminClient();

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { inventoryId } = await req.json();

  const { data: inv } = await supabaseAdmin
    .from('inventory')
    .select('*, cards(*), yt_channels(*)')
    .eq('id', inventoryId)
    .eq('player_id', user.id)
    .single();

  if (!inv) return NextResponse.json({ error: 'Carte introuvable' }, { status: 404 });
  if (inv.is_active) return NextResponse.json({ error: 'Retire la carte de la ferme avant de la vendre' }, { status: 400 });
  if (inv.yt_channels) return NextResponse.json({ error: 'Les chaînes ne peuvent pas être vendues, seulement échangées' }, { status: 400 });

  const rarity = (inv.cards as Record<string, string>)?.rarity ?? 'basic';
  const price  = SELL_PRICE[rarity] ?? 10;

  await supabaseAdmin.from('inventory').delete().eq('id', inventoryId);

  const { data: profile } = await supabaseAdmin.from('profiles').select('tubes').eq('id', user.id).single();
  await supabaseAdmin.from('profiles').update({ tubes: (profile?.tubes ?? 0) + price }).eq('id', user.id);

  return NextResponse.json({ tubes: price });
}