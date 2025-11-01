export const runtime = 'nodejs';
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const tbaKey = process.env.TBA_AUTH_KEY;
  if (!tbaKey || !supabaseAdmin) {
    return new Response(JSON.stringify({ error: "Missing TBA or Supabase keys" }), { status: 500 });
  }

  // Fetch teams for the event
  const teamsRes = await fetch(`https://www.thebluealliance.com/api/v3/event/${code}/teams`, {
    headers: { "X-TBA-Auth-Key": tbaKey },
    cache: "no-store",
  });
  if (!teamsRes.ok) {
    const text = await teamsRes.text();
    return new Response(JSON.stringify({ error: "TBA teams error", details: text }), { status: 502 });
  }
  const teams = await teamsRes.json();

  const baseRows = teams.map((t: any) => ({
    number: t.team_number,
    nickname: t.nickname ?? null,
    name: t.name ?? null,
  }));

  if (baseRows.length) {
    const { error } = await supabaseAdmin.from("frc_teams").upsert(baseRows, { onConflict: "number" });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Attempt to pull logos/avatars
  const season = Number(code.slice(0, 4)) || new Date().getFullYear();
  let withLogos = 0;
  for (const t of teams) {
    const tn = t.team_number;
    try {
      const mediaRes = await fetch(`https://www.thebluealliance.com/api/v3/team/frc${tn}/media/${season}`, {
        headers: { "X-TBA-Auth-Key": tbaKey },
        cache: "no-store",
      });
      if (!mediaRes.ok) continue;
      const media = await mediaRes.json();
      const avatar = media.find((m: any) => m?.type === "avatar") || media.find((m: any) => m?.type === "team_image");
      const url = avatar?.direct_url;
      if (url) {
        const { error } = await supabaseAdmin.from("frc_teams").upsert({ number: tn, logo_url: url }, { onConflict: "number" });
        if (!error) withLogos += 1;
      }
    } catch {}
  }

  return new Response(JSON.stringify({ upserted: baseRows.length, withLogos }), { status: 200 });
}


