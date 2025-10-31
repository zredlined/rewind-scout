import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function frcKeyToNum(key: string): number | null {
  // key like "frc2767"
  const m = key.match(/frc(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code; // e.g., 2025miket
  const tbaKey = process.env.TBA_AUTH_KEY;
  if (!tbaKey) {
    return new Response(JSON.stringify({ error: "TBA_AUTH_KEY not set" }), { status: 500 });
  }
  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }), { status: 500 });
  }

  // Ensure event exists
  const { data: ev, error: evErr } = await supabaseAdmin
    .from("events")
    .upsert({ code, name: code })
    .select()
    .eq("code", code)
    .single();
  if (evErr) {
    return new Response(JSON.stringify({ error: evErr.message }), { status: 500 });
  }

  const res = await fetch(`https://www.thebluealliance.com/api/v3/event/${code}/matches`, {
    headers: { "X-TBA-Auth-Key": tbaKey },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    return new Response(JSON.stringify({ error: "TBA error", details: text }), { status: 502 });
  }
  const matches = await res.json();

  const rows = matches.map((m: any) => {
    const redTeams = (m?.alliances?.red?.team_keys ?? []).map(frcKeyToNum).filter(Boolean) as number[];
    const blueTeams = (m?.alliances?.blue?.team_keys ?? []).map(frcKeyToNum).filter(Boolean) as number[];
    return {
      event_id: ev.id,
      match_key: m.key.split("_").pop() ?? m.key, // qm16, qf1m1, etc
      red_teams: redTeams,
      blue_teams: blueTeams,
      scheduled_at: m?.time ? new Date(m.time * 1000).toISOString() : null,
    };
  });

  // Upsert by (event_id, match_key)
  const { error } = await supabaseAdmin
    .from("matches")
    .upsert(rows, { onConflict: "event_id,match_key" });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ imported: rows.length }), { status: 200 });
}


