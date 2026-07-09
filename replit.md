# EV SCADA Telemetry Dashboard

A real-time EV charging station monitoring and control dashboard with dual-mode UI (User + Admin).

## Stack
- **Frontend**: React 19 + Vite + Tailwind CSS + Socket.io-client + Firebase Auth + Recharts
- **Backend**: Node.js + Express 5 + Socket.io (port 8080)

## Architecture
- The Vite dev server (port 5000) proxies `/socket.io` requests to the backend at `localhost:8080`, so the frontend uses a same-origin socket URL (`""`).
- Firebase project `ev-scada-dashboard` handles Google and email/password authentication.
- The backend simulates SCADA telemetry for 3 EV charging nodes at 10 Hz, emitting `scada_telemetry_feed` events over Socket.io.

## Running locally on Replit
Two workflows run in parallel:
- **Backend** — `cd backend && node server.js` (port 8080, console output)
- **Start application** — `cd frontend && npm run dev` (port 5000, webview)

## User preferences
