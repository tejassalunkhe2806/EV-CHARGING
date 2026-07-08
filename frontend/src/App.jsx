import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { 
  Activity, Zap, ZapOff, Clock, Shield, LogIn, Sliders, 
  BatteryCharging, PowerOff, Mail, X, ActivitySquare, IndianRupee 
} from 'lucide-react';
import 'react-circular-progressbar/dist/styles.css';

// --- FIREBASE CONFIGURATION ---
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyASbPz1J23V0uCCUCQN-AJIAz8x-eGcqGA",
  authDomain: "ev-scada-dashboard.firebaseapp.com",
  projectId: "ev-scada-dashboard",
  storageBucket: "ev-scada-dashboard.firebasestorage.app",
  messagingSenderId: "290929904104",
  appId: "1:290929904104:web:298a2c33a02c0a10dcbc5d",
  measurementId: "G-L23QH40727"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const SOCKET_SERVER_URL = "http://localhost:8080";

// --- ORIGINAL ADMIN COMPONENTS (Untouched) ---
const TelemetryBar = ({ label, value, max, color, unit }) => {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-3 w-full text-[11px] font-mono font-bold text-slate-300">
      <span className="w-5 flex-shrink-0 text-slate-400 text-left">{label}</span>
      <div className="flex-1 bg-[#21262d] rounded-full h-2.5 overflow-hidden shadow-inner">
        <div className="h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(0,0,0,0.6)]" style={{ width: `${percentage}%`, backgroundColor: color, boxShadow: `0 0 12px ${color}80` }}></div>
      </div>
      <span className="w-16 text-right text-white font-black flex-shrink-0 text-xs tracking-tight">{value || 0} <span className="text-slate-500 font-normal text-[10px]">{unit}</span></span>
    </div>
  );
};

const NodeCard = ({ title, data, mainColor }) => {
  const isDisconnected = !data || data.phase === "NO EV";
  const fallbackData = data || { soc: 0, current: 0, voltage: 0, temp: 25, dc: 0, phase: "IDLE" };
  
  return (
    <div className="bg-[#161b22] flex-1 rounded-2xl border border-[#30363d] p-4 flex flex-col justify-between shadow-xl">
      <h3 className="text-xs font-black text-white uppercase border-b border-[#21262d] pb-2 mb-2 flex justify-between items-center">
        <span>{title}</span>
        <span className={`px-3 py-1 rounded-md text-[11px] font-mono font-bold tracking-widest border`} style={!isDisconnected ? { color: mainColor, borderColor: `${mainColor}40`, backgroundColor: `${mainColor}15` } : {}}>PHASE: {fallbackData.phase}</span>
      </h3>
      {isDisconnected ? (
        <div className="flex flex-col items-center justify-center h-full opacity-40"><ZapOff className="w-10 h-10 text-slate-400 mb-2" /><span className="text-sm font-black text-slate-400 tracking-widest">NO EV CONNECTED</span></div>
      ) : (
        <div className="flex gap-6 items-center h-full px-2">
          <div className="w-28 h-28 flex-shrink-0"><CircularProgressbar value={fallbackData.soc} text={`${fallbackData.soc.toFixed(0)}%`} styles={buildStyles({ pathColor: mainColor, textColor: '#fff', textSize: '26px', fontWeight: 'bold', trailColor: '#21262d' })} /></div>
          <div className="flex flex-col gap-2.5 flex-1 w-full justify-center">
            <TelemetryBar label="I" value={fallbackData.current} max={40} color="#38bdf8" unit="A" />
            <TelemetryBar label="V" value={fallbackData.voltage} max={60} color="#c084fc" unit="V" />
            <TelemetryBar label="T" value={fallbackData.temp} max={50} color="#fbbf24" unit="°C" />
            <TelemetryBar label="DC" value={fallbackData.dc} max={1.0} color="#2dd4bf" unit="" />
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [userRole, setUserRole] = useState(null); 
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // NEW: Keeps the screen blank while checking token
  const [selectedUserNode, setSelectedUserNode] = useState("n1"); 
  const [costInput, setCostInput] = useState(500.00); 

  const [authModal, setAuthModal] = useState(null); 
  const [authMode, setAuthMode] = useState('login'); 
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  const [history, setHistory] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const socketRef = useRef(null);

  const sendControlMessage = (node, costVal, pref, forced) => {
    if (socketRef.current) {
      socketRef.current.emit('update_user_profile', { node, costLimit: parseFloat(costVal), postLimitPreference: pref, forcedMode: forced });
    }
  };

  useEffect(() => {
    // 1. Persistent Login Listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserRole('USER');
      } else {
        setUserRole(null);
      }
      setIsCheckingAuth(false); // Done checking, safe to render UI
    });

    // 2. WebSockets & Timer
    socketRef.current = io(SOCKET_SERVER_URL, { transports: ['websocket'] });
    socketRef.current.on('scada_telemetry_feed', (incomingData) => {
      setHistory((prev) => incomingData.tick === 1 ? [incomingData] : [...prev, incomingData].slice(-150));
    });
    const interval = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    
    return () => { 
      unsubscribe(); // Cleanup listener
      if(socketRef.current) socketRef.current.disconnect(); 
      clearInterval(interval); 
    };
  }, []);

  const currentFrame = history[history.length - 1] || {
    tick: 0, busVoltage: 48.00, hil: { rtt: 44.3 }, pricing: { tariff: 8.00, tier: "OFF-PEAK" },
    n1: { soc: 0, current: 0, voltage: 49.5, temp: 43, dc: 0, phase: "IDLE", mode: "CHARGING", accumCost: 0, costLimit: 500, postLimitPreference: "STANDBY", etc: 0, estTotalCost: 0 },
    n2: { soc: 0, current: 0, voltage: 48.5, temp: 41, dc: 0, phase: "IDLE", mode: "CHARGING", accumCost: 0, costLimit: 800, postLimitPreference: "STANDBY", etc: 0, estTotalCost: 0 },
    n3: { soc: 0, current: 0, voltage: 52.5, temp: 25, dc: 0, phase: "IDLE", mode: "CHARGING", accumCost: 0, costLimit: 300, postLimitPreference: "STANDBY", etc: 0, estTotalCost: 0 }
  };
  const activeUserData = currentFrame[selectedUserNode];

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await setDoc(doc(db, "users", result.user.uid), { email: result.user.email, role: "USER", assignedNode: "n1" }, { merge: true });
      setUserRole('USER');
      setAuthModal(null);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleEmailAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'register') {
        const result = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        await setDoc(doc(db, "users", result.user.uid), { email: result.user.email, role: "USER", assignedNode: "n1" });
        alert("Registration Successful!");
        setAuthMode('login');
      } else {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
        setUserRole('USER');
        setAuthModal(null);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  // --- LOADER (Prevents flashing login screen) ---
  if (isCheckingAuth) {
    return <div className="h-screen w-screen bg-[#0d1117] flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#58a6ff] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  // --- LOGIN GATEWAY ---
  if (!userRole) {
    return (
      <div className="h-screen w-screen bg-[#0d1117] flex flex-col justify-center items-center px-4 font-sans relative">
        <div className="bg-[#161b22] w-full max-w-sm rounded-3xl border border-[#30363d] p-6 text-center shadow-2xl relative z-10">
          <div className="bg-[#21262d] w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#30363d]"><Shield className="w-7 h-7 text-[#58a6ff]" /></div>
          <h2 className="text-xl font-black text-white tracking-tight">EV SCADA TELEMETRY</h2>
          <p className="text-xs text-slate-400 mt-1 mb-6 uppercase tracking-wider">Authentication Gateway</p>
          
          <div className="space-y-3">
            <button onClick={handleGoogleLogin} className="w-full bg-white hover:bg-slate-200 text-slate-900 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md">
              <LogIn className="w-4 h-4 text-red-500" /> Sign In with Google
            </button>
            <button onClick={() => { setAuthModal('email'); setAuthMode('login'); }} className="w-full bg-[#21262d] hover:bg-[#30363d] text-white py-3 rounded-xl border border-[#30363d] font-bold text-xs transition-all flex items-center justify-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" /> Continue with Email
            </button>
          </div>
          <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-[#21262d]"></div>
            <span className="flex-shrink mx-3 text-[10px] font-mono text-slate-500 uppercase">System Operators</span>
            <div className="flex-grow border-t border-[#21262d]"></div>
          </div>
          <button onClick={() => setUserRole('ADMIN')} className="w-full bg-[#58a6ff]/10 border border-[#58a6ff]/30 hover:bg-[#58a6ff]/20 text-[#58a6ff] py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg">
            <ActivitySquare className="w-4 h-4" /> Enter SCADA Admin Matrix
          </button>
        </div>

        {authModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#161b22] w-full max-w-sm rounded-3xl border border-[#30363d] p-6 shadow-2xl relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-black text-lg">{authMode === 'login' ? 'Email Login' : 'Create Account'}</h3>
                <button onClick={() => setAuthModal(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Address</label>
                  <input type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#58a6ff]" placeholder="user@example.com" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Password</label>
                  <input type="password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#58a6ff]" placeholder="••••••••" />
                </div>
                <button type="submit" className="w-full bg-[#58a6ff] hover:bg-[#4ea0fa] text-black py-3.5 rounded-xl font-black text-sm mt-2 transition-all">
                  {authMode === 'login' ? 'Sign In Securely' : 'Register New Account'}
                </button>
              </form>
              <p className="text-xs text-center text-slate-400 mt-4">
                {authMode === 'login' ? "Don't have an account? " : "Already registered? "}
                <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-[#58a6ff] font-bold hover:underline">{authMode === 'login' ? 'Sign up' : 'Log in'}</button>
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- POLISHED MOBILE USER DASHBOARD ---
  if (userRole === 'USER') {
    return (
      <div className="h-screen w-screen bg-[#0d1117] text-slate-100 font-sans flex justify-center overflow-hidden">
        <div className="w-full max-w-md h-full bg-[#0d1117] border-x border-[#30363d] flex flex-col justify-between relative shadow-2xl">
          
          <header className="flex justify-between items-center p-4 border-b border-[#21262d] bg-[#0d1117]/90 backdrop-blur z-10">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-[#56d364] rounded-full animate-ping shadow-[0_0_8px_#56d364]"></div>
              <span className="text-xs font-black tracking-widest text-slate-300">USER DASHBOARD</span>
            </div>
            <button onClick={() => { auth.signOut(); setUserRole(null); }} className="text-[10px] font-mono bg-[#21262d] border border-[#30363d] px-3 py-1.5 rounded-md text-slate-400 font-bold hover:text-white transition-all">SIGN OUT</button>
          </header>

          <main className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            
            {/* Primary Display Card */}
            <div className="bg-[#161b22] rounded-3xl border border-[#30363d] p-6 text-center shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              <div className="text-[10px] font-black tracking-widest text-[#58a6ff] mb-5 uppercase flex items-center justify-center gap-2">
                <Zap className="w-3.5 h-3.5" /> Assigned Bay: Slot 1
              </div>
              <div className="w-48 h-48 mx-auto my-2 relative" style={{ filter: 'drop-shadow(0 0 25px rgba(88,166,255,0.15))' }}>
                <CircularProgressbar value={activeUserData.soc} text={`${activeUserData.soc.toFixed(1)}%`} styles={buildStyles({ pathColor: '#58a6ff', textColor: '#fff', textSize: '22px', fontWeight: 'black', trailColor: '#21262d' })} />
              </div>
              <div className="inline-block mt-6 bg-[#0d1117] px-5 py-2 rounded-full border border-[#30363d] text-xs font-mono font-black text-[#58a6ff] tracking-widest shadow-inner">
                STATUS: {activeUserData.phase}
              </div>
              {activeUserData.mode === "CHARGING" && (
                <div className="text-xs font-bold text-slate-400 mt-4 flex items-center justify-center gap-1.5">
                  Est. Completion: <span className="text-[#56d364] font-black text-sm font-mono">{activeUserData.etc} Mins</span>
                </div>
              )}
            </div>

            {/* Upgraded Financial & Energy Grid */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                
                {/* Live Billing/Earnings Tracker */}
                <div className={`p-5 rounded-2xl border transition-all duration-300 shadow-lg ${
                  activeUserData.mode === "DISCHARGE" 
                    ? "bg-[#1f291d] border-[#56d364]/40" 
                    : "bg-[#161b22] border-[#30363d]"
                }`}>
                  <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
                    <IndianRupee className={`w-3.5 h-3.5 ${activeUserData.mode === "DISCHARGE" ? "text-[#56d364]" : "text-slate-400"}`} /> 
                    {activeUserData.mode === "DISCHARGE" ? "Live Earnings" : "Live Cost"}
                  </span>
                  <span className={`text-3xl font-black font-mono tracking-tight block mt-2 ${
                    activeUserData.mode === "DISCHARGE" ? "text-[#56d364]" : "text-white"
                  }`}>
                    {activeUserData.mode === "DISCHARGE" ? "+" : ""}₹{Math.abs(activeUserData.accumCost).toFixed(2)}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 block mt-1">
                    {activeUserData.mode === "DISCHARGE" ? "Grid Feedback Active" : "Power Draw Cost"}
                  </span>
                </div>

                {/* Grid Tariff Panel */}
                <div className="bg-[#161b22] p-5 rounded-2xl border border-[#30363d] flex flex-col justify-between shadow-lg">
                  <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#58a6ff]" /> Grid Tariff
                  </span>
                  <span className="text-sm font-black text-white mt-2 uppercase tracking-tight">{currentFrame.pricing?.tier || "OFF-PEAK"}</span>
                  <span className="text-sm font-mono font-bold text-[#58a6ff]">₹{currentFrame.pricing?.tariff.toFixed(2) || "8.00"}<span className="text-[10px] text-slate-500">/kWh</span></span>
                </div>
              </div>

              {/* Advanced Real-time Metrics Card */}
              <div className="bg-[#161b22] p-4 rounded-2xl border border-[#30363d] shadow-lg grid grid-cols-2 gap-2 text-center">
                <div className="border-r border-[#21262d] pr-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Loop Velocity</span>
                  <span className="text-sm font-mono font-bold text-white block mt-0.5">{activeUserData.current.toFixed(1)} A</span>
                </div>
                <div className="pl-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Core Thermal Status</span>
                  <span className={`text-sm font-mono font-bold block mt-0.5 ${activeUserData.temp > 45 ? "text-[#ff7b72]" : "text-[#56d364]"}`}>
                    {activeUserData.temp.toFixed(1)} °C
                  </span>
                </div>
              </div>

              {/* Estimated Total Cost Card */}
              <div className="bg-[#161b22] p-5 rounded-2xl border border-[#30363d] flex flex-col justify-between shadow-lg">
                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-[#38bdf8]" /> Est. Total Cost (Full Session)
                </span>
                <div className="flex justify-between items-baseline mt-2">
                  <span className="text-3xl font-black font-mono text-[#38bdf8] tracking-tight">
                    ₹{activeUserData.mode === "DISCHARGE" ? "0.00" : (activeUserData.estTotalCost || 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Based on {selectedUserNode === "n1" ? "40" : selectedUserNode === "n2" ? "60" : "75"} kWh pack
                  </span>
                </div>
              </div>
            </div>

            {/* Controls Section */}
            <div className="bg-[#161b22] rounded-2xl border border-[#30363d] p-5 space-y-6 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-black text-[#58a6ff] uppercase border-b border-[#21262d] pb-3 tracking-widest">
                <Sliders className="w-4 h-4" /> System Controls
              </div>
              
              {/* Limit Slider */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-300 mb-3">
                  <span>Dynamic Spend Ceiling:</span><span className="text-white font-mono font-black">₹{costInput.toFixed(2)}</span>
                </div>
                <input type="range" min="50" max="1500" step="50" value={costInput} onChange={(e) => { setCostInput(parseFloat(e.target.value)); sendControlMessage(selectedUserNode, e.target.value, activeUserData.postLimitPreference, null); }} className="w-full accent-[#58a6ff] bg-[#21262d] h-1.5 rounded-lg appearance-none cursor-pointer" />
              </div>
              
              {/* Post-Charge Priority */}
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Fallback Priority (When Limit Hit)</span>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => sendControlMessage(selectedUserNode, costInput, "STANDBY", null)} className={`py-3 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-2 transition-all ${activeUserData.postLimitPreference === "STANDBY" ? 'bg-[#fbbf24]/10 border-[#fbbf24] text-[#fbbf24]' : 'bg-[#0d1117] border-[#21262d] text-slate-400'}`}>
                    <PowerOff className="w-4 h-4" /> Standby
                  </button>
                  <button onClick={() => sendControlMessage(selectedUserNode, costInput, "DISCHARGE", null)} className={`py-3 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-2 transition-all ${activeUserData.postLimitPreference === "DISCHARGE" ? 'bg-[#2dd4bf]/10 border-[#2dd4bf] text-[#2dd4bf]' : 'bg-[#0d1117] border-[#21262d] text-slate-400'}`}>
                    <BatteryCharging className="w-4 h-4" /> V2G Preference
                  </button>
                </div>
              </div>

              {/* Immediate Manual Overrides */}
              <div className="pt-2 border-t border-[#21262d]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Manual Override Mode</span>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => sendControlMessage(selectedUserNode, costInput, activeUserData.postLimitPreference, "CHARGING")} className={`py-2 rounded-lg border text-[10px] font-black tracking-wider transition-all ${activeUserData.mode === "CHARGING" ? 'bg-[#58a6ff]/20 border-[#58a6ff] text-[#58a6ff]' : 'bg-[#0d1117] border-[#30363d] text-slate-500 hover:text-white'}`}>CHARGE</button>
                  <button onClick={() => sendControlMessage(selectedUserNode, costInput, activeUserData.postLimitPreference, "STANDBY")} className={`py-2 rounded-lg border text-[10px] font-black tracking-wider transition-all ${activeUserData.mode === "STANDBY" ? 'bg-[#fbbf24]/20 border-[#fbbf24] text-[#fbbf24]' : 'bg-[#0d1117] border-[#30363d] text-slate-500 hover:text-white'}`}>STANDBY</button>
                  <button onClick={() => sendControlMessage(selectedUserNode, costInput, activeUserData.postLimitPreference, "DISCHARGE")} className={`py-2 rounded-lg border text-[10px] font-black tracking-wider transition-all ${activeUserData.mode === "DISCHARGE" ? 'bg-[#2dd4bf]/20 border-[#2dd4bf] text-[#2dd4bf]' : 'bg-[#0d1117] border-[#30363d] text-slate-500 hover:text-white'}`}>V2G FEED</button>
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    );
  }

  // --- ADMIN DASHBOARD ---
  const renderLineChart = (title, dataKey1, dataKey2, dataKey3, yDomain, color1, color2, color3, isSingle = false) => (
    <div className="bg-[#161b22] p-3 rounded-2xl border border-[#30363d] flex flex-col h-full w-full shadow-lg">
      <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2 pl-1">{title}</span>
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ left: -15, right: 15, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
            <XAxis dataKey="tick" stroke="#8b949e" tick={{ fontSize: 10, fontWeight: 'bold' }} domain={[0, 460]} type="number" />
            <YAxis domain={yDomain} stroke="#8b949e" tick={{ fontSize: 10, fontWeight: 'bold' }} />
            <Tooltip contentStyle={{ backgroundColor: '#0d1117', borderColor: '#30363d', fontSize: '12px', borderRadius: '8px' }} />
            <Line type="monotone" dataKey={dataKey1} stroke={color1} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            {!isSingle && <Line type="monotone" dataKey={dataKey2} stroke={color2} strokeWidth={2.5} dot={false} isAnimationActive={false} />}
            {!isSingle && <Line type="monotone" dataKey={dataKey3} stroke={color3} strokeWidth={2.5} dot={false} isAnimationActive={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#0d1117] text-slate-100 font-sans antialiased overflow-hidden flex flex-col p-3 gap-3 border-[6px] border-[#010409]">
      <style>
        {`
          @keyframes eqPulse1 { 0%, 100% { height: 10px; } 50% { height: 32px; } }
          @keyframes eqPulse2 { 0%, 100% { height: 20px; } 50% { height: 12px; } }
          @keyframes eqPulse3 { 0%, 100% { height: 8px;  } 50% { height: 26px; } }
          @keyframes eqPulse4 { 0%, 100% { height: 28px; } 50% { height: 16px; } }
          .eq-bar-1 { animation: eqPulse1 0.6s infinite ease-in-out; }
          .eq-bar-2 { animation: eqPulse2 0.8s infinite ease-in-out; }
          .eq-bar-3 { animation: eqPulse3 0.5s infinite ease-in-out; }
          .eq-bar-4 { animation: eqPulse4 0.7s infinite ease-in-out; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}
      </style>

      <header className="flex-none h-[14%] flex gap-3">
        <div className="bg-[#161b22] flex-1 border border-[#30363d] rounded-2xl p-4 flex flex-col justify-between shadow-xl">
          <div className="flex justify-between items-center text-xs text-[#58a6ff] font-black uppercase tracking-widest">
            <span>STATION INTERFACE</span>
            <button onClick={() => setUserRole(null)} className="text-[9px] bg-[#21262d] px-2 py-0.5 rounded border border-[#30363d] text-slate-400 font-bold tracking-widest hover:text-white transition-all">SIGN OUT</button>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white uppercase leading-none">CENTRAL CONTROLLER:</h2>
          <div className="text-xs text-slate-400 font-mono font-bold">
            TICK RATE: <span className="text-[#58a6ff] text-base font-black">{currentFrame.tick}</span> / 460
          </div>
        </div>

        <div className="bg-[#161b22] flex-1 border border-[#30363d] rounded-2xl p-4 flex flex-col justify-between shadow-xl">
          <div className="flex justify-between items-center">
            <h1 className="text-xs font-black tracking-widest text-[#58a6ff] uppercase">OVERVIEW</h1>
            <div className="flex items-center gap-1.5 bg-[#0d1117] px-2.5 py-1 rounded-lg text-xs text-[#58a6ff] font-mono border border-[#30363d] font-bold"><Clock className="w-3.5 h-3.5 text-[#ff7b72]" /> {currentTime}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center h-full mt-1">
            <div className="bg-[#0d1117] rounded-xl border border-[#30363d] flex flex-col justify-center shadow-inner"><span className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-0.5">BUS VOLTAGE</span><span className="text-xl font-black text-white font-mono tracking-tight">{currentFrame.busVoltage.toFixed(2)} V</span></div>
            <div className="bg-[#0d1117] rounded-xl border border-[#30363d] flex flex-col justify-center shadow-inner"><span className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-0.5">GRID STATUS</span><span className="text-xs font-black text-[#56d364] uppercase tracking-widest bg-[#56d364]/10 py-1 px-3 rounded-md mx-auto border border-[#56d364]/20">OPERATIONAL</span></div>
          </div>
        </div>
      </header>

      <section className="flex-none h-[23%] flex gap-3">
        <NodeCard title="NODE 1 (EV1)" data={currentFrame.n1} mainColor="#58a6ff" />
        <NodeCard title="NODE 2 (EV2)" data={currentFrame.n2} mainColor="#ff7b72" />
        <NodeCard title="NODE 3 (EV3)" data={currentFrame.n3} mainColor="#56d364" />
      </section>

      <div className="flex-none h-[3%] flex items-center gap-2 pl-1">
        <ActivitySquare className="w-4.5 h-4.5 text-[#58a6ff]" />
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-300">Core Electro-Thermal Telemetry Matrix</h2>
      </div>

      <section className="flex-1 min-h-0 grid grid-cols-3 grid-rows-2 gap-3">
        {renderLineChart("State of Charge (SOC %)", "n1.soc", "n2.soc", "n3.soc", [0, 100], "#58a6ff", "#ff7b72", "#56d364")}
        {renderLineChart("Loop Current (A)", "n1.current", "n2.current", "n3.current", [0, 40], "#58a6ff", "#ff7b72", "#56d364")}
        {renderLineChart("Battery Voltage (V)", "n1.voltage", "n2.voltage", "n3.voltage", [20, 60], "#58a6ff", "#ff7b72", "#56d364")}
        {renderLineChart("PWM Duty Cycle", "n1.dc", "n2.dc", "n3.dc", [0, 1], "#58a6ff", "#ff7b72", "#56d364")}
        {renderLineChart("Core Temperature (°C)", "n1.temp", "n2.temp", "n3.temp", [20, 50], "#58a6ff", "#ff7b72", "#56d364")}
        {renderLineChart("Bus Voltage (V)", "busVoltage", null, null, [45.5, 48.5], "#c9d1d9", null, null, true)}
      </section>
    </div>
  );
}