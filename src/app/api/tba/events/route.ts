import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season");
  if (!season) {
    return new Response(JSON.stringify({ error: "missing season" }), { status: 400 });
  }

  const tbaKey = process.env.TBA_AUTH_KEY;
  if (!tbaKey) {
    return new Response(JSON.stringify({ error: "TBA_AUTH_KEY not set" }), { status: 500 });
  }

  const res = await fetch(`https://www.thebluealliance.com/api/v3/events/${season}`, {
    headers: { "X-TBA-Auth-Key": tbaKey },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(JSON.stringify({ error: "TBA error", details: text }), { status: 502 });
  }

  const events = await res.json();

  // Upsert into Supabase if admin client is available
  if (supabaseAdmin) {
    // Map minimal fields
    const rows = events.map((e: any) => ({
      code: e.key, // e.g., 2025miket
      name: e.name,
      start_date: e.start_date ?? null,
      end_date: e.end_date ?? null,
    }));

    // chunk upserts to avoid payload limits
    const chunkSize = 1000;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabaseAdmin
        .from("events")
        .upsert(chunk, { onConflict: "code" });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ count: events.length }), { status: 200 });
}


