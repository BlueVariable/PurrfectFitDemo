# Play analytics

Who played, how much, and from where — collected by the game itself, stored in
the `Telemetry` tab of the config spreadsheet, and read back by `stats.html`.
No third-party analytics product, no cookies, no accounts.

```
index.html ──▶ js/analytics.js ──POST──▶ Apps Script web app ──▶ Telemetry tab
                                                                      │
stats.html ◀────────── published CSV ◀────────────────────────────────┘
```

## One-time setup (~3 minutes, and only you can do it)

Everything else is already built and committed. The game stays **completely
inert** — no network calls, no geo lookup, nothing — until the endpoint below
exists.

1. Open the config spreadsheet → **Extensions → Apps Script**.
2. Delete whatever is in `Code.gs` and paste the contents of
   [`apps-script/telemetry.gs`](../apps-script/telemetry.gs). Save.
3. **Deploy → New deployment** → gear icon → **Web app**.
   - *Description:* `purrfect telemetry`
   - *Execute as:* **Me**
   - *Who has access:* **Anyone** ← required; players are anonymous and not
     signed in to Google.
4. **Deploy**, then authorise (Google will warn about an unverified app because
   it's your own script — *Advanced → Go to project → Allow*).
5. Copy the **Web app URL**. It ends in `/exec`.
6. Switch it on, either way:
   - **From the sheet, no code change:** add a row to the **General** tab —
     Setting `analytics_url`, Value the `/exec` URL. Takes effect on the next
     config load (the published CSV lags a few minutes).
   - **In code:** paste it into `PF_ANALYTICS_URL` at the top of
     `js/analytics.js` and push.

Paste the URL into a chat with me and I'll do step 6 for you.

**Check it worked:** open the `/exec` URL in a browser — it prints
`{"ok":true,"service":"purrfect-fit telemetry","rows":N}`. Then play a round on
the live site and watch a row land in the `Telemetry` tab.

## Redeploying after a change to `telemetry.gs`

Apps Script pins a deployment to a code version: **Deploy → Manage deployments
→ edit (pencil) → Version: New version → Deploy**. Keeps the same `/exec` URL.
Creating a *new* deployment instead gives you a new URL and the game would keep
posting to the old one.

## What gets recorded

One row per event. Events are batched in the browser and flushed every 20s, at
8 queued rows, and on page-hide (via `sendBeacon`, so closing the tab still
delivers).

| Event | When |
|---|---|
| `session_start` | page load |
| `run_start` | a branch is picked and a run begins |
| `round_win` | a round is cleared (the single win funnel — includes `soft_landing` rescues) |
| `round_fail` | a round runs out of hands: where the run died |
| `run_complete` | the whole work week survived |
| `heartbeat` | every 2 minutes of **active** play |
| `session_end` | tab closed or hidden |

Columns: `ts, event, visitor, session, env, country, region, city, tz, lang,
device, screen, referrer, branch, round, hands_used, score, target, purrfects,
modifier, cash, playtime_s, rounds_cleared, detail, ua`.

`playtime_s` counts only time with the tab actually visible, so a tab left open
overnight doesn't report a nine-hour session.

`env` separates `live` (github.io) from `local` (your own testing) — the
dashboard filters to live by default so your dev sessions don't skew the numbers.

## Privacy

- **Anonymous.** No name, no login, no cookie, no IP address. `visitor` is a
  random id the browser generated for itself and kept in `localStorage`; it
  identifies a *browser*, so the same playtester on phone and laptop counts as
  two.
- **Coarse geo.** Country/region/city come from a free IP-geolocation lookup
  (`ipwho.is`, falling back to `geojs.io`) made from the player's browser once a
  day. The IP in the response is read and discarded — it never reaches the
  sheet. If an ad blocker kills the lookup, the row still logs and the `tz`
  column still hints at the region.
- **Referrer is host-only** (`discord.com`, not the full URL).
- The `Telemetry` tab rides on the same "publish to web" setting as the rest of
  the config, which means **the log is publicly readable** by anyone who knows
  the URL — as is `stats.html` itself, since the repo is public. It's anonymous
  aggregate play data, but don't put anything sensitive in that tab.

## The dashboard

`stats.html` — open it locally or at
`https://bluevariable.github.io/PurrfectFitDemo/stats.html`. It reads the
published CSV directly (no login), and shows visitors and sessions, active
playtime, a country breakdown, how far people actually get before quitting or
failing, arrival sources, and a recent-sessions table. The published feed lags
a few minutes behind live play; the **Refresh** button re-fetches.

## Housekeeping

The tab holds 50,000 rows (~1,500 sessions). To reset, select rows 2:N in the
`Telemetry` tab and delete them — leave row 1, the headers drive the collector's
column mapping.
