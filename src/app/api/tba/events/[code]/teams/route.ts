export const runtime = 'nodejs';
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function resolveTeamLogo(teamNumber: number, season: number, tbaKey: string): Promise<string | null> {
  const headers = { 'X-TBA-Auth-Key': tbaKey };
  // Try seasonal media first
  const seasonal = await fetch(
    `https://www.thebluealliance.com/api/v3/team/frc${teamNumber}/media/${season}`,
    { headers, cache: 'no-store' }
  );
  let media = seasonal.ok ? await seasonal.json() : null;

  // Fallback to any-year media
  if (!media || !Array.isArray(media) || media.length === 0) {
    const anyYear = await fetch(
      `https://www.thebluealliance.com/api/v3/team/frc${teamNumber}/media`,
      { headers, cache: 'no-store' }
    );
    media = anyYear.ok ? await anyYear.json() : [];
  }
  if (!Array.isArray(media) || media.length === 0) return null;

  // Prefer avatar; use base64 if provided
  const avatar = media.find((m: any) => m?.type === 'avatar');
  if (avatar) {
    const base64 = avatar?.details?.base64Image;
    if (typeof base64 === 'string' && base64.length > 0) {
      return `data:image/png;base64,${base64}`;
    }
    if (avatar?.direct_url) return avatar.direct_url as string;
    if (avatar?.view_url) return avatar.view_url as string;
  }

  // Then other images with direct_url/view_url
  const images = media.filter((m: any) => m?.type === 'team_image' || m?.type === 'imgur' || m?.direct_url || m?.view_url);
  const preferredImg = images.find((m: any) => m?.preferred && (m?.direct_url || m?.view_url));
  if (preferredImg?.direct_url) return preferredImg.direct_url as string;
  if (preferredImg?.view_url) return preferredImg.view_url as string;

  const anyImg = images.find((m: any) => m?.direct_url || m?.view_url);
  if (anyImg?.direct_url) return anyImg.direct_url as string;
  if (anyImg?.view_url) return anyImg.view_url as string;

  return null;
}

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
      const url = await resolveTeamLogo(tn, season, tbaKey);
      if (url) {
        const { error } = await supabaseAdmin.from("frc_teams").upsert({ number: tn, logo_url: url }, { onConflict: "number" });
        if (!error) withLogos += 1;
      }
    } catch {}
  }

  return new Response(JSON.stringify({ upserted: baseRows.length, withLogos }), { status: 200 });
}


