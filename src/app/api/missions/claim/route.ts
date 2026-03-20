import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getDailyExpiry, getWeeklyExpiry } from '@/lib/game';

async function getUser(req: NextRequest) {
  const supabaseAdmin = createAdminClient();
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

export async function GET(req: NextRequest) {
  const supabaseAdmin = createAdminClient();
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const now = new Date().toISOString();
  const { data: allMissions } = await supabaseAdmin.from('missions').select('*');
  if (!allMissions) return NextResponse.json({ missions: [] });

  const { data: active } = await supabaseAdmin
    .from('player_missions').select('*, missions(*)')
    .eq('player_id', user.id).gt('expires_at', now);

  const activeIds = (active ?? []).map((pm: Record<string, unknown>) => (pm.missions as Record<string, unknown>)?.id);

  for (const mission of allMissions) {
    if (activeIds.includes(mission.id)) continue;
    const expires_at = mission.type === 'daily' ? getDailyExpiry().toISOString() : getWeeklyExpiry().toISOString();
    await supabaseAdmin.from('player_missions').insert({
      player_id: user.id, mission_id: mission.id, expires_at,
    });
  }

  const { data: current } = await supabaseAdmin
    .from('player_missions').select('*, missions(*)')
    .eq('player_id', user.id).gt('expires_at', now).order('created_at');

  return NextResponse.json({ missions: current ?? [] });
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = createAdminClient();
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { playerMissionId } = await req.json();

  const { data: pm } = await supabaseAdmin
    .from('player_missions').select('*, missions(*)')
    .eq('id', playerMissionId).eq('player_id', user.id).single();

  if (!pm)          return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
  if (!pm.completed) return NextResponse.json({ error: 'Mission non complétée' }, { status: 400 });
  if (pm.claimed)    return NextResponse.json({ error: 'Déjà réclamée' }, { status: 400 });

  const mission = pm.missions as Record<string, number>;
  const { data: profile } = await supabaseAdmin.from('profiles').select('tubes, crystals').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  await supabaseAdmin.from('profiles').update({
    tubes:    (profile.tubes    as number) + mission.reward_tubes,
    crystals: (profile.crystals as number) + mission.reward_crystals,
  }).eq('id', user.id);

  await supabaseAdmin.from('player_missions').update({ claimed: true }).eq('id', playerMissionId);

  return NextResponse.json({ reward: { tubes: mission.reward_tubes, crystals: mission.reward_crystals } });
}