## Key Concepts

### Charging Modes
- **CHARGING (CC phase)** — 32 A, +0.25% SoC/tick (below 78%)
- **CHARGING (CV phase)** — 8 A, +0.08% SoC/tick (above 78%)
- **STANDBY** — 0 A, no cost
- **DISCHARGE (V2G)** — −15 A, feeds grid at 1.5× tariff

### Cost-Aware Automation
User sets spend ceiling (₹50–₹1,500). Engine tracks accumulated cost; at limit, node auto-switches to user's chosen fallback (Standby or V2G) — zero manual intervention.

### Tariff Tiers (Simulated)
- **Off-Peak** (tick 0–150): ₹8/kWh
- **Shoulder** (tick 150–320): ₹12/kWh
- **Peak Premium** (tick 320–460): ₹18/kWh

Cycle resets at tick 461, nodes randomise initial SoC.

## API Endpoints

### REST
- `GET /ping` — Health check

### WebSocket Events

**Server → Client:**
```js
io.emit('scada_telemetry_feed', {
  tick,
  busVoltage,
  pricing: { tariff, tier },
  hil: { rtt },
  n1: { soc, current, voltage, temp, dc, phase, mode, accumCost, ... },
  n2: { ... },
  n3: { ... }
});
```

**Client → Server:**
```js
socket.emit('update_user_profile', {
  node,
  costLimit,
  postLimitPreference,
  forcedMode
});
```

## Firebase Setup

1. Create Firebase project at console.firebase.google.com
2. Enable Authentication (Google OAuth + Email/Password)
3. Enable Firestore Database
4. Copy config to `App.jsx`:
```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## Future: Live Hardware Integration

Currently runs on a physics-accurate simulation engine. To integrate live Arduino/Raspberry Pi data:

1. Open serial ports (`/dev/ttyACM0..2`) on Raspberry Pi
2. Map Arduino frames to `sessionStates` object schema
3. Replace simulation tick function with live-read adapter
4. **No changes to Socket.IO, React dashboard, or UI needed** — identical JSON packet contract

## Status

✅ **Fully functional end-to-end** — Admin + User dashboards, Firebase auth, real-time charts, tariff logic, V2G, spend limits

🔄 **Ready for live hardware integration** — Simulation engine engineered for drop-in replacement

## Author

Tejas Salunkhe  
B.Tech, Instrumentation & Control Engineering  
NIT Tiruchirappalli, 2026

## Guide

Dr. Rakesh Kumar Panda  
Assistant Professor, Department of Electrical & Electronics Engineering  
NIT Tiruchirappalli

## License

MIT
