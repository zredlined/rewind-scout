import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const body = await req.json();
  const joinCode = (body.joinCode ?? '').trim();
  const displayName = (body.displayName ?? '').trim();

  if (!joinCode || !displayName) {
    return NextResponse.json({ error: 'joinCode and displayName are required' }, { status: 400 });
  }

  // Look up team by join code
  const { data: team, error: teamErr } = await supabaseAdmin
    .from('teams')
    .select('id, team_number, team_name')
    .eq('join_code', joinCode)
    .maybeSingle();

  if (teamErr) {
    return NextResponse.json({ error: teamErr.message }, { status: 500 });
  }
  if (!team) {
    return NextResponse.json({ error: 'Invalid team code' }, { status: 404 });
  }

  // Upsert scout (insert or return existing)
  const { data: scout, error: scoutErr } = await supabaseAdmin
    .from('scouts')
    .upsert(
      { team_id: team.id, display_name: displayName },
      { onConflict: 'team_id,display_name' }
    )
    .select('id')
    .single();

  if (scoutErr) {
    return NextResponse.json({ error: scoutErr.message }, { status: 500 });
  }

  // Create session cookie
  await createSession({
    id: scout.id,
    displayName,
    teamId: team.id,
    teamNumber: team.team_number,
    teamName: team.team_name,
  });

  return NextResponse.json({
    user: {
      id: scout.id,
      displayName,
      teamId: team.id,
      teamNumber: team.team_number,
      teamName: team.team_name,
    },
  });
}
