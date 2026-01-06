import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  BusFront,
  RotateCcw,
  Trophy,
  XCircle,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Play,
  ArrowUpCircle,
  ArrowDownCircle,
  MapPin,
  RefreshCw,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  LayoutDashboard,
  Settings2,
  Trash2,
  Search,
  CheckCircle,
  X,
  Brain,
  Flag,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Crown,
} from "lucide-react";
import { GameDirection, RouteData, GameStatus, GameDifficulty, GameMode } from "./types";

import { BUS_ROUTES } from "./routes";

const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\b(avenida|avda|av\.?)\b/g, "av"); // Normalize abbreviations
};

type Screen = "home" | "setup" | "playing" | "failures" | "errors";

interface Toast {
  id: string;
  type: "correct" | "error";
  text?: string;
}

const App: React.FC = () => {
  // Navigation
  const [screen, setScreen] = useState<Screen>("home");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Selection
  const [selectedBaseId, setSelectedBaseId] = useState<string>("1");
  const [direction, setDirection] = useState<GameDirection>("ida");

  // Game Logic
  const [selectedStops, setSelectedStops] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>("setup");
  const [difficulty, setDifficulty] = useState<GameDifficulty>("hard");
  const [gameMode, setGameMode] = useState<GameMode>("standard");
  const [checkpointEnabled, setCheckpointEnabled] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [feedback, setFeedback] = useState<{ type: "correct" | "error"; text?: string } | null>(null);
  const [shake, setShake] = useState(false);
  // Options now store objects to handle duplicate stop names and unique keys
  const [availableOptions, setAvailableOptions] = useState<{ id: string; name: string }[]>([]);

  // New Features State
  const [maxProgress, setMaxProgress] = useState<number>(0); // For "Rewind" ghost cards
  const [currentFailures, setCurrentFailures] = useState<number>(0); // Session failures
  const [toasts, setToasts] = useState<Toast[]>([]); // Stacking feedback

  // Customization & Persistence
  const [isEditing, setIsEditing] = useState(false);
  const [completedRoutes, setCompletedRoutes] = useState<string[]>(() => {
    const saved = localStorage.getItem("bus_master_completed_hard");
    return saved ? JSON.parse(saved) : [];
  });
  
  const [failedRoutes, setFailedRoutes] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("bus_master_failures");
    return saved ? JSON.parse(saved) : {};
  });

  const [routeAttempts, setRouteAttempts] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("bus_master_attempts");
    return saved ? JSON.parse(saved) : {};
  });

  const [crowns, setCrowns] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("bus_master_crowns");
    return saved ? JSON.parse(saved) : {};
  });

  // Load and manage unique lines with persistent order
  const [uniqueLines, setUniqueLines] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const linesMap = new Map<string, string>();
    BUS_ROUTES.forEach((r) => {
      const baseId = r.id.split("-")[0];
      if (!linesMap.has(baseId)) {
        linesMap.set(baseId, r.name);
      }
    });

    let baseList = Array.from(linesMap.entries()).map(([id, name]) => ({ id, name }));
    const savedOrder = localStorage.getItem("bus_master_order");

    if (savedOrder) {
      const orderIds = JSON.parse(savedOrder) as string[];
      baseList.sort((a, b) => orderIds.indexOf(a.id) - orderIds.indexOf(b.id));
    }

    setUniqueLines(baseList);
  }, []);

  const saveOrder = (newList: typeof uniqueLines) => {
    setUniqueLines(newList);
    localStorage.setItem("bus_master_order", JSON.stringify(newList.map((l) => l.id)));
  };

  const moveLine = (index: number, direction: "up" | "down") => {
    const newList = [...uniqueLines];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;

    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    saveOrder(newList);
  };

  // Persist Completions
  useEffect(() => {
    localStorage.setItem("bus_master_completed_hard", JSON.stringify(completedRoutes));
  }, [completedRoutes]);

  useEffect(() => {
    localStorage.setItem("bus_master_failures", JSON.stringify(failedRoutes));
  }, [failedRoutes]);

  useEffect(() => {
    localStorage.setItem("bus_master_attempts", JSON.stringify(routeAttempts));
  }, [routeAttempts]);

  useEffect(() => {
    localStorage.setItem("bus_master_crowns", JSON.stringify(crowns));
  }, [crowns]);

  const markCompleted = (routeId: string) => {
    setCompletedRoutes((prev) => {
      if (prev.includes(routeId)) return prev;
      return [...prev, routeId];
    });
  };

  const recordFailures = (routeId: string, count: number) => {
    if (count === 0) return;
    setFailedRoutes((prev) => ({
        ...prev,
        [routeId]: (prev[routeId] || 0) + count
    }));
  };

  const recordCrown = (routeId: string) => {
    setCrowns((prev) => ({
      ...prev,
      [routeId]: (prev[routeId] || 0) + 1
    }));
  };

  // Sound Synth
  const playSound = (type: "success" | "error") => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const currentRoute = useMemo(() => {
    // Look for a route that matches both the base ID and the requested direction suffix
    const match = BUS_ROUTES.find(r => {
      const parts = r.id.split("-");
      const base = parts[0];
      const routeDirection = parts[parts.length - 1];
      return base === selectedBaseId && routeDirection === direction;
    });

    if (match) return match;

    // Fallback: look for ANY route with the same base ID (useful for circular routes)
    return BUS_ROUTES.find(r => r.id.split("-")[0] === selectedBaseId) || BUS_ROUTES[0];
  }, [selectedBaseId, direction]);

  const targetOrder = useMemo(() => currentRoute.stops, [currentRoute]);

  const availableDirections = useMemo(() => {
    const routes = BUS_ROUTES.filter(r => r.id.split("-")[0] === selectedBaseId);
    const hasIda = routes.some(r => r.id.endsWith("-ida"));
    const hasVuelta = routes.some(r => r.id.endsWith("-vuelta"));
    // A route is effectively ida/vuelta if it has those suffixes OR if it's the only route for that base (like circular)
    const canDoIda = hasIda || routes.length === 1;
    const canDoVuelta = hasVuelta || routes.length === 1;
    
    return { hasIda: canDoIda, hasVuelta: canDoVuelta, count: routes.length };
  }, [selectedBaseId]);

  // Options sorted alphabetically for pedagogical speed finding
  const sortedOptions = useMemo(() => {
    return [...availableOptions].sort((a, b) => a.name.localeCompare(b.name));
  }, [availableOptions]);

  const filteredOptions = useMemo(() => {
    if (!searchText) return sortedOptions;
    const lowerSearch = normalizeText(searchText);
    return sortedOptions.filter((s) => normalizeText(s.name).includes(lowerSearch));
  }, [sortedOptions, searchText]);

  const startNewGame = useCallback(() => {
    setSelectedStops([]);
    // Assign unique IDs to each stop instance to handle duplicates correctly
    setAvailableOptions(targetOrder.map((name, i) => ({ id: `${i}-${name}`, name })));
    setGameStatus("playing");
    setScreen("playing");
    setShake(false);
    setMaxProgress(0);
    setCurrentFailures(0);
    setToasts([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Increment attempts if not in study mode
    if (gameMode !== "study") {
        setRouteAttempts((prev) => ({
            ...prev,
            [currentRoute.id]: (prev[currentRoute.id] || 0) + 1
        }));
    }

    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  }, [targetOrder, gameMode, currentRoute.id]);

  const addToast = (type: "correct" | "error", text?: string) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
        setToasts((prev) => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const handleStopClick = (option: { id: string; name: string }) => {
    if (gameStatus !== "playing") return;

    inputRef.current?.focus();

    const nextIndex = selectedStops.length;
    if (option.name === targetOrder[nextIndex]) {
      // Success
      playSound("success");
      addToast("correct", option.name);

      const newSelected = [...selectedStops, option.name];
      setSelectedStops(newSelected);
      setMaxProgress(Math.max(maxProgress, newSelected.length));
      
      setAvailableOptions((prev) => prev.filter((o) => o.id !== option.id));
      setSearchText("");

      if (newSelected.length === targetOrder.length) {
        setGameStatus("success");
        // Only record completion and failures if NOT in study mode
        if (gameMode !== "study") {
             if (difficulty === "hard" && !checkpointEnabled) {
               markCompleted(currentRoute.id);
               // Award crown if zero failures
               if (currentFailures === 0) {
                 recordCrown(currentRoute.id);
               }
             }
             recordFailures(currentRoute.id, currentFailures);
        }
      }
    } else {
      // Failure
      playSound("error");
      setShake(true);
      addToast("error");
      setCurrentFailures(c => c + 1);
      setSearchText("");
      inputRef.current?.focus();

      if (difficulty === "hard") {
        setTimeout(() => {
          setShake(false);
          
          if (gameMode === "standard") {
            // Practice Hard Mode: Reset to beginning
            setSelectedStops([]);
            setAvailableOptions(targetOrder.map((name, i) => ({ id: `${i}-${name}`, name })));
          } else {
             // Other Hard Modes (shouldn't be reached in Study, but safe fallback): Go back 3 stops
            const backSteps = 3;
            const newIndex = Math.max(0, selectedStops.length - backSteps);
            
            if (newIndex < selectedStops.length) {
                const keptStops = selectedStops.slice(0, newIndex);
                setSelectedStops(keptStops);
                const restoredOptions = targetOrder.map((name, i) => ({ id: `${i}-${name}`, name })).filter((_, i) => i >= newIndex);
                setAvailableOptions(restoredOptions);
            }
          }
          
          if (inputRef.current) inputRef.current.focus();
        }, 500);
      } else {
        setTimeout(() => setShake(false), 500);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filteredOptions.length > 0) {
      handleStopClick(filteredOptions[0]);
    }
  };

  const resetProgress = () => {
    if (window.confirm("¿Estás seguro de que quieres borrar el progreso de completadas y coronas?")) {
      setCompletedRoutes([]);
      setFailedRoutes({});
      setRouteAttempts({});
      setCrowns({});
      localStorage.removeItem("bus_master_completed_hard");
      localStorage.removeItem("bus_master_failures");
      localStorage.removeItem("bus_master_attempts");
      localStorage.removeItem("bus_master_crowns");
    }
  };

  // Screens
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center space-y-6 py-6 px-4 animate-in fade-in duration-500">
      <div className="text-center space-y-2 mb-4">
        <div className="bg-indigo-700 p-4 rounded-[2rem] inline-block shadow-2xl mb-2">
          <BusFront className="w-14 h-14 text-white" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Bus Master</h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">Escuela de Conductores Profesional</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
        <button
          onClick={() => {
            setScreen("setup");
            setGameStatus("setup");
            setGameMode("standard");
          }}
          className="col-span-2 group bg-white p-4 rounded-[2rem] border-2 border-slate-200 shadow-xl hover:border-indigo-600 hover:shadow-2xl transition-all flex flex-col items-center gap-3 active:scale-95 py-8"
        >
          <div className="bg-emerald-100 p-4 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <Play className="w-8 h-8 fill-current" />
          </div>
          <span className="font-black text-lg uppercase tracking-tighter text-center">Pon en práctica</span>
          <p className="text-slate-400 font-bold text-[10px] text-center hidden sm:block">Entrena tu memoria y domina las rutas.</p>
        </button>

        <button
          onClick={() => setScreen("failures")}
          className="group bg-white p-4 rounded-[2rem] border-2 border-slate-200 shadow-xl hover:border-violet-600 hover:shadow-2xl transition-all flex flex-col items-center gap-3 active:scale-95 py-8"
        >
          <div className="bg-violet-100 p-4 rounded-2xl text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
            <Trophy className="w-8 h-8" />
          </div>
          <span className="font-black text-lg uppercase tracking-tighter text-center">Progreso</span>
          <p className="text-slate-400 font-bold text-[10px] text-center hidden sm:block">Rutas completadas (Difícil).</p>
        </button>

        <button
          onClick={() => setScreen("errors")}
          className="group bg-white p-4 rounded-[2rem] border-2 border-slate-200 shadow-xl hover:border-rose-600 hover:shadow-2xl transition-all flex flex-col items-center gap-3 active:scale-95 py-8"
        >
          <div className="bg-rose-100 p-4 rounded-2xl text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <span className="font-black text-lg uppercase tracking-tighter text-center">Errores</span>
          <p className="text-slate-400 font-bold text-[10px] text-center hidden sm:block">Ranking de fallos y línea.</p>
        </button>
      </div>
    </div>
  );

  const renderProgress = () => {
    // Calculate global stats
    const totalSegments = BUS_ROUTES.length;
    const completedSegments = completedRoutes.length;
    const globalPercent = Math.round((completedSegments / totalSegments) * 100);

    return (
      <div className="max-w-4xl mx-auto space-y-8 py-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setScreen("home")} className="bg-white p-3 rounded-2xl border-2 border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm transition-all">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Progreso Difícil</h2>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                Total Completado: {completedSegments} / {totalSegments} ({globalPercent}%)
              </p>
            </div>
          </div>
          {completedRoutes.length > 0 && (
            <button
              onClick={resetProgress}
              className="flex items-center gap-2 text-rose-500 font-black uppercase text-[10px] tracking-widest bg-rose-50 px-4 py-2 rounded-xl hover:bg-rose-100 transition-all"
            >
              <Trash2 className="w-4 h-4" /> Reset
            </button>
          )}
        </div>

        {/* Global Progress Bar */}
        <div className="mx-4 bg-slate-200 h-6 rounded-full overflow-hidden border border-slate-300/50">
          <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_20px_rgba(16,185,129,0.4)]" style={{ width: `${globalPercent}%` }} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
          {uniqueLines.map((line) => {
            // Find all route segments belonging to this base line ID
            const lineSegments = BUS_ROUTES.filter(r => r.id.split("-")[0] === line.id);
            
            const doneCount = lineSegments.reduce((acc, r) => {
              return acc + (completedRoutes.includes(r.id) ? 1 : 0);
            }, 0);

            const segmentsCount = lineSegments.length;

            let status: "complete" | "partial" | "none" = "none";
            if (doneCount === segmentsCount && segmentsCount > 0) status = "complete";
            else if (doneCount > 0) status = "partial";

            const lineCrowns = lineSegments.reduce((sum, r) => sum + (crowns[r.id] || 0), 0);

            return (
              <div
                key={line.id}
                className={`p-5 rounded-[2rem] border-2 flex items-center justify-between group transition-all relative overflow-hidden ${
                  status === "complete" ? "bg-emerald-50 border-emerald-200" : status === "partial" ? "bg-orange-50 border-orange-200" : "bg-white border-slate-100"
                }`}
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        status === "complete" ? "bg-emerald-200 text-emerald-700" : status === "partial" ? "bg-orange-200 text-orange-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      Línea {line.id}
                    </span>
                    {status === "complete" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    {lineCrowns > 0 && (
                      <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg border border-amber-100 shadow-sm animate-in zoom-in-50">
                        <Crown className="w-3 h-3 fill-amber-400" />
                        <span className="text-[10px] font-black">{lineCrowns}</span>
                      </div>
                    )}
                  </div>
                  <h4 className="font-black text-slate-700 text-lg leading-tight mb-2">{line.name}</h4>

                  {/* Mini Status Bars */}
                  <div className="flex gap-1">
                    {lineSegments.map(segment => (
                      <div 
                        key={segment.id}
                        className={`h-1.5 w-8 rounded-full ${completedRoutes.includes(segment.id) ? "bg-emerald-500" : "bg-slate-200"}`} 
                        title={segment.id.split('-').slice(1).join('-')} 
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (status === "complete") return; // Nothing to do
                    
                    // Pick the first incomplete segment
                    const nextSegment = lineSegments.find(s => !completedRoutes.includes(s.id)) || lineSegments[0];
                    const suffix = nextSegment.id.split('-').slice(1).join('-');
                    
                    // Map suffix to direction if possible, otherwise default to ida
                    const nextDir: GameDirection = (suffix === "vuelta") ? "vuelta" : "ida";

                    setSelectedBaseId(line.id);
                    setDirection(nextDir);
                    setDifficulty("hard");
                    setGameMode("standard"); // Force standard mode (no ghost hints)
                    setGameStatus("setup"); // Force setup update then start? Or go direct generally requires setup first usually
                    setScreen("setup");
                  }}
                  disabled={status === "complete"}
                  className={`p-3 rounded-xl transition-all shadow-md active:scale-95 ${
                    status === "complete"
                      ? "bg-emerald-100 text-emerald-300 cursor-default"
                      : "bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white border border-slate-100 hover:border-indigo-600"
                  }`}
                >
                  {status === "complete" ? <CheckCircle className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
                </button>

                {/* Background Progress Bar Absolute */}
                <div
                  className={`absolute bottom-0 left-0 h-1 transition-all duration-500 ${
                    status === "complete" ? "bg-emerald-400 w-full" : status === "partial" ? "bg-orange-400 w-1/2" : "bg-transparent w-0"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderErrors = () => {
      const linesWithStats = uniqueLines.map(line => {
          const totalFailures = Object.entries(failedRoutes).reduce((acc, [routeId, count]) => {
              if (routeId.split("-")[0] === line.id) return acc + (count as number);
              return acc;
          }, 0);
          return { ...line, totalFailures };
      }).sort((a, b) => b.totalFailures - a.totalFailures);

      return (
        <div className="max-w-4xl mx-auto space-y-8 py-8 animate-in fade-in duration-500">
           <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
                <button onClick={() => setScreen("home")} className="bg-white p-3 rounded-2xl border-2 border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm transition-all">
                <ChevronLeft className="w-6 h-6" />
                </button>
                <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Listado de Errores</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                    Fallos acumulados e intentos totales
                </p>
                </div>
            </div>
            {(Object.keys(failedRoutes).length > 0) && (
              <button
                onClick={resetProgress}
                className="flex items-center gap-2 text-rose-500 font-black uppercase text-[10px] tracking-widest bg-rose-50 px-4 py-2 rounded-xl hover:bg-rose-100 transition-all"
              >
                <Trash2 className="w-4 h-4" /> Reset
              </button>
            )}
           </div>

           <div className="grid grid-cols-1 gap-4 px-4 overflow-y-auto pb-8">
               {linesWithStats.map(line => (
                   <div key={line.id} className="p-5 rounded-[2rem] border-2 border-slate-100 bg-white flex items-center justify-between shadow-sm">
                       <div>
                           <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${line.totalFailures > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                    Línea {line.id}
                                </span>
                           </div>
                           <h4 className="font-black text-slate-700 text-lg leading-tight">{line.name}</h4>
                       </div>
                       <div className="text-right">
                           <div className={`text-2xl font-black ${line.totalFailures > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                               {line.totalFailures} <span className="text-xs font-bold uppercase text-slate-400">Fallos</span>
                           </div>
                           {(routeAttempts[line.id + "-ida"] || routeAttempts[line.id + "-vuelta"] || routeAttempts[line.id] || 0) > 0 && (
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {
                                  // Sum attempts for all direction keys for this line base ID
                                  Object.entries(routeAttempts).reduce((sum, [k, v]) => {
                                      if (k.startsWith(line.id)) return sum + (v as number);
                                      return sum;
                                  }, 0)
                                } Intentos
                            </div>
                           )}
                       </div>
                   </div>
               ))}
           </div>
        </div>
      )
  };

  const renderSetup = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in slide-in-from-left duration-500">
      {/* List of Routes */}
      <div className="lg:col-span-5 space-y-4">
        <div className="flex justify-between items-center px-2">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Selecciona la Línea</h2>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              isEditing ? "bg-indigo-600 text-white shadow-lg" : "bg-slate-200 text-slate-500 hover:bg-slate-300"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            {isEditing ? "Hecho" : "Editar Orden"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {uniqueLines.map((line, index) => (
            <div key={line.id} className="relative group">
              <button
                onClick={() => {
                  if (!isEditing) {
                    setSelectedBaseId(line.id);
                    // Pequeño timeout para dar sensación de respuesta y asegurar renderizado
                    setTimeout(() => {
                      const card = document.getElementById("selected-route-card");
                      if (card) {
                        card.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }, 100);
                  }
                }}
                className={`w-full text-left p-5 rounded-3xl border-2 transition-all flex items-center justify-between overflow-hidden ${
                  selectedBaseId === line.id && !isEditing ? "bg-white border-indigo-600 shadow-xl ring-4 ring-indigo-50" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                }`}
              >
                <div className="flex items-center gap-4">
                  {isEditing && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveLine(index, "up");
                        }}
                        className="p-1 hover:bg-slate-100 rounded text-indigo-600 disabled:opacity-30"
                        disabled={index === 0}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveLine(index, "down");
                        }}
                        className="p-1 hover:bg-slate-100 rounded text-indigo-600 disabled:opacity-30"
                        disabled={index === uniqueLines.length - 1}
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black">LÍNEA {line.id}</span>
                    </div>
                    <span className={`font-black text-sm leading-tight block ${selectedBaseId === line.id && !isEditing ? "text-indigo-600" : "text-slate-700"}`}>{line.name}</span>
                  </div>
                </div>
                {!isEditing && (
                  <ChevronRight className={`w-5 h-5 transition-transform ${selectedBaseId === line.id ? "translate-x-1 text-indigo-600" : "opacity-0 group-hover:opacity-100 text-slate-300"}`} />
                )}
              </button>
              {selectedBaseId === line.id && !isEditing && <div className="absolute left-0 top-0 bottom-0 w-2 bg-indigo-600 rounded-l-3xl" />}
            </div>
          ))}
        </div>

        {/* Direction Switch */}
      </div>

      {/* Preview and Start */}
      <div className="lg:col-span-7">
        <div id="selected-route-card" className="bg-white rounded-[2.5rem] shadow-2xl p-8 border-2 border-slate-200 h-full flex flex-col sticky top-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl shadow-inner transition-colors flex flex-col items-center justify-center min-w-[80px] ${direction === "ida" ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"}`}>
                <span className="text-xs font-black uppercase tracking-wider block">Línea</span>
                <span className="text-3xl font-black">{selectedBaseId}</span>
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-tight mb-1">
                  {currentRoute.name}
                </h2>
                <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 font-black text-xs uppercase tracking-wider px-2 py-1 rounded-lg ${direction === "ida" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                        {direction === "ida" ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                        {direction}
                    </span>
                    <span className="text-slate-400 font-bold text-xs">•</span>
                    <span className="text-slate-500 font-bold text-xs">
                    {currentRoute.stops.length} Paradas
                    </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 flex gap-3">
            <button
              onClick={() => {
                setDifficulty("normal");
                setGameMode("standard");
              }}
              className={`flex-1 py-3 px-2 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex flex-col items-center gap-1 ${
                difficulty === "normal" ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-white border-slate-200 text-slate-400 hover:border-indigo-200"
              }`}
            >
              <span>Normal</span>
              <span className="text-[8px] opacity-70 normal-case">Permite fallos</span>
            </button>
            <button
              onClick={() => {
                setDifficulty("hard");
                setGameMode("standard");
              }}
              className={`flex-1 py-3 px-2 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex flex-col items-center gap-1 ${
                difficulty === "hard" ? "bg-rose-50 border-rose-500 text-rose-700" : "bg-white border-slate-200 text-slate-400 hover:border-rose-200"
              }`}
            >
              <span>Difícil</span>
              <span className="text-[8px] opacity-70 normal-case">Un fallo y reinicias</span>
            </button>
            <button
              onClick={() => {
                setDifficulty("study");
                setGameMode("study");
              }}
              className={`flex-1 py-3 px-2 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex flex-col items-center gap-1 ${
                difficulty === "study" ? "bg-sky-50 border-sky-500 text-sky-700" : "bg-white border-slate-200 text-slate-400 hover:border-sky-200"
              }`}
            >
              <span>Memoria</span>
              <span className="text-[8px] opacity-70 normal-case">Ves siguiente parada</span>
            </button>
          </div>

          <button
            onClick={startNewGame}
            className={`w-full text-white py-6 rounded-3xl font-black text-xl uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4 group ${
              direction === "ida" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-orange-600 hover:bg-orange-500"
            } mb-8`}
          >
            <Play className="fill-current w-6 h-6 group-hover:scale-110 transition-transform" />
            Iniciar Entrenamiento
          </button>

          {availableDirections.count > 1 && (
             <div className="mb-6 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Sentido del Trayecto</h3>
                <div className="flex p-1 bg-white rounded-2xl relative shadow-sm border border-slate-200">
                <button
                    onClick={() => setDirection("ida")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all z-10 ${
                    direction === "ida" ? "text-indigo-700" : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                    <ArrowUpCircle className="w-4 h-4" />
                    IDA
                </button>
                <button
                    onClick={() => setDirection("vuelta")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all z-10 ${
                    direction === "vuelta" ? "text-indigo-700" : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                    <ArrowDownCircle className="w-4 h-4" />
                    VUELTA
                </button>
                <div
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-slate-100 shadow-inner rounded-xl transition-all duration-300 ease-out border border-slate-200 ${
                    direction === "vuelta" ? "translate-x-[calc(100%+4px)]" : "translate-x-0"
                    }`}
                />
                </div>
            </div>
          )}

          {gameMode === "study" ? (
              <div className="flex-1 overflow-y-auto mb-8 pr-4 custom-scrollbar max-h-[50vh] min-h-[300px]">
                <div className="space-y-4">
                  {targetOrder.map((stop, idx) => (
                    <div key={`${currentRoute.id}-${idx}`} className="flex items-center gap-5 group animate-in slide-in-from-left duration-300">
                      <div className="relative flex flex-col items-center shrink-0">
                        <div
                          className={`w-10 h-10 flex items-center justify-center rounded-2xl font-black text-sm border-2 transition-all ${
                            idx === 0
                              ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-100 shadow-lg"
                              : idx === targetOrder.length - 1
                              ? "bg-rose-500 text-white border-rose-600 shadow-rose-100 shadow-lg"
                              : "bg-slate-50 text-slate-400 border-slate-200 group-hover:border-indigo-400 group-hover:text-indigo-600"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        {idx < targetOrder.length - 1 && <div className="w-1 h-4 bg-slate-100" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-black transition-colors ${idx === 0 || idx === targetOrder.length - 1 ? "text-slate-800" : "text-slate-600 group-hover:text-indigo-600"}`}>{stop}</span>
                        {idx === 0 && <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Salida Principal</span>}
                        {idx === targetOrder.length - 1 && <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Fin de Trayecto</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center mb-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 h-[300px]">
                 <div className="bg-slate-200 p-4 rounded-full text-slate-400 mb-4">
                    <Play className="w-8 h-8 fill-current" />
                 </div>
                 <p className="text-slate-400 font-bold text-center max-w-[200px] text-sm">
                    Inicia el entrenamiento para ver y ordenar las paradas.
                 </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20 font-sans">
      {/* Header */}
      <header className="bg-indigo-700 border-b-4 border-indigo-900 p-6 shadow-xl mb-8">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div
            className="flex items-center gap-4 cursor-pointer"
            onClick={() => {
              setScreen("home");
              setGameStatus("setup");
            }}
          >
            <div className="bg-white p-2 rounded-2xl shadow-inner">
              <BusFront className="w-8 h-8 text-indigo-700" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-white leading-none">Bus Master</h1>
              <p className="text-xs font-bold text-indigo-200 opacity-80 uppercase tracking-widest mt-1">

                {screen === "home" ? "Escuela de Conductores Profesional" : screen === "failures" ? "PROGRESO" : screen === "errors" ? "ERRORES" : "PON EN PRÁCTICA"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {screen !== "home" && (
              <button onClick={() => setScreen("home")} className="bg-indigo-800/50 p-2 rounded-lg text-white hover:bg-indigo-800/80 transition-colors" title="Menú Principal">
                <LayoutDashboard className="w-5 h-5" />
              </button>
            )}
            {gameStatus === "playing" && (
              <div className="hidden sm:flex items-center gap-3 bg-indigo-800/50 px-4 py-2 rounded-xl border border-indigo-400/30">
                <div className="text-right">
                  <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest">En Trayecto</p>
                  <p className="text-white font-bold text-sm truncate max-w-[200px]">{currentRoute.name}</p>
                </div>
                <div className={`p-2 rounded-lg ${direction === "ida" ? "bg-emerald-500" : "bg-orange-500"}`}>
                  {direction === "ida" ? <ArrowUpCircle className="w-5 h-5 text-white" /> : <ArrowDownCircle className="w-5 h-5 text-white" />}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Subheader */}
        {screen !== "home" && (
          <div className="mt-6 -mx-6 -mb-6 py-3 px-6 flex shadow-inner bg-indigo-900 overflow-x-auto">
            <div className="flex gap-2 min-w-max mx-auto">
              <button
                onClick={() => {
                  setScreen("setup");
                  setGameMode("standard");
                  setGameStatus("setup");
                }}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all ${
                  (screen === "setup" || screen === "playing")
                    ? "bg-emerald-500 text-white shadow-lg scale-105"
                    : "bg-indigo-800 text-indigo-300 hover:bg-indigo-700 hover:text-white"
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                Práctica
              </button>

              <button
                onClick={() => setScreen("failures")}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all ${
                  screen === "failures"
                    ? "bg-violet-500 text-white shadow-lg scale-105"
                    : "bg-indigo-800 text-indigo-300 hover:bg-indigo-700 hover:text-white"
                }`}
              >
                <Trophy className="w-4 h-4" />
                Progreso
              </button>

              <button
                onClick={() => setScreen("errors")}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all ${
                  screen === "errors"
                    ? "bg-rose-500 text-white shadow-lg scale-105"
                    : "bg-indigo-800 text-indigo-300 hover:bg-indigo-700 hover:text-white"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Errores
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4">
        {screen === "home" && renderHome()}
        {screen === "setup" && renderSetup()}

        {screen === "failures" && renderProgress()}
        {screen === "errors" && renderErrors()}

        {/* Playing & Success Screens (Integrated) */}
        {(gameStatus === "playing" || gameStatus === "success" || gameStatus === "failed") && screen === "playing" && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-32">
            {/* Feedback Overlay - Updated to Top Compact */}
            {/* Feedback Overlay - Stacked Toasts */}
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] pointer-events-none w-full max-w-sm px-4 flex flex-col items-center gap-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`py-3 px-6 rounded-2xl shadow-2xl flex items-center justify-center gap-3 transform transition-all border-4 animate-in slide-in-from-top-4 fade-in duration-300 w-full ${
                          toast.type === "correct" ? "bg-emerald-600 border-white/20 text-white" : "bg-rose-500 border-rose-400 text-white"
                        }`}
                      >
                        {toast.type === "correct" ? <CheckCircle className="w-10 h-10 shrink-0" /> : <X className="w-10 h-10 shrink-0" />}
                        <div className="text-left min-w-0">
                          <span className={`${toast.type === "correct" ? "text-2xl" : "text-xl"} font-black uppercase tracking-tighter block leading-none`}>
                              {toast.type === "correct" ? "¡Correcto!" : "¡Incorrecto!"}
                          </span>
                          {toast.text && <span className={`${toast.type === "correct" ? "text-xl text-white underline decoration-wavy decoration-white/30" : "text-sm opacity-90"} font-black block mt-1 break-words`}>{toast.text}</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Access Grid */}
            <div className="flex gap-2 px-2 py-4 overflow-x-auto custom-scrollbar pb-4 snap-x">
              {uniqueLines.map((line) => (
                <button
                  key={line.id}
                  onClick={() => {
                    const newId = line.id;
                    const newDir = "ida";

                    setSelectedBaseId(newId);
                    setDirection(newDir);

                    const targetId = `${newId}-${newDir}`;
                    const route = BUS_ROUTES.find((r) => r.id === targetId) || BUS_ROUTES.find((r) => r.id.startsWith(newId)) || BUS_ROUTES[0];
                    const stops = route.stops;

                    setSelectedStops([]);
                    setAvailableOptions(stops.map((name, i) => ({ id: `${i}-${name}`, name })));
                    setGameStatus("playing");
                    setShake(false);
                    setMaxProgress(0);
                    setCurrentFailures(0);
                    setToasts([]);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className={`w-10 h-10 shrink-0 snap-center rounded-xl font-black text-xs flex items-center justify-center transition-all bg-white shadow-sm border-2 ${
                    selectedBaseId === line.id ? "border-indigo-600 text-indigo-600 ring-2 ring-indigo-100" : "border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500"
                  }`}
                >
                  {line.id}
                </button>
              ))}
            </div>

            {/* Game Status Sections (Moved Up) */}
            {gameStatus === "playing" && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="h-px bg-slate-200 flex-1" />
                  <h3 className="font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Selecciona la siguiente parada (A-Z)</h3>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                {gameStatus === "success" ? (
                  <div className="bg-emerald-50 border-4 border-emerald-100 p-8 rounded-[2rem] text-center space-y-6 animate-in zoom-in-95">
                    <div className="bg-emerald-500 w-20 h-20 rounded-full flex items-center justify-center text-white mx-auto shadow-lg shadow-emerald-200">
                      <Trophy className="w-10 h-10 fill-current" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-emerald-800 uppercase tracking-tighter mb-2">¡Línea Completada!</h2>
                      <p className="text-emerald-600 font-bold">Has recorrido todas las paradas correctamente.</p>
                    </div>

                    <div className="flex flex-col gap-3 max-w-xs mx-auto pt-4">
                      {/* Suggest opposite route if available */}
                      {(() => {
                        const oppositeDir = direction === "ida" ? "vuelta" : "ida";
                        const oppositeId = `${selectedBaseId}-${oppositeDir}`;
                        const hasOpposite = BUS_ROUTES.some((r) => r.id === oppositeId);

                        return (
                          hasOpposite && (
                            <button
                              className="bg-indigo-600 hover:bg-indigo-500 text-white w-full py-4 rounded-xl font-black uppercase text-sm tracking-widest shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                              onClick={() => {
                                setDirection(oppositeDir);
                                setTimeout(() => {
                                  setScreen("setup");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }, 50);
                              }}
                            >
                              <RefreshCw className="w-5 h-5" />
                              Hacer la {oppositeDir}
                            </button>
                          )
                        );
                      })()}

                      <button
                        onClick={() => startNewGame()}
                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 w-full py-4 rounded-xl font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-5 h-5" />
                        Reiniciar Reto
                      </button>

                      <button
                        onClick={() => {
                          setScreen("home");
                          setGameStatus("setup");
                        }}
                        className="bg-white border-2 border-slate-200 text-slate-500 hover:text-slate-700 w-full py-4 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-slate-50 transition-all"
                      >
                        Menú Principal
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <form onSubmit={handleSearchSubmit} className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        ref={inputRef}
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Escribe para filtrar paradas..."
                        className="w-full pl-12 pr-12 py-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 uppercase tracking-wide bg-white shadow-sm"
                        autoFocus
                      />
                      {searchText && (
                        <button
                          type="button"
                          tabIndex={-1} // Skip focus on clear button
                          onClick={() => {
                            setSearchText("");
                            inputRef.current?.focus();
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <XCircle className="w-5 h-5 fill-current" />
                        </button>
                      )}
                    </form>

                    {/* Denser grid and alphabetical order for faster pedagogical search */}
                    {/* Display cards grid: Always in standard mode, OR in study mode only when searching */}
                    {searchText && (gameMode === "standard" || gameMode === "study") && (
                      <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {filteredOptions.length === 0 ? (
                            <div className="col-span-full py-8 text-center text-slate-400 font-bold italic opacity-70">No se encuentran paradas {searchText ? `con "${searchText}"` : ""}</div>
                          ) : (
                            filteredOptions.slice(0, 3).map((option) => {
                              const isSingleMatch = filteredOptions.length === 1;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()} // Prevent focus loss from input on mouse click, but allows Tab focus
                                  onClick={() => handleStopClick(option)}
                                  className={`p-3 rounded-2xl shadow-sm hover:shadow-lg transition-all active:scale-95 flex items-center justify-center text-center font-bold text-xs min-h-[60px] group relative overflow-hidden outline-none 
                              focus:ring-4 focus:ring-indigo-400 focus:scale-105 focus:z-20
                              ${isSingleMatch 
                                  ? "bg-emerald-500 text-white border-emerald-600" 
                                  : gameMode === "study" 
                                  ? "bg-sky-50 border-sky-100 text-sky-800 hover:bg-sky-600 hover:text-white" 
                                  : "bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-700 text-slate-700"}`}
                                >
                                  <span className="relative z-10 group-hover:scale-105 transition-transform duration-200 line-clamp-2 flex items-center gap-2">
                                    {option.name}
                                    {isSingleMatch && <ChevronRight className="w-4 h-4" />}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {filteredOptions.length > 3 && (
                          <div className="col-span-full py-2 text-center text-slate-400 font-bold italic opacity-70 flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2 text-sm justify-center">
                              <Search className="w-4 h-4 opacity-40" />
                              <span>Hay {filteredOptions.length} paradas disponibles</span>
                            </div>
                            <span className="text-[10px] opacity-60">Mostrando las 3 primeras. Sigue escribiendo para filtrar más.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {gameStatus === "success" && (
              <div className="bg-indigo-600 p-12 rounded-[3rem] text-center shadow-2xl animate-in zoom-in-90 duration-500 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent" />
                <div className="relative z-10">
                  <div className="bg-white w-20 h-20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-12">
                    <Trophy className="w-10 h-10 text-indigo-600" />
                  </div>
                  <h2 className="text-4xl font-black mb-2 uppercase tracking-tighter">¡Ruta Completada!</h2>
                  <p className="text-indigo-100 mb-8 font-bold text-lg max-w-md mx-auto">
                    Has demostrado un conocimiento perfecto de la {currentRoute.name} en sentido {direction}.
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <button
                      onClick={startNewGame}
                      className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl active:scale-95 text-sm"
                    >
                      Reiniciar Reto
                    </button>
                    <button
                      onClick={() => setScreen("home")}
                      className="bg-indigo-900 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-950 transition-all shadow-xl active:scale-95 text-sm"
                    >
                      Menú Principal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {gameStatus === "failed" && (
              <div className="bg-rose-600 p-12 rounded-[3rem] text-center shadow-2xl text-white animate-in shake duration-500">
                <div className="bg-white/20 w-20 h-20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 border-4 border-white/10">
                  <XCircle className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-4xl font-black mb-2 uppercase tracking-tighter">¡Error de Ruta!</h2>
                <p className="text-rose-100 mb-8 font-bold text-lg italic opacity-90">"Un buen conductor nunca olvida sus paradas..."</p>
                <div className="flex items-center justify-center gap-4 bg-rose-900/40 py-4 px-8 rounded-2xl w-max mx-auto animate-pulse border border-white/10">
                  <RotateCcw className="w-5 h-5 animate-spin" />
                  <span className="font-black uppercase tracking-[0.2em] text-xs">Volviendo al inicio...</span>
                </div>
              </div>
            )}

            {gameStatus === "playing" && selectedStops.length > 0 && (
              <div className="max-w-md mx-auto mb-6 px-4 animate-in fade-in slide-in-from-top duration-700">
                <div className="flex items-center gap-4 px-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300 shadow-inner" />
                  <div className="flex-1 h-0.5 bg-slate-100 relative flex items-center justify-center">
                    <div className="absolute bg-white px-5 py-2.5 rounded-[1.25rem] border-2 border-slate-100 shadow-lg flex items-center gap-3 min-w-max">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-inner ${direction === "ida" ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"}`}>
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Última Parada</span>
                        <span className="text-xs font-black text-slate-700 uppercase leading-none">{selectedStops[selectedStops.length - 1]}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300 shadow-inner" />
                </div>
              </div>
            )}

            {/* The Stacking Visual Section (Moved Down) */}
            <div className="bg-white rounded-[2rem] shadow-2xl p-6 border-2 border-slate-200 overflow-hidden relative">
              
              {/* Absolute Count - Top Right */}
              <div className="absolute top-0 right-0 bg-slate-100 px-4 py-2 rounded-bl-2xl border-b border-l border-slate-200 font-black text-indigo-600 flex items-center gap-3 shadow-sm z-10">
                <span className="text-xl tabular-nums">{selectedStops.length}</span>
                <div className="w-px h-4 bg-slate-300" />
                <span className="text-slate-400 tabular-nums">{targetOrder.length}</span>
              </div>

              <div className="flex flex-col gap-4 mb-6 pt-2">
                {/* Header Info with Line Number and Tags */}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2 pr-24">
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider">
                      LÍNEA {selectedBaseId}
                    </span>
                    
                    {/* Direction Tag */}
                    <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                        direction === "ida" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                    }`}>
                        {direction === "ida" ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                        {direction}
                    </span>

                    {/* Checkpoint Toggle */}
                    {gameMode !== "study" && (
                      <button
                        onClick={() => setCheckpointEnabled(!checkpointEnabled)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                          checkpointEnabled ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-slate-100 text-slate-400 border-slate-200"
                        }`}
                        title="Si activas checkpoint, no cuenta para el progreso difícil."
                      >
                        <Flag className="w-3 h-3" />
                        Checkpoint
                      </button>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-none pr-24">{currentRoute.name}</h2>
                </div>

                {/* Direction Switch - Conditional - Compact Row */}
                {availableDirections.count > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (direction !== "ida") {
                            const newDir = "ida";
                            setDirection(newDir);
                            const targetId = `${selectedBaseId}-${newDir}`;
                            const route = BUS_ROUTES.find((r) => r.id === targetId) || BUS_ROUTES.find((r) => r.id.startsWith(selectedBaseId)) || BUS_ROUTES[0];
                            const stops = route.stops;
                            setSelectedStops([]);
                            setAvailableOptions(stops.map((name, i) => ({ id: `${i}-${name}`, name })));
                            setGameStatus("playing");
                            setShake(false);
                            setMaxProgress(0);
                            setCurrentFailures(0);
                            setToasts([]);
                            if (inputRef.current) inputRef.current.focus();
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase tracking-wide flex items-center gap-1 ${
                            direction === "ida" ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        }`}
                      >
                        <ArrowUpCircle className="w-3 h-3" /> IDA
                      </button>
                      <button
                        onClick={() => {
                          if (direction !== "vuelta") {
                            const newDir = "vuelta";
                            setDirection(newDir);
                            const targetId = `${selectedBaseId}-${newDir}`;
                            const route = BUS_ROUTES.find((r) => r.id === targetId) || BUS_ROUTES.find((r) => r.id.startsWith(selectedBaseId)) || BUS_ROUTES[0];
                            const stops = route.stops;
                            setSelectedStops([]);
                            setAvailableOptions(stops.map((name, i) => ({ id: `${i}-${name}`, name })));
                            setGameStatus("playing");
                            setShake(false);
                            setMaxProgress(0);
                            setCurrentFailures(0);
                            setToasts([]);
                            if (inputRef.current) inputRef.current.focus();
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase tracking-wide flex items-center gap-1 ${
                            direction === "vuelta" ? "bg-orange-500 text-white shadow-sm" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        }`}
                      >
                        <ArrowDownCircle className="w-3 h-3" /> VUELTA
                      </button>
                    </div>
                )}
              </div>

              <div
                className={`flex flex-wrap gap-2 content-start items-start min-h-[90px] p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 transition-all ${
                  shake ? "shake border-rose-500 border-solid bg-rose-50" : ""
                }`}
              >
                {selectedStops.length === 0 && (
                  <div className="flex flex-col items-center justify-center w-full py-4 text-slate-400 animate-pulse">
                    <MapPin className="w-8 h-8 mb-1 opacity-20" />
                    <p className="font-black uppercase text-[10px] tracking-[0.3em]">Pulsa la parada de salida</p>
                  </div>
                )}
                {selectedStops.map((stop, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      // Rewind to this stop (keep it and previous ones)
                      const newSelected = selectedStops.slice(0, idx + 1);
                      setSelectedStops(newSelected);

                      // Restore available options: All stops that come AFTER this index
                      // We reconstruct from targetOrder to ensure we get the correct IDs back
                      const restoredOptions = targetOrder.map((name, i) => ({ id: `${i}-${name}`, name })).filter((_, i) => i > idx);

                      setAvailableOptions(restoredOptions);

                      // Clear feedback and shake to ensure clean state
                      setToasts([]);
                      setShake(false);
                      // Focus input
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className={`text-white pl-2 pr-4 py-2 rounded-xl font-bold text-xs shadow-md animate-in zoom-in-75 duration-300 flex items-center gap-2 border-b-2 group transition-all hover:scale-105 active:scale-95 text-left leading-tight ${
                      direction === "ida" ? "bg-emerald-600 border-emerald-800 hover:bg-emerald-500" : "bg-orange-600 border-orange-800 hover:bg-orange-500"
                    }`}
                  >
                    <span className="bg-white text-slate-800 w-6 h-6 flex items-center justify-center rounded text-[10px] font-black shadow-sm shrink-0">{idx + 1}</span>
                    <span className="whitespace-normal">{stop}</span>
                  </button>
                ))}

                {/* REWIND GHOST CARDS */}
                {maxProgress > selectedStops.length && targetOrder.slice(selectedStops.length, maxProgress).map((stopName, i) => {
                    const realIndex = selectedStops.length + i;
                    return (
                        <button
                             key={`ghost-${realIndex}`}
                             onClick={() => {
                                 // Forward Rewind: Restore up to this ghost stop
                                 const restoredStops = targetOrder.slice(0, realIndex + 1);
                                 setSelectedStops(restoredStops);
                                 
                                 const restoredOptions = targetOrder.map((name, k) => ({ id: `${k}-${name}`, name })).filter((_, k) => k > realIndex);
                                 setAvailableOptions(restoredOptions);
                                 if (inputRef.current) inputRef.current.focus();
                             }}
                             className="opacity-50 hover:opacity-80 transition-opacity pl-2 pr-4 py-2 rounded-xl font-bold text-xs border-2 border-slate-300 bg-slate-100 flex items-center gap-2 text-slate-500 cursor-pointer"
                        >
                             <span className="bg-slate-300 text-slate-500 w-6 h-6 flex items-center justify-center rounded text-[10px] font-black shrink-0">{realIndex + 1}</span>
                             <span className="whitespace-normal">{stopName}</span>
                        </button>
                    )
                })}

                {/* Ghost Hint for Study/Memorize Mode - Interactivo e Integral */}
                {gameMode === "study" && targetOrder.slice(selectedStops.length, selectedStops.length + 1).map((stopName, i) => {
                  const realIndex = selectedStops.length + i;
                  return (
                    <button
                      key={`future-ghost-${realIndex}`}
                      onClick={() => {
                        handleStopClick({ id: `${realIndex}-${stopName}`, name: stopName });
                      }}
                      className="group appearance-none bg-sky-50/50 hover:bg-sky-100 text-sky-700/60 hover:text-sky-700 pl-2 pr-4 py-2 rounded-xl font-bold text-xs border-2 border-sky-100 hover:border-sky-400 flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95 outline-none focus:ring-2 focus:ring-sky-300"
                    >
                      <span className="bg-white/80 text-sky-500 w-6 h-6 flex items-center justify-center rounded text-[10px] font-black shrink-0 shadow-sm group-hover:scale-110 transition-transform">{realIndex + 1}</span>
                      <span className="whitespace-normal text-left">{stopName}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6">
                <div className="bg-slate-100 h-4 rounded-full p-0.5 overflow-hidden border border-slate-200 shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out shadow-lg ${
                      selectedStops.length === targetOrder.length ? "bg-indigo-500" : direction === "ida" ? "bg-emerald-500" : "bg-orange-500"
                    }`}
                    style={{ width: `${(selectedStops.length / targetOrder.length) * 100}%` }}
                  >
                    <div className="w-full h-full bg-white/20 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Persistent Navigation */}
      {screen === "playing" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-50">
          <button
            onClick={() => {
              setScreen("setup");
              setGameStatus("setup");
            }}
            className="bg-slate-900 text-white px-6 py-4 rounded-[1.5rem] shadow-2xl hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest border-b-4 border-slate-950"
          >
            <ChevronLeft className="w-4 h-4" />
            Elegir otra Línea
          </button>
          <button
            onClick={startNewGame}
            className="bg-white text-slate-900 px-6 py-4 rounded-[1.5rem] shadow-2xl hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest border-2 border-slate-200 border-b-4"
          >
            <RotateCcw className="w-4 h-4" />
            Resetear
          </button>
        </div>
      )}

      {/* Global Styles for Scrollbar and Animations */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 20px;
          border: 2px solid #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @keyframes animate-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: animate-spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
