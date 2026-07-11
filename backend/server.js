import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/ping', (req, res) => res.status(200).send('SCADA Backend is monitoring'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Persistent State Machine (Scaled for ₹ INR)
let sessionStates = {
  n1: { mode: "CHARGING", soc: 12, accumKwh: 0, accumCost: 0, costLimit: 500.00, postLimitPreference: "STANDBY" },
  n2: { mode: "CHARGING", soc: 38, accumKwh: 0, accumCost: 0, costLimit: 800.00, postLimitPreference: "DISCHARGE" },
  n3: { mode: "CHARGING", soc: 62, accumKwh: 0, accumCost: 0, costLimit: 300.00, postLimitPreference: "STANDBY" }
};

let systemTick = 0;

function randomizeInitialStates() {
  sessionStates.n1.soc = Math.floor(Math.random() * 15) + 10;
  sessionStates.n2.soc = Math.floor(Math.random() * 20) + 35;
  sessionStates.n3.soc = Math.floor(Math.random() * 15) + 60;
  
  Object.keys(sessionStates).forEach(key => {
    sessionStates[key].mode = "CHARGING";
    sessionStates[key].accumKwh = 0;
    sessionStates[key].accumCost = 0;
  });
}

io.on('connection', (socket) => {
  socket.on('update_user_profile', (command) => {
    const { node, costLimit, postLimitPreference, forcedMode } = command;
    if (sessionStates[node]) {
      if (costLimit !== undefined) sessionStates[node].costLimit = costLimit;
      if (postLimitPreference) sessionStates[node].postLimitPreference = postLimitPreference;
      if (forcedMode) sessionStates[node].mode = forcedMode; 
    }
  });
});

setInterval(() => {
  systemTick++;
  if (systemTick > 460) { systemTick = 1; randomizeInitialStates(); }
  
  // Realistic Indian Commercial EV Tariffs (₹/kWh)
  let currentTariff = systemTick > 320 ? 18.00 : (systemTick > 150 ? 12.00 : 8.00);
  let pricingTier = systemTick > 320 ? "PEAK PREMIUM" : (systemTick > 150 ? "SHOULDER" : "OFF-PEAK");

  const computeNodeData = (nodeId, baseVolt, baseTemp) => {
    let state = sessionStates[nodeId];
    let current = 0.0;
    let phase = "IDLE";

    if (state.mode === "CHARGING" && (state.soc >= 100 || state.accumCost >= state.costLimit)) {
      state.mode = state.postLimitPreference;
    }

    if (state.mode === "CHARGING") {
      let addition = state.soc < 78 ? 0.25 : 0.08;
      state.soc = Math.min(state.soc + addition, 100);
      current = state.soc < 78 ? 32.0 : 8.0;
      phase = state.soc >= 100 ? "FULLY CHARGED" : (state.soc > 78 ? "CV" : "CC");
    } else if (state.mode === "DISCHARGE") {
      state.soc = Math.max(state.soc - 0.15, 0); 
      current = -15.0; 
      phase = "DISCHARGE";
    } else if (state.mode === "STANDBY") {
      current = 0.0;
      phase = "STANDBY";
    }

    let deltaKwh = (Math.abs((baseVolt * current) / 1000) * 0.1) / 3600; 
    state.accumKwh += deltaKwh;
    // V2G pays back at 1.5x the current grid rate as an incentive
    state.accumCost += state.mode === "DISCHARGE" ? -(deltaKwh * (currentTariff * 1.5)) : (deltaKwh * currentTariff);

    let etc = state.mode === "CHARGING" ? (state.soc < 78 ? Math.ceil((100 - state.soc) * 1.2) : Math.ceil(5 * Math.log(100 - Math.min(state.soc, 99)))) : 0;
    let batteryCapacityKwh = nodeId === "n1" ? 40 : (nodeId === "n2" ? 60 : 75);
    let remainingKwhNeeded = ((100 - state.soc) / 100) * batteryCapacityKwh;
    let estTotalCost = state.accumCost + (remainingKwhNeeded * currentTariff);

    return {
      soc: state.soc, current, voltage: baseVolt, temp: baseTemp,
      dc: Math.abs(current) / 40, phase, mode: state.mode, 
      accumCost: state.accumCost, costLimit: state.costLimit, 
      postLimitPreference: state.postLimitPreference, etc,
      estTotalCost: Math.min(estTotalCost, state.costLimit) // Caps estimation accurately at user budget limits
    };
  };

  const packet = {
    tick: systemTick, busVoltage: 48.0, pricing: { tariff: currentTariff, tier: pricingTier },
    hil: { rtt: 44.2 + Math.sin(systemTick/12) },
    n1: computeNodeData("n1", 49.5, 43.0),
    n2: computeNodeData("n2", 48.5, 41.0),
    n3: computeNodeData("n3", 52.5, 25.0)
  };

  io.emit('scada_telemetry_feed', packet);
}, 100);
httpServer.listen(process.env.PORT || 8080, () => console.log(`⚡ SCADA Smart Energy Matrix active on Port ${process.env.PORT || 8080}`));