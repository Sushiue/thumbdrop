import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { PASSIVE_INCOME } from '@/lib/game';

export async function POST(req: NextRequest) {
  const supabaseAdmin = createAdminClient();

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('tubes, last_income_collected').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  const lastCollected = new Date(profile.last_income_collected ?? 0);
  const hoursElapsed  = Math.min((Date.now() - lastCollected.getTime()) / 3_600_000, 24); // max 24h

  if (hoursElapsed < 0.016) // moins d'1 minute
    return NextResponse.json({ error: 'Reviens dans quelques minutes !' }, { status: 400 });

  // Cartes actives
  const { data: activeCards } = await supabaseAdmin
    .from('inventory')
    .select('*, cards(*), yt_channels(*)')
    .eq('player_id', user.id)
    .eq('is_active', true);

  if (!activeCards?.length)
    return NextResponse.json({ error: 'Aucune carte active dans la ferme' }, { status: 400 });

  let totalIncome = 0;
  for (const inv of activeCards) {
    const rarity = inv.yt_channels ? 'channel' : (inv.cards as Record<string,string>)?.rarity ?? 'basic';
    totalIncome += (PASSIVE_INCOME[rarity] ?? 2) * hoursElapsed;
  }

  const earned = Math.floor(totalIncome);
  await supabaseAdmin.from('profiles').update({
    tubes: (profile.tubes ?? 0) + earned,
    last_income_collected: new Date().toISOString(),
  }).eq('id', user.id);

  return NextResponse.json({ earned, hoursElapsed: Math.round(hoursElapsed * 10) / 10 });
}

export async function PUT(req: NextRequest) {
  // Toggle is_active sur une carte
  const supabaseAdmin = createAdminClient();

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { inventoryId, active } = await req.json();

  if (active) {
    // Vérifier qu'il y a moins de 5 cartes actives
    const { count } = await supabaseAdmin
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', user.id)
      .eq('is_active', true);
    if ((count ?? 0) >= 5)
      return NextResponse.json({ error: 'Maximum 5 cartes en même temps dans la ferme' }, { status: 400 });
  }

  await supabaseAdmin.from('inventory')
    .update({ is_active: active })
    .eq('id', inventoryId)
    .eq('player_id', user.id);

  return NextResponse.json({ ok: true });
}