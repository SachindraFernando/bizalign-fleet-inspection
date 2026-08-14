# Write-up — BizAlign Fleet Inspection App

## How I approached it

My production experience is native iOS (Swift/SwiftUI), not React Native, so I used Claude throughout to help translate concepts I already understand from iOS (local-first state, offline queues, state management) into RN/Expo/TypeScript/Zustand equivalents, and to help me work through the syncing logic itself.

I built in this order:
1. Data shapes first (`Vehicle`, `Inspection` types) — deciding what a driver's submission actually needs to hold, and adding a client-generated `id` up front, before writing any UI, because I knew from the brief that reconciling failed/ambiguous requests would be the core problem.
2. The Zustand store, with `persist` middleware backed by AsyncStorage, so inspections survive an app restart — since a driver could realistically fill in several inspections across a shift before ever getting signal back.
3. The vehicle list screen, wired to live data from `GET /vehicles`.
4. The inspection form screen (6 toggles + notes), with local-first submission — tapping Submit never touches the network directly, it only ever writes to the local store. Syncing is a fully separate step.
5. The sync logic — this took the most time and iteration, described below.
6. Manual, deliberate offline testing: killing the mock server mid-session, submitting inspections with no server reachable, confirming local save still worked, then bringing the server back and confirming automatic sync.

## Where AI's first answer wasn't good enough

Two concrete examples, both caught through actual testing rather than by inspection of the code:

**1. Reconciliation was checking the wrong field entirely.**
My first version of the retry/reconciliation logic compared the server's response using `serverInspections.some(i => i.id === inspection.id)` — checking if the server had a record whose `id` matched my client-generated UUID. This looked correct and compiled fine. But when I actually tested it (submitting several inspections with failure injection on, then comparing my app's "Synced" count against `GET /inspections` on the server), the counts didn't match — the app was undercounting by one.

I dug into `mock-server.js` itself rather than guessing, and found the server generates its *own* `id` for every stored inspection, and only echoes my client ID back under a separate field called `clientId`. My reconciliation check was comparing the server's own ID against mine, which could never match. I fixed it to check `i.clientId === inspection.id` instead. This was the phantom-success case actually happening in practice — the server had genuinely stored my inspection, but my app never recognized it, and without this fix a driver's data could have silently gone "missing" from their perspective even though it existed server-side.

**2. The submitted payload shape was wrong, silently.**
Related to the above — I was sending the six pass/fail answers as flat fields (`tyres`, `lights`, etc.) directly on the request body. The server actually expects them nested under an `items` object. Because the server doesn't validate the shape, this failed silently: requests returned `201 Created` and looked successful, but `GET /inspections` showed `"items": {}` — empty. I only caught this by actually reading the stored records back and comparing them against what I'd submitted, not from any error message. I added a small `toServerPayload()` translator function to convert my internal shape into what the server actually expects, once I'd read `mock-server.js`'s source directly rather than assuming the shape from the brief's description alone.

**The broader lesson, and the point of both examples:** AI-generated code that compiles and "looks right" isn't the same as code that's actually correct against a real API's behaviour — I only caught both issues by testing against the real mock server's actual failure modes and actual stored data, not by reading the code.

## What wasn't defined in the brief, and what I decided

- **What happens if a driver taps a vehicle that already has an inspection queued or synced?** Undefined in the brief. I decided to allow multiple inspections per vehicle rather than blocking or overwriting — a driver might reasonably need to log more than one inspection in a day (e.g. a second driver takes the same van later). This does mean the vehicle list only shows an aggregate "waiting to sync" / "synced" status, not a count or history.
- **How to detect "back online."** The brief doesn't specify this. My first approach only listened for device-level connectivity changes via `NetInfo`. I discovered through testing that this doesn't cover the case where the device has a working connection but the app's specific server is unreachable (e.g. the mock server itself being down while WiFi stays up) — a realistic scenario for a real backend outage too. I added a 10-second periodic retry as a second, more reliable safety net alongside the `NetInfo` listener.
- **Retry limits.** Not specified. Currently there's no cap — a failed inspection will keep retrying indefinitely on every periodic tick. For a real driver this is probably fine at small scale, but see below for where this could become a problem.
- **Default toggle state.** I defaulted all six checks to "pass" (true), on the assumption that a driver mostly reports exceptions, not routine passes. This is a judgement call the brief left open.

## What my version doesn't handle

- **No way to view a past inspection's actual answers** — the app only shows aggregate sync status per vehicle ("waiting to sync" / "synced"), not the inspection's content. A driver can't check what they submitted earlier.
- **No retry backoff or cap.** A permanently broken inspection (e.g. malformed data that always 500s) would retry forever, every 10 seconds, with no limit and no way for the driver to see it's stuck versus just slow.
- **No conflict handling if the same inspection is somehow queued twice** — this shouldn't happen given the client ID design, but it's not explicitly tested against, e.g. rapid double-tapping Submit.
- **No visual distinction between "still queued" and "actively retrying right now"** — the UI shows one combined "waiting to sync" state, not finer-grained status.
- **Vehicle list requires connectivity to load at all on first launch** — if a driver's very first time opening the app is offline, they'd see an empty list rather than a cached one, since vehicles aren't persisted locally (only inspections are). This was a deliberate scope decision but is a real limitation.

## If 500 drivers used this offline for a week and then all came back online at once

A few things would likely break or degrade, roughly in order of how soon they'd bite:

1. **Thundering herd on the server.** 500 devices simultaneously running their periodic sync tick would produce a burst of near-simultaneous POST requests, plus a burst of `GET /inspections` calls for reconciliation on any that fail. A real backend would need rate limiting and/or the client would need randomized jitter on the retry timer, rather than every device retrying on exactly the same fixed interval.
2. **The client-side reconciliation approach doesn't scale.** My current fallback — "if a request fails, fetch the entire inspections list and check for my ID" — is fine for a handful of records in a mock server, but fetching the *entire* inspections table to check for one ID would be extremely wasteful at real scale. A production API should support querying by client ID directly, or better, true idempotency-key support server-side, rather than requiring clients to fetch everything to reconcile.
3. **A week of queued data per driver is a lot to retry through one at a time.** My `syncAllPending` function syncs one inspection at a time, sequentially, in a loop. For a driver with, say, 20+ queued inspections, this is slow and means one stuck/slow request blocks everything behind it. This would need to become concurrent (with a sensible concurrency cap) for real-world queue sizes.
4. **No idempotency guarantee on the server side itself.** My client sends a `clientId`, but the mock server doesn't actually deduplicate against it — it happily stores multiple records with the same `clientId` if sent twice. My app avoids re-sending anything it's confirmed synced, but this relies entirely on client discipline. A production API should reject or dedupe on `clientId` server-side as the real safety net, not just rely on well-behaved clients.

## What I'd do differently with more time

- Add a detail/history view so drivers can see what they actually submitted for a given inspection, not just its sync status.
- Add exponential backoff with jitter for retries, rather than a flat 10-second interval for everyone.
- Make sync concurrent with a small concurrency limit, rather than fully sequential.
- Cache the vehicle list locally too (not just inspections), so the app is usable even on a true first-ever offline launch.
- Push for server-side idempotency on `clientId` rather than relying on client-side reconciliation alone — this is the single biggest thing I'd want to change about the mock API's actual contract if it were shaping a real production API.

## Pushback

The mock server's phantom-success behaviour (storing data but deliberately destroying the connection before responding) is a good stress test for client-side reconciliation logic, but I'd push back on it as a realistic *production* API contract to design against long-term. In practice this pattern is exactly why idempotency keys with proper server-side dedupe exist — a real API should let the client safely retry without needing to fetch and diff the entire remote dataset to figure out what happened. I built the client-side check because the brief's scenario calls for it, but I wouldn't want to ship a real fleet system where "list everything and check by hand" is the retry strategy at scale.
