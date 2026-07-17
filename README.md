### Cost-Aware Automation
User sets spend ceiling (₹50–₹1,500). Engine continuously tracks accumulated cost:
- **At limit reached** → Auto-switch to user's chosen fallback (Standby or V2G)
- **No manual intervention** — Fully automatic

### Tariff Tiers (Simulated Time-of-Day)
- **Off-Peak** (tick 0–150): ₹8/kWh
- **Shoulder** (tick 150–320): ₹12/kWh
- **Peak Premium** (tick 320–460): ₹18/kWh

---

## 📡 API Specification

### REST Endpoints

```http
GET /ping
```
Health check. Returns: `"SCADA Backend is monitoring"`

### WebSocket Events

**Server → Client (Push every 100 ms)**
```js
io.emit('scada_telemetry_feed', {
  tick: 122,
  busVoltage: 48.0,
  pricing: { tariff: 8.00, tier: "OFF-PEAK" },
  hil: { rtt: 44.2 },
  n1: {
    soc: 49,
    current: 32.0,
    voltage: 49.5,
    temp: 43,
    dc: 0.8,
    phase: "CC",
    mode: "CHARGING",
    accumCost: 12.50,
    costLimit: 500,
    postLimitPreference: "STANDBY",
    etc: 47,                    // Est. time to completion (mins)
    estTotalCost: 196.82        // Est. total cost at 100% SoC
  },
  n2: { ... },
  n3: { ... }
});
```

**Client → Server (On user action)**
```js
socket.emit('update_user_profile', {
  node: "n1",
  costLimit: 600,
  postLimitPreference: "V2G",
  forcedMode: "DISCHARGE"       // or null to let automation decide
});
```

---

## 🔧 Firebase Configuration

### 1. Create Firebase Project
Go to [console.firebase.google.com](https://console.firebase.google.com)
- Create new project (free tier)
- Enable **Authentication** (Google OAuth + Email/Password)
- Enable **Firestore Database** (free tier)

### 2. Get Config
In Firebase Console → Project Settings → Copy config:

```js
const firebaseConfig = {
  apiKey: "AIzaSyASbPz1J23V0uCCUCQN-AJIAz8x-eGcqGA",
  authDomain: "ev-scada-dashboard.firebaseapp.com",
  projectId: "ev-scada-dashboard",
  storageBucket: "ev-scada-dashboard.firebasestorage.app",
  messagingSenderId: "290929904104",
  appId: "1:290929904104:web:298a2c33a02c0a10dcbc5d",
  measurementId: "G-L23QH40727"
};
```

### 3. Add to App.jsx
```js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
```

Done! Auth & Firestore now work.

---

## 🔄 Future: Live Hardware Integration

Currently runs on a **physics-accurate simulation engine**. When Arduino/Raspberry Pi hardware is ready:

1. **Enumerate serial ports** on Raspberry Pi (`/dev/ttyACM0..2`)
2. **Map Arduino frames** to `sessionStates` object schema
3. **Replace simulation tick** with live-read adapter in `setInterval`
4. **Zero code changes** downstream — Socket.IO packet, React dashboard, all charts work unchanged

**Why this matters:**
- Simulation engine & hardware adapter speak **identical JSON contract**
- Switching is a **drop-in replacement at data-source level only**
- **No frontend, no WebSocket, no dashboard changes needed**

---

## 📊 Performance & Metrics

| Metric | Value |
|---|---|
| **WebSocket Push Rate** | 100 ms (10 Hz) |
| **Latency** | < 200 ms (browser → backend → client) |
| **Concurrent Clients** | Tested with 5+ simultaneous connections |
| **Chart History Buffer** | 150 ticks (~15 seconds of live data) |
| **Auth Latency** | < 500 ms (Firebase) |
| **Deployment Time** | 20 minutes (zero cost) |

---

## 🧪 Testing & Validation

### Local Testing
```bash
# Terminal 1: Backend
cd backend && node server.js

# Terminal 2: Frontend
cd frontend && npm run dev

# Browser: http://localhost:5000
# Sign in → Admin dashboard loads → See live 3-node grid + 6 charts
```

### Validate Features
- [ ] Admin console shows all 3 nodes with live SoC gauges
- [ ] 6 charts update in real time (no page refresh)
- [ ] User dashboard shows spend ceiling slider
- [ ] Cost updates reflect tariff changes (every ~100 ticks)
- [ ] V2G mode shows earnings (positive ₹)
- [ ] Standby mode shows no cost accrual
- [ ] Firebase sign-in works (Google OAuth)
- [ ] Signing out clears session

---

## 📚 Learning Outcomes

✅ **Real-time architecture** — Designed bidirectional WebSocket system for multi-client control-room apps  
✅ **Power electronics** — CC/CV charging curves, SoC estimation, V2G energy feedback  
✅ **State management** — Centralised server-side node state with concurrent operator commands  
✅ **Hardware-software boundary** — Built simulation as swap-in replacement layer  
✅ **Full-stack deployment** — Frontend + backend + auth on zero-cost platforms  
✅ **Data visualisation** — Real-time charts with 150-tick rolling history buffer  

---

## 📄 Documentation

- **Architecture Deep Dive** — See `/docs/ARCHITECTURE.md`
- **API Spec** — See `/docs/API.md`
- **Deployment Guide** — See `/docs/DEPLOYMENT.md`
- **Internship Report** — See `Tejas_Salunkhe_Internship_Report_2026.pdf`

---

## 🤝 Contributing

This is an internship project. For modifications or suggestions:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -am 'Add feature'`)
4. Push to branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📧 Contact

**Tejas Salunkhe**  
B.Tech, Instrumentation & Control Engineering  
NIT Tiruchirappalli, 2026

📍 GitHub: [tejassalunkhe2806](https://github.com/tejassalunkhe2806)  
📌 Project: [EV-CHARGING](https://github.com/tejassalunkhe2806/EV-CHARGING)

---

## 👨‍🏫 Guide & Collaboration

**Dr. Rakesh Kumar Panda**  
Assistant Professor, Department of Electrical & Electronics Engineering  
NIT Tiruchirappalli

---

## 📜 License

MIT License — Feel free to use this project for educational or commercial purposes.

---

## 🎓 Citation

If you reference this project in academic work:

```bibtex
@misc{salunkhe2026evscada,
  author = {Salunkhe, Tejas},
  title = {Real-Time SCADA Dashboard for Adaptive Multi-EV Fast Charging System},
  year = {2026},
  institution = {National Institute of Technology, Tiruchirappalli},
  url = {https://github.com/tejassalunkhe2806/EV-CHARGING}
}
```

---

## ⭐ Show Your Support

If this project helped you, please give it a star! ⭐

---

**Last Updated:** July 2026  
**Status:** Production Ready | Hardware Integration Pending
