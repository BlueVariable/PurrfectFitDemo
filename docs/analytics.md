# Play analytics

Who played, how much, and from where — collected by the game itself, stored in
the `Telemetry` tab of the config spreadsheet, and read back by `stats.html`.
No third-party analytics product, no cookies, no accounts.

```
index.html ──▶ js/analytics.js ──POST──▶ Apps Script web app ──▶ Telemetry tab
                                                                      │
stats.html ◀────────── published CSV ◀────────────────────────────────┘
```

## Status: live — nothing left to set up

The collector is deployed and the game is wired to it. Rounds played on the live
site land in the `Telemetry` tab within seconds.

| | |
|---|---|
| Apps Script project | **Purrfect Fit — telemetry collector** (standalone, in your Drive) |
| Web app URL | `https://script.google.com/macros/s/AKfycby9YrCUTV3AlMsTwJ1XTOSomm1XKYEyONOkFp2BzbucGqo7zoVbeLyPcCAUApDQsTau/exec` |
| Execute as | you · **Who has access:** Anyone (players aren't signed in to Google) |
| Wired in at | `PF_ANALYTICS_URL`, top of `js/analytics.js` |

**Health check:** open the `/exec` URL in a browser — it prints
`{"ok":true,"service":"purrfect-fit telemetry","rows":N}`, where `N` is the
number of events logged so far.

### Moving or rotating the endpoint

Two ways, no code change needed for the first:

- **From the sheet:** add a row to the **General** tab — Setting
  `analytics_url`, Value the new `/exec` URL. It overrides the constant. The
  published CSV lags a few minutes, and the client watches for it for the first
  ~60 seconds of a session, so it takes effect on the next page load.
- **In code:** edit `PF_ANALYTICS_URL` in `js/analytics.js` and push.

Setting either to an empty value turns collection off entirely — the client then
makes no network calls and no geo lookup at all.

### If you ever need to rebuild it from scratch

1. [script.new](https://script.new) → paste
   [`apps-script/telemetry.gs`](../apps-script/telemetry.gs) → save.
2. **Deploy → New deployment** → gear → **Web app**; *Execute as* **Me**,
   *Who has access* **Anyone**.
3. **Deploy**, then **Authorize access** and allow the script to reach your
   spreadsheet (Google warns about an unverified app because it's your own
   script — *Advanced → Go to project → Allow*).
4. Point the game at the new `/exec` URL as above.

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
`https://bluevariable.github.io/PurrfectFitDemo/stats.html`. No login. Shows
visitors and sessions, active playtime, a country breakdown, how far people
actually get before quitting or failing, arrival sources, and a recent-sessions
table.

**Where it reads from.** Primarily the collector's own `?rows=1` endpoint, which
queries the live sheet — so what you see is what the sheet holds, with no lag.
If the script is unreachable (redeploying, quota) it falls back to the published
CSV, and if both fail it shows the last good read from this browser's cache
rather than a blank page.

That fallback order matters: the published CSV is **eventually consistent**. Its
edge nodes hold different snapshots, so for minutes after a write it can serve a
stale — sometimes empty — copy. An empty result is therefore only believed when
it comes from the live read; an empty CSV never wipes the view. (This is what
used to make a refresh occasionally flash "waiting for the first play" over a log
that had rows in it.)

**Your own plays are hidden by default.** Two sources feed the exclusion:
`PF_EXCLUDE_VISITORS` in `js/stats.js` (browsers used to build and verify this),
plus whoever is viewing the dashboard — stats.html shares an origin with the
game, so it reads the viewer's own `purrfect_vid` and drops it. Nothing is
silently discarded: the count shows in the filter row and the **Your own plays**
toggle puts them back. To exclude another browser, add its `visitor` id to that
list.

## Housekeeping

The tab holds 50,000 rows (~1,500 sessions). To reset, select rows 2:N in the
`Telemetry` tab and delete them — leave row 1, the headers drive the collector's
column mapping.
