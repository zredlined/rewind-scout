import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const body = await req.json();
  const teamNumber = Number(body.teamNumber);
  const teamName = (body.teamName ?? '').trim();

  if (!teamNumber || !teamName) {
    return NextResponse.json({ error: 'teamNumber and teamName are required' }, { status: 400 });
  }

  const joinCode = generateJoinCode();

  const { data: team, error } = await supabaseAdmin
    .from('teams')
    .insert({ team_number: teamNumber, team_name: teamName, join_code: joinCode })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ team });
}
