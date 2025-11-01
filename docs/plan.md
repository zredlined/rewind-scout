# Product & Engineering Plan (Pivot)

Goal: Ship a simple, single‑team scouting app quickly. Keep it dynamic via a season‑configurable form. Defer offline/multi‑team to future.

## What we kept
- Next.js + Supabase + Vercel
- Auth (Google/email)
- TBA import endpoints and event/match tables

## What we simplified
- Single team only (no memberships/invites)
- Online‑only (no offline outbox/sync)
- Dynamic metrics via `form_templates` (JSONB) + `scouting_entries.metrics` (JSONB)

## Core flows
- Check‑in: choose season → import events → choose event → auto‑import matches → set current event
- Scout: next/prev match controls; fast entry → append row (with `scout_name`, `scouted_at`)
- Analysis: current event/season toggle; summary metric cards; team‑only progression charts; recent comments; team‑only table
- Admin: export CSV; delete recent/all entries

## Future roadmap
- Offline‑first (IndexedDB + idempotent server sync)
- Multi‑team with RLS and invites
- Auto insights (strengths/weaknesses) and richer charts

## SQL reference
See `sql/bootstrap.sql` for the minimal schema and policies.


