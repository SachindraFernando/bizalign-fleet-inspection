# BizAlign Fleet — Inspection App

A React Native (Expo) app for drivers to complete pre-trip vehicle inspections, built to work fully offline and sync automatically once a connection is available.

See [`WRITEUP.md`](./WRITEUP.md) for the full write-up — approach, AI usage, decisions, known limitations, and reflections.

## Requirements

- Node.js 18 or newer
- Xcode with the iOS Simulator installed (for running on iOS)
- Expo Go (installed automatically when you run the app)

## Setup

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/SachindraFernando/bizalign-fleet-inspection.git
cd bizalign-fleet-inspection
npm install
```

## Running the app

You need **two terminal tabs** running at the same time — one for the mock API, one for the app.

**Terminal 1 — start the mock server:**

```bash
node mock-server.js
```

This starts the API at `http://localhost:4000`, with failure injection **enabled by default** (roughly 30% error, 10% timeout, 10% phantom success, 50% normal success on every submission — this is intentional, see the file's own header comment for details).

To disable failures while developing/debugging:

```bash
FAILURE_RATE=0 node mock-server.js
```

**Terminal 2 — start the app:**

```bash
npx expo start
```

Once the Metro bundler starts, press `i` to launch it in the iOS Simulator.

## Using the app

1. The vehicle list loads from the mock server on launch.
2. Tap any vehicle to open the inspection form (6 pass/fail checks + notes).
3. Fill it in and tap **Submit** — this saves the inspection locally immediately, regardless of network state.
4. The vehicle list shows **"Waiting to sync"** for anything not yet confirmed by the server, and **"Synced"** once confirmed.
5. Syncing happens automatically — on network reconnect, and via a periodic retry every 10 seconds, so nothing needs to be manually triggered.

## Testing the offline behaviour

To see the offline → sync flow in action:

1. With the app running, stop the mock server (`Ctrl+C` in its terminal, or find and `kill` its process).
2. Submit an inspection in the app — it should save locally with no errors and show "Waiting to sync."
3. Restart the mock server (`node mock-server.js`).
4. Within ~10 seconds, the app should automatically detect and sync, flipping the status to "Synced" with no action needed.

To verify against the server's actual stored data at any point:

```bash
curl http://localhost:4000/inspections
```
