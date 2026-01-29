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
  LogOut,
  Mail,
  LogIn,
  User,
  FileText,
  Layers,
  Sparkles,
  HelpCircle,
  Save,
} from "lucide-react";
import { GameDirection, RouteData, GameStatus, GameDifficulty, GameMode } from "./types";

import { BUS_ROUTES } from "./routes";
import { supabase } from "./src/lib/supabase";


const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\b(avenida|avda|av\.?)\b/g, "av"); // Normalize abbreviations
};

import { ALL_EXAMS } from "./src/data/exams";
import { EXAMENES_2025 } from "./src/data/examen_2025";
import { ALL_SIMULACROS } from "./src/data/simulacros";
import { Exam } from "./types";

type Screen = "home" | "setup" | "playing" | "failures" | "errors" | "auth" | "quiz" | "quiz_selection" | "quiz_category_selection" | "examen_2025_selection";


interface Toast {
  id: string;
  type: "correct" | "error";
  text?: string;
}

const App: React.FC = () => {
  const [direction, setDirection] = useState<GameDirection>("ida");
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [session, setSession] = useState<any>(() => {
    const saved = localStorage.getItem("bus_master_session");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const [username, setUsername] = useState<string>("");
  const [newUsername, setNewUsername] = useState<string>("");

  // Supabase User Identity
  const [userId, setUserId] = useState<string>(() => {
    // 1. Prioridad: Sesión guardada
    const savedSession = localStorage.getItem("bus_master_session");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed?.user?.id) return parsed.user.id;
      } catch (e) {}
    }
    // 2. ID Anónimo guardado
    return localStorage.getItem("bus_master_anonymous_id") || crypto.randomUUID();
  });

  useEffect(() => {
    // Si no estamos logueados, guardamos este como el ID anónimo
    if (!session) {
      localStorage.setItem("bus_master_anonymous_id", userId);
    }
    localStorage.setItem("bus_master_user_id", userId);
  }, [userId, session]);

  useEffect(() => {
    if (session) {
      localStorage.setItem("bus_master_session", JSON.stringify(session));
    } else {
      localStorage.removeItem("bus_master_session");
    }
  }, [session]);

  // Auth Subscription
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) setUserId(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        // Al cerrar sesión, LIMPIAMOS TODO EL PROGRESO
        resetLocalState();
        const anonId = crypto.randomUUID();
        setUserId(anonId);
        localStorage.setItem("bus_master_anonymous_id", anonId);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const resetLocalState = () => {
    setCompletedRoutes([]);
    setFailedRoutes({});
    setRouteAttempts({});
    setCrowns({});
    setFailedQuizQuestions([]);
    setBlankQuizQuestions([]);
    setQuizHighScores({});
    // Limpiar localStorage de datos de usuario
    localStorage.removeItem("bus_master_completed_hard");
    localStorage.removeItem("bus_master_failures");
    localStorage.removeItem("bus_master_attempts");
    localStorage.removeItem("bus_master_crowns");
    localStorage.removeItem("bus_master_quiz_errors");
    localStorage.removeItem("bus_master_quiz_high_scores");
    localStorage.removeItem("bus_master_session");
  };

  useEffect(() => {
    if (session?.user) {
      const metaUsername = session.user.user_metadata?.username;
      const initialName = metaUsername || session.user.email?.split("@")[0] || "Conductor";
      setUsername(initialName);
      setNewUsername(initialName);
    }
  }, [session]);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    const { error } = await supabase.auth.updateUser({
      data: { username: newUsername.trim() }
    });
    if (error) alert("Error al actualizar: " + error.message);
    else {
      setUsername(newUsername.trim());
      alert("¡Nombre actualizado!");
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) alert(error.message);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) alert("Error al iniciar sesión: " + error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });
      if (error) alert("Error al registrarse: " + error.message);
      else alert("¡Registro completado! Revisa tu correo para verificar tu cuenta.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setScreen("home");
  };

  // Navigation
  const [screen, setScreen] = useState<Screen>("home");


  const inputRef = React.useRef<HTMLInputElement>(null);

  // Selection
  const [selectedBaseId, setSelectedBaseId] = useState<string>("1");


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

  // Quiz State
  const [quizType, setQuizType] = useState<"random" | "errors" | "dudas">("random");
  const [quizCategory, setQuizCategory] = useState<"exams" | "simulacros" | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizFinished, setQuizFinished] = useState(false);
  const [failedQuizQuestions, setFailedQuizQuestions] = useState<number[]>(() => {
    const saved = localStorage.getItem("bus_master_quiz_errors");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isDoubtful, setIsDoubtful] = useState(false);
  const [quizHighScores, setQuizHighScores] = useState<Record<string, { correct: number, total: number }>>(() => {
    const saved = localStorage.getItem("bus_master_quiz_high_scores");
    return saved ? JSON.parse(saved) : {};
  });
  const [quizQuestionSuccessStreaks, setQuizQuestionSuccessStreaks] = useState<Record<number, number>>(() => {
    const saved = localStorage.getItem("bus_master_quiz_streaks");
    return saved ? JSON.parse(saved) : {};
  });
  const [blankQuizQuestions, setBlankQuizQuestions] = useState<number[]>(() => {
    const saved = localStorage.getItem("bus_master_quiz_blanks");
    return saved ? JSON.parse(saved) : [];
  });
  const [userAnswers, setUserAnswers] = useState<Record<number, string | null>>({});

  // Resume Logic
  const [resumeDialog, setResumeDialog] = useState<{ visible: boolean; exam: Exam | null; type: "random" | "errors" | "dudas" }>({ visible: false, exam: null, type: "random" });

  const [quizProgress, setQuizProgress] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem("bus_master_quiz_progress_v2");
    return saved ? JSON.parse(saved) : {};
  });

  const saveQuizProgress = (examId: string, progress: any) => {
    setQuizProgress(prev => {
      const newProgress = {
        ...prev,
        [examId]: {
          ...progress,
          timestamp: new Date().toISOString()
        }
      };
      localStorage.setItem("bus_master_quiz_progress_v2", JSON.stringify(newProgress));
      return newProgress;
    });
  };

  const clearQuizProgress = (examId: string) => {
    setQuizProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[examId];
      localStorage.setItem("bus_master_quiz_progress_v2", JSON.stringify(newProgress));
      return newProgress;
    });
  };

  const getQuizProgress = (examId: string) => {
    return quizProgress[examId];
  };

  useEffect(() => {
    if (screen === 'quiz' && !quizFinished && quizQuestions.length > 0) {
       const examId = selectedExam?.id || `temp-${quizType}`; 
       // Only save if it's a real exam structure or sufficient context
       saveQuizProgress(examId, {
         questions: quizQuestions,
         currentIndex: currentQuizIndex,
         score: quizScore,
         answers: userAnswers,
         selectedAnswer,
         showExplanation,
         isDoubtful,
         quizType,
         selectedExam // Save exam metadata too
       });
    } else if (screen === 'quiz' && quizFinished) {
       const examId = selectedExam?.id || `temp-${quizType}`;
       clearQuizProgress(examId);
    }
  }, [screen, quizQuestions, currentQuizIndex, quizScore, userAnswers, selectedAnswer, showExplanation, isDoubtful, quizFinished, selectedExam, quizType]);

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

  useEffect(() => {
    localStorage.setItem("bus_master_quiz_errors", JSON.stringify(failedQuizQuestions));
  }, [failedQuizQuestions]);

  useEffect(() => {
    localStorage.setItem("bus_master_quiz_high_scores", JSON.stringify(quizHighScores));
  }, [quizHighScores]);

  useEffect(() => {
    localStorage.setItem("bus_master_quiz_blanks", JSON.stringify(blankQuizQuestions));
  }, [blankQuizQuestions]);

  useEffect(() => {
    localStorage.setItem("bus_master_quiz_streaks", JSON.stringify(quizQuestionSuccessStreaks));
  }, [quizQuestionSuccessStreaks]);

  // Cloud Sync Logic
  const loadOnlineProgress = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data && !error) {
        if (data.completed_routes) setCompletedRoutes(data.completed_routes);
        if (data.failed_routes) setFailedRoutes(data.failed_routes);
        if (data.route_attempts) setRouteAttempts(data.route_attempts);
        if (data.crowns) setCrowns(data.crowns);
        if (data.failed_quiz_questions) setFailedQuizQuestions(data.failed_quiz_questions);
        if (data.quiz_high_scores) setQuizHighScores(data.quiz_high_scores);
        if (data.quiz_question_success_streaks) setQuizQuestionSuccessStreaks(data.quiz_question_success_streaks);
        if (data.blank_quiz_questions) setBlankQuizQuestions(data.blank_quiz_questions);
        if (data.quiz_progress) setQuizProgress(data.quiz_progress);
        if (data.line_order && data.line_order.length > 0) {
          // Update uniqueLines if order is stored
          const linesMap = new Map<string, string>();
          BUS_ROUTES.forEach((r) => {
            const baseId = r.id.split("-")[0];
            if (!linesMap.has(baseId)) linesMap.set(baseId, r.name);
          });
          const baseList = Array.from(linesMap.entries()).map(([id, name]) => ({ id, name }));
          baseList.sort((a, b) => data.line_order.indexOf(a.id) - data.line_order.indexOf(b.id));
          setUniqueLines(baseList);
        }
      }
    } catch (e) {
      console.error("Error loading progress from Supabase:", e);
    }
  }, [userId]);

  const saveOnlineProgress = useCallback(async () => {
    if (!session || !userId) return; // SOLO guarda si hay sesión activa
    try {
      await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          user_email: session?.user?.email || null,
          completed_routes: completedRoutes,
          failed_routes: failedRoutes,
          route_attempts: routeAttempts,
          crowns: crowns,
          line_order: uniqueLines.map(l => l.id),
          failed_quiz_questions: failedQuizQuestions,
          quiz_high_scores: quizHighScores,
          quiz_question_success_streaks: quizQuestionSuccessStreaks,
          blank_quiz_questions: blankQuizQuestions,
          quiz_progress: quizProgress,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      // console.log("Progreso guardado en la nube correctamente");
    } catch (e) {
      console.error("Error saving progress to Supabase:", e);
    }
  }, [userId, session, completedRoutes, failedRoutes, routeAttempts, crowns, uniqueLines, failedQuizQuestions, quizHighScores, quizQuestionSuccessStreaks, blankQuizQuestions, quizProgress]);

  // Initial load from cloud
  useEffect(() => {
    loadOnlineProgress();
  }, [loadOnlineProgress]);

  // Auto-sync to cloud when local data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      saveOnlineProgress();
    }, 3000); // 3 second debounce
    return () => clearTimeout(timer);
  }, [completedRoutes, failedRoutes, routeAttempts, crowns, uniqueLines, failedQuizQuestions, quizHighScores, quizQuestionSuccessStreaks, blankQuizQuestions, quizProgress, saveOnlineProgress]);


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

  const startQuiz = (type: "random" | "errors" | "dudas", exam?: Exam, forceStart: boolean = false) => {
    // Check for saved progress first
    // Check for saved progress first
    if (!forceStart) {
      let saveId = null;
      if (type === "random" && exam) saveId = exam.id;
      else if (type === "errors") saveId = "temp-errors";
      else if (type === "dudas") saveId = "temp-dudas";
      
      if (saveId) {
        const saved = getQuizProgress(saveId);
        if (saved && !saved.finished) {
          setResumeDialog({ visible: true, exam: exam || saved.selectedExam, type });
          return;
        }
      }
    }

    let questions = [];
    if (type === "random") {
      if (!exam) {
        setScreen("quiz_category_selection");
        return;
      }
      setSelectedExam(exam);
      questions = [...exam.preguntas]
        .filter(q => !q.enunciado.toUpperCase().includes("IMPUGNADA"))
        .sort(() => Math.random() - 0.5);
    } else if (type === "errors") {
      const allQuestions = [...ALL_EXAMS, ...ALL_SIMULACROS, ...EXAMENES_2025].flatMap(e => e.preguntas);
      const allErrors = allQuestions.filter(q => 
        failedQuizQuestions.includes(Number(q.id)) && 
        !q.enunciado.toUpperCase().includes("IMPUGNADA")
      );
      
      if (allErrors.length < 20) {
        alert("No tienes suficientes errores para un test de repaso (mínimo 20).");
        return;
      }
      setSelectedExam(null);
      questions = allErrors.sort(() => Math.random() - 0.5).slice(0, 20);
    } else if (type === "dudas") {
      const allQuestions = [...ALL_EXAMS, ...ALL_SIMULACROS, ...EXAMENES_2025].flatMap(e => e.preguntas);
      const allDudas = allQuestions.filter(q => 
        blankQuizQuestions.includes(Number(q.id)) && 
        !q.enunciado.toUpperCase().includes("IMPUGNADA")
      );
      
      if (allDudas.length < 5) {
        alert("No tienes suficientes dudas para un test de repaso (mínimo 5).");
        return;
      }
      setSelectedExam(null);
      questions = allDudas.sort(() => Math.random() - 0.5).slice(0, Math.min(20, allDudas.length));
    }
    
    setQuizType(type);
    setQuizQuestions(questions);
    setCurrentQuizIndex(0);
    setQuizScore({ correct: 0, total: questions.length });
    setQuizFinished(false);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setIsDoubtful(false);
    setUserAnswers({});
    setScreen("quiz");
  };

  const resumeQuiz = () => {
    const { exam, type } = resumeDialog;
    if (!exam) return;
    const saved = getQuizProgress(exam.id);
    if (saved) {
      setQuizType(saved.quizType);
      setSelectedExam(saved.selectedExam);
      setQuizQuestions(saved.questions);
      setCurrentQuizIndex(saved.currentIndex);
      setQuizScore(saved.score);
      setUserAnswers(saved.answers);
      setSelectedAnswer(saved.selectedAnswer);
      setShowExplanation(saved.showExplanation);
      setIsDoubtful(saved.isDoubtful);
      setQuizFinished(false);
      setScreen("quiz");
    }
    setResumeDialog({ visible: false, exam: null, type: "random" });
  };

  const startRandomCategoryQuiz = () => {
    const list = quizCategory === "exams" ? ALL_EXAMS : ALL_SIMULACROS;
    const allQs = list.flatMap(e => e.preguntas);
    if (allQs.length === 0) return;

    const shuffled = [...allQs].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 20);

    const virtualExam: Exam = {
      id: `random-${quizCategory}-${Date.now()}`,
      examen: quizCategory === "exams" ? "Test Aleatorio Temas" : "Simulacro Mezclado",
      temario: "Preguntas variadas de toda la categoría",
      preguntas: selected
    };

    startQuiz("random", virtualExam);
  };

  const handleQuizAnswer = (answer: string) => {
    if (selectedAnswer !== null) return;
    
    setSelectedAnswer(answer);
    const currentQ = quizQuestions[currentQuizIndex];
    const userAnsBase = answer.split(')')[0].trim().toLowerCase();
    const isCorrect = userAnsBase === currentQ.respuesta.toLowerCase();

    const qId = Number(currentQ.id);
    
    // Guardar respuesta en la sesión
    setUserAnswers(prev => ({ ...prev, [currentQuizIndex]: answer }));
    
    // Si se contesta (bien o mal), deja de ser una "duda" pendiente
    setBlankQuizQuestions(prev => prev.filter(id => id !== qId));

    if (isCorrect) {
      playSound("success");
      setQuizScore(prev => ({ ...prev, correct: prev.correct + 1 }));
      
      if (isDoubtful) {
        if (quizQuestionSuccessStreaks[qId] === undefined) {
          setQuizQuestionSuccessStreaks(prev => ({ ...prev, [qId]: 0 }));
        }
        setFailedQuizQuestions(prev => prev.includes(qId) ? prev : [...prev, qId]);
      } else {
        const hasStreak = quizQuestionSuccessStreaks[qId] !== undefined;
        
        if (hasStreak) {
          setQuizQuestionSuccessStreaks(prev => {
            const currentStreak = (prev[qId] || 0) + 1;
            if (currentStreak >= 8) {
              setFailedQuizQuestions(old => old.filter(id => id !== qId));
              const { [qId]: _, ...rest } = prev;
              return rest;
            }
            return { ...prev, [qId]: currentStreak };
          });
        } else if (failedQuizQuestions.includes(qId)) {
          setFailedQuizQuestions(old => old.filter(id => id !== qId));
        }
      }
    } else {
      playSound("error");
      setFailedQuizQuestions(prev => {
        if (prev.includes(qId)) return prev;
        return [...prev, qId];
      });
    }

    setShowExplanation(true);
    
    setTimeout(() => {
      if (currentQuizIndex < quizQuestions.length - 1) {
        const nextIdx = currentQuizIndex + 1;
        setCurrentQuizIndex(nextIdx);
        setSelectedAnswer(userAnswers[nextIdx] || null);
        setShowExplanation(userAnswers[nextIdx] !== null);
        setIsDoubtful(false);
      } else {
        finishQuiz();
      }
    }, 2000);
  };

  const finishQuiz = () => {
    setQuizFinished(true);
    
    // Clear saved progress
    let saveId = null;
    if (quizType === "random" && selectedExam) saveId = selectedExam.id;
    else if (quizType === "errors") saveId = "temp-errors";
    else if (quizType === "dudas") saveId = "temp-dudas";
    
    if (saveId) {
        clearQuizProgress(saveId);
    }
    
    // Calcular nota final con penalización: un fallo resta un acierto
    let corrects = 0;
    let errors = 0;
    
    quizQuestions.forEach((q, idx) => {
        const ans = userAnswers[idx];
        if (ans) {
            const userAnsBase = ans.split(')')[0].trim().toLowerCase();
            if (userAnsBase === q.respuesta.toLowerCase()) {
                corrects++;
            } else {
                errors++;
            }
        }
    });

    const finalCorrect = Math.max(0, corrects - errors);
    const finalScore = { correct: finalCorrect, total: quizQuestions.length };
    
    setQuizScore(finalScore);

    if (selectedExam) {
      setQuizHighScores(prev => {
        const prevBest = prev[selectedExam.id]?.correct || 0;
        if (finalCorrect > prevBest) {
          return {
            ...prev,
            [selectedExam.id]: finalScore
          };
        }
        return prev;
      });
    }
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
    <div className="flex flex-col items-center justify-center space-y-8 py-8 px-4 animate-in fade-in duration-700">
      {/* BRAND HEADER */}
      <div className="text-center space-y-3 mb-2">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-indigo-600 blur-2xl opacity-20 rounded-full animate-pulse"></div>
          <div className="relative bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 rounded-[2.5rem] shadow-2xl border-4 border-white/10">
            <BusFront className="w-12 h-12 text-white" />
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase leading-none">Bus Master</h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Escuela de Conductores</p>
        </div>
      </div>

      {/* AUTH BUTTON */}
      <div className="relative">
        {session ? (
          <button 
            onClick={() => setScreen("auth")}
            className="flex items-center gap-3 bg-white border-2 border-slate-100 pl-2 pr-5 py-2 rounded-2xl hover:border-indigo-600 hover:shadow-xl transition-all group"
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-sm text-white font-black shadow-lg group-hover:rotate-12 transition-transform">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="text-left">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Conductor</span>
               <span className="text-xs font-black text-slate-700 truncate max-w-[120px]">{username}</span>
            </div>
          </button>
        ) : (
          <button 
            onClick={() => setScreen("auth")}
            className="flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 hover:shadow-2xl transition-all shadow-lg font-black uppercase text-xs tracking-widest"
          >
            <LogIn className="w-4 h-4" />
            Iniciar Sesión
          </button>
        )}
      </div>

      <div className="w-full max-w-2xl space-y-10">
        
        {/* SECTION 1: LÍNEAS */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-px flex-1 bg-slate-100"></div>
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Gestión de Líneas</h2>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                setScreen("setup");
                setGameStatus("setup");
                setGameMode("standard");
              }}
              className="col-span-2 group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] border-b-8 border-emerald-900/30"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <Play className="w-24 h-24 text-white fill-current" />
              </div>
              <div className="relative flex items-center gap-6">
                 <div className="bg-white/20 p-4 rounded-2xl text-white backdrop-blur-sm border border-white/20">
                   <Play className="w-8 h-8 fill-current" />
                 </div>
                 <div className="text-left">
                    <span className="block font-black text-2xl text-white uppercase tracking-tighter">Pon en práctica</span>
                    <span className="text-white/70 font-bold text-xs uppercase tracking-widest">Entrena tu memoria</span>
                 </div>
              </div>
            </button>

            <button
              onClick={() => setScreen("failures")}
              className="group bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-md hover:border-violet-600 hover:shadow-xl transition-all flex flex-col items-center gap-3 text-center"
            >
              <div className="bg-violet-100 p-4 rounded-2xl text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <Trophy className="w-6 h-6" />
              </div>
              <span className="font-black text-xs uppercase tracking-widest text-slate-800">Progreso</span>
            </button>

            <button
              onClick={() => setScreen("errors")}
              className="group bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-md hover:border-rose-600 hover:shadow-xl transition-all flex flex-col items-center gap-3 text-center"
            >
              <div className="bg-rose-100 p-4 rounded-2xl text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <span className="font-black text-xs uppercase tracking-widest text-slate-800">Errores</span>
            </button>
          </div>
        </div>

        {/* SECTION 2: CUESTIONARIOS */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 px-2">
            <div className="h-px flex-1 bg-slate-100"></div>
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Preparación Examen</h2>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => startQuiz("random")}
              className="group relative overflow-hidden bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-md hover:border-indigo-600 hover:shadow-xl transition-all text-left flex items-center gap-6"
            >
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform">
                  <Brain className="w-24 h-24" />
               </div>
               <div className="bg-indigo-100 p-4 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                 <FileText className="w-8 h-8" />
               </div>
               <div>
                  <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tighter">Hacer Test</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{ALL_EXAMS.length + ALL_SIMULACROS.length} Pruebas disponibles</p>
               </div>
            </button>

            <button
              onClick={() => startQuiz("errors")}
              disabled={failedQuizQuestions.length < 20}
              className={`group relative overflow-hidden p-8 rounded-[2.5rem] border-2 transition-all text-left flex items-center gap-6 ${
                failedQuizQuestions.length >= 20 
                ? "bg-white border-slate-100 shadow-md hover:border-amber-600 hover:shadow-xl" 
                : "bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed"
              }`}
            >
               {failedQuizQuestions.length >= 20 && (
                <div className="absolute top-4 right-4 bg-rose-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-lg animate-bounce">
                  {Math.max(0, Math.floor((failedQuizQuestions.length - 20) / 10) + 1)}
                </div>
               )}
               <div className={`p-4 rounded-2xl transition-colors ${
                 failedQuizQuestions.length >= 20 ? "bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white" : "bg-slate-200 text-slate-400"
               }`}>
                 <RotateCcw className="w-8 h-8" />
               </div>
               <div>
                  <h3 className={`font-black text-2xl uppercase tracking-tighter ${failedQuizQuestions.length >= 20 ? "text-slate-800" : "text-slate-400"}`}>Test de Errores</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    {failedQuizQuestions.length < 20 ? `Mínimo 20 errores (${failedQuizQuestions.length}/20)` : `${Math.max(0, Math.floor((failedQuizQuestions.length - 20) / 10) + 1)} Repasos pendientes`}
                  </p>
               </div>
            </button>

            <button
              onClick={() => startQuiz("dudas")}
              disabled={blankQuizQuestions.length < 5}
              className={`group relative overflow-hidden p-8 rounded-[2.5rem] border-2 transition-all text-left flex items-center gap-6 ${
                blankQuizQuestions.length >= 5 
                ? "bg-white border-slate-100 shadow-md hover:border-violet-600 hover:shadow-xl" 
                : "bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed"
              }`}
            >
               <div className={`p-4 rounded-2xl transition-colors ${
                 blankQuizQuestions.length >= 5 ? "bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white" : "bg-slate-200 text-slate-400"
               }`}>
                 <HelpCircle className="w-8 h-8" />
               </div>
               <div>
                  <h3 className={`font-black text-2xl uppercase tracking-tighter ${blankQuizQuestions.length >= 5 ? "text-slate-800" : "text-slate-400"}`}>Test de Dudas</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    {blankQuizQuestions.length < 5 ? `Mínimo 5 dudas (${blankQuizQuestions.length}/5)` : `${blankQuizQuestions.length} Preguntas sin contestar`}
                  </p>
               </div>
            </button>
          </div>
        </div>

        {/* SECTION 3: EXAMEN 2025 */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 px-2">
            <div className="h-px flex-1 bg-slate-100"></div>
            <h2 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.4em]">Promoción 2025</h2>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>
          
          <button
              onClick={() => setScreen("examen_2025_selection")}
              className="w-full group relative overflow-hidden bg-rose-600 p-8 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all text-left flex items-center gap-6"
            >
               <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                  <Flag className="w-24 h-24 text-white" />
               </div>
               <div className="bg-white/20 p-4 rounded-2xl text-white backdrop-blur-sm border border-white/20">
                 <Flag className="w-8 h-8 fill-current" />
               </div>
               <div>
                  <h3 className="font-black text-2xl text-white uppercase tracking-tighter">Tests Oficiales 2025</h3>
                  <p className="text-[10px] font-bold text-rose-200 uppercase tracking-[0.2em]">Líneas, Igualdad y Ordenanzas</p>
               </div>
          </button>
        </div>

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

  const renderQuiz = () => {
    if (quizFinished) {
      return (
        <div className="max-w-md mx-auto py-12 px-6 animate-in zoom-in-95 duration-500">
          <div className="bg-white rounded-[3rem] shadow-2xl p-8 border-2 border-slate-100 text-center">
            <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-12 ${
              quizScore.correct / quizScore.total >= 0.5 ? "bg-emerald-500" : "bg-rose-500"
            }`}>
              {quizScore.correct / quizScore.total >= 0.5 ? <Trophy className="w-10 h-10 text-white" /> : <XCircle className="w-10 h-10 text-white" />}
            </div>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">¡Test Finalizado!</h2>
            <div className="space-y-1 mb-8">
              <p className="text-slate-600 font-black text-xl">
                Nota final: <span className="text-indigo-600">{quizScore.correct}</span> de <span className="text-slate-600">{quizScore.total}</span>
              </p>
              <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {(() => {
                  let corrects = 0;
                  let errors = 0;
                  let blanks = 0;
                  quizQuestions.forEach((q, idx) => {
                    const ans = userAnswers[idx];
                    if (ans) {
                      const userAnsBase = ans.split(')')[0].trim().toLowerCase();
                      if (userAnsBase === q.respuesta.toLowerCase()) {
                        corrects++;
                      } else {
                        errors++;
                      }
                    } else {
                      blanks++;
                    }
                  });
                  return (
                    <>
                      <span className="text-emerald-500">Aciertos: {corrects}</span>
                      <span className="text-rose-500">Errores: {errors}</span>
                      <span className="text-slate-400">En blanco: {blanks}</span>
                    </>
                  );
                })()}
              </div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-2 block">(Cada error resta un acierto)</p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => startQuiz(quizType, selectedExam || undefined)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
              >
                Reintentar Test
              </button>
              <button
                onClick={() => setScreen("home")}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-slate-200 transition-all"
              >
                Volver al Inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    const currentQ = quizQuestions[currentQuizIndex];
    if (!currentQ) return null;

    return (
      <div className="max-w-2xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8 flex items-center justify-between">
          <button onClick={() => setShowExitDialog(true)} className="p-3 rounded-2xl bg-white border-2 border-slate-200 text-slate-400 hover:text-slate-600 transition-all shadow-sm flex items-center gap-2">
            <ChevronLeft className="w-6 h-6" />
            <span className="font-black uppercase text-xs tracking-widest hidden sm:inline">Atrás</span>
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pregunta</span>
            <span className="text-xl font-black text-indigo-600 tabular-nums">{currentQuizIndex + 1} / {quizQuestions.length}</span>
          </div>
        </div>

        <div key={currentQ.id} className="bg-white rounded-[2.5rem] shadow-2xl p-8 border-2 border-slate-100 relative overflow-hidden">
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100">
            <div 
              className="h-full bg-indigo-500 transition-all duration-500" 
              style={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}
            />
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider mb-2 inline-block">
                    {quizType === "random" ? (selectedExam?.examen || "Test Aleatorio") : "Repaso de Errores"}
                  </span>
                  {quizQuestionSuccessStreaks[Number(currentQ.id)] !== undefined && (
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider mb-2 ml-2 inline-block border border-amber-200">
                      Maestría: {quizQuestionSuccessStreaks[Number(currentQ.id)]} / 8
                    </span>
                  )}
                  {selectedExam && (
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedExam.temario}</p>
                  )}
               </div>
               <button
                  onClick={() => setIsDoubtful(!isDoubtful)}
                  disabled={!!userAnswers[currentQuizIndex]}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 transition-all shrink-0 ${
                    isDoubtful 
                    ? "bg-amber-100 border-amber-500 text-amber-700 font-black shadow-inner" 
                    : "bg-white border-slate-200 text-slate-400 font-bold hover:border-amber-300 hover:text-amber-500"
                  }`}
                >
                  <HelpCircle className={`w-4 h-4 ${isDoubtful ? "fill-amber-500" : ""}`} />
                  <span className="text-[10px] uppercase tracking-widest hidden sm:inline">Tengo duda</span>
                </button>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">
              {currentQ.enunciado}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {currentQ.opciones.map((opcion, idx) => {
              const letter = opcion.split(')')[0].trim().toLowerCase();
              const currentAnswer = userAnswers[currentQuizIndex];
              const isSelected = currentAnswer === opcion;
              const isCorrect = letter === currentQ.respuesta.toLowerCase();
              
              let buttonClass = "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/30";
              if (currentAnswer) {
                if (isCorrect) buttonClass = "bg-emerald-50 border-emerald-500 text-emerald-700 ring-4 ring-emerald-50";
                else if (isSelected) buttonClass = "bg-rose-50 border-rose-500 text-rose-700 ring-4 ring-rose-50";
                else buttonClass = "bg-white border-slate-100 text-slate-300 opacity-50";
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleQuizAnswer(opcion)}
                  disabled={!!currentAnswer}
                  className={`w-full text-left p-5 rounded-2xl border-2 font-bold transition-all flex items-center gap-4 ${buttonClass}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-xs ${
                    isSelected ? "bg-current text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    {letter.toUpperCase()}
                  </span>
                  <span className="flex-1">{opcion.substring(opcion.indexOf(')') + 1).trim()}</span>
                  {currentAnswer && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                  {currentAnswer && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-rose-500" />}
                </button>
              );
            })}
          </div>



          {/* Botones de Navegación */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={() => {
                if (currentQuizIndex > 0) {
                  const prevIdx = currentQuizIndex - 1;
                  setCurrentQuizIndex(prevIdx);
                  setSelectedAnswer(userAnswers[prevIdx] || null);
                  setShowExplanation(userAnswers[prevIdx] !== null);
                  setIsDoubtful(false);
                }
              }}
              disabled={currentQuizIndex === 0}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${
                currentQuizIndex === 0 
                ? "bg-slate-50 text-slate-300 cursor-not-allowed" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            <button
              onClick={() => {
                const qId = Number(currentQ.id);
                const currentAnswer = userAnswers[currentQuizIndex];
                // Si no hay respuesta seleccionada, marcar como duda
                if (!currentAnswer) {
                  setBlankQuizQuestions(prev => prev.includes(qId) ? prev : [...prev, qId]);
                }

                if (currentQuizIndex < quizQuestions.length - 1) {
                  const nextIdx = currentQuizIndex + 1;
                  setCurrentQuizIndex(nextIdx);
                  setSelectedAnswer(userAnswers[nextIdx] || null);
                  setShowExplanation(userAnswers[nextIdx] !== null);
                  setIsDoubtful(false);
                } else {
                  finishQuiz();
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${
                !userAnswers[currentQuizIndex] 
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border-2 border-amber-200" 
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg"
              }`}
            >
              {currentQuizIndex < quizQuestions.length - 1 
                ? (!userAnswers[currentQuizIndex] ? "Saltar" : "Siguiente") 
                : "Finalizar"} 
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Exit Dialog */}
          {showExitDialog && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600 mb-4">
                    <Save className="w-8 h-8" />
                  </div>
                  <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tight">¿Guardar Progreso?</h3>
                  <p className="text-slate-500 font-bold text-sm">
                    Tienes un test en curso. ¿Quieres guardar tus respuestas para continuar más tarde?
                  </p>
                </div>
                <div className="grid gap-3">
                  <button 
                    onClick={() => {
                        // Force save just in case, though auto-save usually handles it
                        let saveId = null;
                        if (quizType === "random" && selectedExam) saveId = selectedExam.id;
                        else if (quizType === "errors") saveId = "temp-errors";
                        else if (quizType === "dudas") saveId = "temp-dudas";
                        
                        if (saveId) {
                            saveQuizProgress(saveId, {
                                quizType,
                                selectedExam,
                                questions: quizQuestions,
                                currentIndex: currentQuizIndex,
                                score: quizScore,
                                answers: userAnswers,
                                selectedAnswer,
                                showExplanation,
                                isDoubtful,
                                finished: false
                            });
                        }
                        setShowExitDialog(false);
                        setScreen("home");
                    }}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
                  >
                    Guardar y Salir
                  </button>
                  <button 
                    onClick={() => {
                        // Clear the auto-saved progress because user explicitly chose NOT to save
                        let saveId = null;
                        if (quizType === "random" && selectedExam) saveId = selectedExam.id;
                        else if (quizType === "errors") saveId = "temp-errors";
                        else if (quizType === "dudas") saveId = "temp-dudas";
                        
                        if (saveId) {
                            clearQuizProgress(saveId);
                        }

                        setShowExitDialog(false);
                        setScreen("home");
                    }}
                    className="w-full py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:border-rose-500 hover:text-rose-500 transition-all"
                  >
                    Salir sin guardar
                  </button>
                  <button 
                    onClick={() => setShowExitDialog(false)}
                    className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    );
  };

  const renderQuizSelection = () => {
    const list = quizCategory === "exams" ? ALL_EXAMS : ALL_SIMULACROS;
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setScreen("quiz_category_selection")} className="bg-white p-3 rounded-2xl border-2 border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">
              {quizCategory === "exams" ? "Seleccionar Examen" : "Seleccionar Simulacro"}
            </h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              {quizCategory === "exams" ? "Elige el temario que quieres practicar" : "Pon a prueba tus conocimientos finales"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* BOTÓN GENERAR ALEATORIO */}
          <button
            onClick={startRandomCategoryQuiz}
            className="group bg-indigo-600 p-6 rounded-[2.5rem] border-2 border-indigo-500 hover:shadow-2xl transition-all text-left flex flex-col gap-4 relative overflow-hidden text-white"
          >
             <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:rotate-12 transition-transform">
                <Sparkles className="w-24 h-24" />
             </div>
             <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center text-white ring-4 ring-white/10">
                <Sparkles className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-1">
                    {quizCategory === "exams" ? "Generar Test Aleatorio" : "Generar Simulacro Aleatorio"}
                </h3>
                <p className="text-xs font-bold text-white/70 leading-relaxed max-w-[200px]">
                    Mezcla preguntas de todos los {quizCategory === "exams" ? "temas" : "simulacros"} disponibles.
                </p>
             </div>
             <div className="flex items-center gap-1 mt-auto text-white/50 group-hover:text-white transition-colors">
                <span className="text-[10px] font-black uppercase tracking-widest">Crear Nuevo</span>
                <ChevronRight className="w-4 h-4" />
             </div>
          </button>

          {list.map((exam) => (
            <button
              key={exam.id}
              onClick={() => startQuiz("random", exam)}
              className="group bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 hover:border-indigo-600 hover:shadow-2xl transition-all text-left flex flex-col gap-4 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Brain className="w-24 h-24" />
              </div>
              
              <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FileText className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">{exam.examen}</h3>
                <p className="text-xs font-bold text-slate-500 leading-relaxed">{exam.temario}</p>
              </div>

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                    {exam.preguntas.length} Preguntas
                  </span>
                  {quizHighScores[exam.id] !== undefined && (
                    <span className="text-[9px] font-bold text-emerald-600 uppercase">
                      Mejor Nota: {quizHighScores[exam.id].correct} / {quizHighScores[exam.id].total}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-slate-400 group-hover:text-indigo-600 transition-colors">
                  <span className="text-[10px] font-black uppercase tracking-widest">Empezar</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderQuizCategorySelection = () => {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setScreen("home")} className="bg-white p-3 rounded-2xl border-2 border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Categorías de Test</h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              Elige el tipo de preparación que prefieres
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => {
              setQuizCategory("exams");
              setScreen("quiz_selection");
            }}
            className="group bg-white p-8 rounded-[3rem] border-2 border-slate-100 hover:border-indigo-600 hover:shadow-2xl transition-all text-left flex flex-col gap-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <FileText className="w-32 h-32" />
            </div>
            
            <div className="bg-indigo-50 w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <FileText className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Exámenes por Temas</h3>
              <p className="text-sm font-bold text-slate-500 leading-relaxed">Práctica preguntas específicas de cada bloque del temario.</p>
            </div>

            <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-50">
              <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">
                {ALL_EXAMS.length} Bloques disponibles
              </span>
              <div className="flex items-center gap-1 text-slate-400 group-hover:text-indigo-600 transition-colors">
                <span className="text-xs font-black uppercase tracking-widest">Ver Todos</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              setQuizCategory("simulacros");
              setScreen("quiz_selection");
            }}
            className="group bg-white p-8 rounded-[3rem] border-2 border-slate-100 hover:border-amber-600 hover:shadow-2xl transition-all text-left flex flex-col gap-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Layers className="w-32 h-32" />
            </div>
            
            <div className="bg-amber-50 w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Layers className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Simulacros Oficiales</h3>
              <p className="text-sm font-bold text-slate-500 leading-relaxed">Exámenes completos mezclados para simular la prueba real.</p>
            </div>

            <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-50">
              <span className="text-xs font-black text-amber-600 uppercase tracking-widest">
                {ALL_SIMULACROS.length} Simulacros listos
              </span>
              <div className="flex items-center gap-1 text-slate-400 group-hover:text-amber-600 transition-colors">
                <span className="text-xs font-black uppercase tracking-widest">Empezar</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const renderExamen2025Selection = () => {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setScreen("home")} className="bg-white p-3 rounded-2xl border-2 border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Exámenes 2025</h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              Material específico para la promoción interna
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {EXAMENES_2025.map((exam) => {
            const saved = getQuizProgress(exam.id);
            const hasProgress = saved && !saved.finished;
            
            return (
              <button
                key={exam.id}
                onClick={() => startQuiz("random", exam)}
                className="group bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 hover:border-rose-600 hover:shadow-2xl transition-all text-left flex flex-col gap-4 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Brain className="w-24 h-24" />
                </div>
                
                <div className="bg-rose-50 w-12 h-12 rounded-2xl flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                  <FileText className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">{exam.examen}</h3>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed">{exam.temario}</p>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-50 w-full">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
                      {exam.preguntas.length} Preguntas
                    </span>
                    {hasProgress && (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded uppercase">
                        En curso
                      </span>
                    )}
                  </div>
                  
                  {quizHighScores[exam.id] !== undefined && (
                    <div className="text-[9px] font-bold text-emerald-600 uppercase mb-2">
                      Récord: {quizHighScores[exam.id].correct} / {quizHighScores[exam.id].total}
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-slate-400 group-hover:text-rose-600 transition-colors justify-end">
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {hasProgress ? "Continuar" : "Empezar"}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAuth = () => (
    <div className="max-w-md mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[3rem] shadow-2xl p-8 border-2 border-slate-100">
        <button onClick={() => setScreen("home")} className="mb-8 p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-all">
          <ChevronLeft className="w-6 h-6" />
        </button>

        {session ? (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <User className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Tu Perfil</h2>
              <p className="text-slate-400 font-bold text-xs uppercase mt-1">{session.user.email}</p>
            </div>

            <form onSubmit={handleUpdateUsername} className="space-y-4 pt-2">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre de Usuario</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="flex-1 p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold focus:border-indigo-600 outline-none transition-all text-sm"
                    placeholder="Tu nombre..."
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg"
                    title="Guardar nombre"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-rose-100 transition-all mt-4"
            >
              <LogOut className="w-5 h-5" /> Cerrar Sesión
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Acceso de Usuario</h2>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-4 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black uppercase text-sm tracking-widest hover:border-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-black uppercase tracking-widest">O con correo</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
                  authMode === "login" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setAuthMode("register")}
                className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
                  authMode === "register" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Registrar
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-600 outline-none transition-all"
                  placeholder="tu@email.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Contraseña</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-indigo-600 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                {authMode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );

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

  const renderGame = () => (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-32">
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

      {/* Quick Access & Direction Header */}
      <div className="bg-white rounded-3xl shadow-lg border-2 border-slate-100 p-2 space-y-2">
          <div className="flex items-center gap-3 px-2 py-1">
              <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                  <button
                    onClick={() => {
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
                    }}
                    className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all transition-all flex items-center gap-2 ${
                        direction === "ida" ? "bg-white text-emerald-600 shadow-sm border border-emerald-100" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <ArrowUpCircle className="w-3 h-3" /> IDA
                  </button>
                  <button
                    onClick={() => {
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
                    }}
                    className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                        direction === "vuelta" ? "bg-white text-orange-600 shadow-sm border border-orange-100" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <ArrowDownCircle className="w-3 h-3" /> VUELTA
                  </button>
              </div>
              <div className="h-8 w-px bg-slate-200 mx-1" />
              <div className="flex-1 overflow-x-auto custom-scrollbar no-scrollbar flex gap-2 py-1 snap-x">
                {uniqueLines.map((line) => (
                  <button
                    key={line.id}
                    onClick={() => {
                      const newId = line.id;
                      setSelectedBaseId(newId);
                      const targetId = `${newId}-${direction}`;
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
                    className={`min-w-[40px] h-10 shrink-0 snap-center rounded-xl font-black text-xs flex items-center justify-center transition-all bg-white shadow-sm border-2 ${
                      selectedBaseId === line.id ? "border-indigo-600 text-indigo-600 ring-2 ring-indigo-100" : "border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500"
                    }`}
                  >
                    {line.id}
                  </button>
                ))}
              </div>
          </div>
      </div>

      {gameStatus === "playing" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="h-px bg-slate-200 flex-1" />
            <h3 className="font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Selecciona la siguiente parada (A-Z)</h3>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

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
                tabIndex={-1}
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
                        onMouseDown={(e) => e.preventDefault()}
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
            </div>
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
            <div className="flex flex-col gap-3 max-w-xs mx-auto mt-8">
              {(() => {
                const oppositeDir = direction === "ida" ? "vuelta" : "ida";
                const oppositeId = `${selectedBaseId}-${oppositeDir}`;
                const hasOpposite = BUS_ROUTES.some((r) => r.id === oppositeId);

                return (
                  hasOpposite && (
                    <button
                      className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl text-sm flex items-center justify-center gap-2"
                      onClick={() => {
                        setDirection(oppositeDir);
                        setTimeout(() => {
                           startNewGame();
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
                onClick={startNewGame} 
                className="bg-indigo-500 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-400 transition-all shadow-xl text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Reiniciar Reto
              </button>
              <button 
                onClick={() => setScreen("home")} 
                className="bg-indigo-900 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-950 transition-all shadow-xl text-sm"
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

      {gameStatus === "playing" && (
        <div className="bg-white rounded-[2rem] shadow-2xl p-6 border-2 border-slate-200 overflow-hidden relative">
          <div className="absolute top-0 right-0 bg-slate-100 px-4 py-2 rounded-bl-2xl border-b border-l border-slate-200 font-black text-indigo-600 flex items-center gap-3 shadow-sm z-10">
            <span className="text-xl tabular-nums">{selectedStops.length}</span>
            <div className="w-px h-4 bg-slate-300" />
            <span className="text-slate-400 tabular-nums">{targetOrder.length}</span>
          </div>

          <div className="flex flex-col gap-4 mb-6 pt-2">
            <div>
                <div className="flex flex-wrap items-center gap-2 mb-2 pr-24">
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider">LÍNEA {selectedBaseId}</span>
                  <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 ${direction === "ida" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                    {direction === "ida" ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />} {direction}
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

            {/* Direction Switch in Game UI */}
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

          <div className={`flex flex-wrap gap-2 content-start items-start min-h-[90px] p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 transition-all ${shake ? "shake border-rose-500 border-solid bg-rose-50" : ""}`}>
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
                  const newSelected = selectedStops.slice(0, idx + 1);
                  setSelectedStops(newSelected);
                  const restoredOptions = targetOrder.map((name, i) => ({ id: `${i}-${name}`, name })).filter((_, i) => i > idx);
                  setAvailableOptions(restoredOptions);
                }}
                className={`text-white pl-2 pr-4 py-2 rounded-xl font-bold text-xs shadow-md flex items-center gap-2 border-b-2 transition-all ${direction === "ida" ? "bg-emerald-600 border-emerald-800" : "bg-orange-600 border-orange-800"}`}
              >
                <span className="bg-white text-slate-800 w-6 h-6 flex items-center justify-center rounded text-[10px] font-black shrink-0">{idx + 1}</span>
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

            {/* Ghost Hint for Study/Memorize Mode */}
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
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20 font-sans">
      <header className="bg-indigo-700 border-b-4 border-indigo-900 p-6 shadow-xl mb-8">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => { setScreen("home"); setGameStatus("setup"); }}>
            <div className="bg-white p-2 rounded-2xl shadow-inner"><BusFront className="w-8 h-8 text-indigo-700" /></div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-white leading-none">Bus Master</h1>
              <p className="text-xs font-bold text-indigo-200 opacity-80 uppercase tracking-widest mt-1">Escuela de Conductores Profesional</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <button onClick={() => setScreen("auth")} className="flex items-center gap-2 bg-indigo-800/50 px-4 py-2 rounded-xl text-white hover:bg-indigo-800 transition-colors">
                <User className="w-4 h-4" /> <span className="text-xs font-bold">{username}</span>
              </button>
            ) : (
              <button onClick={() => setScreen("auth")} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl text-white hover:bg-white/20 transition-colors">
                <LogIn className="w-4 h-4" /> <span className="text-xs font-bold">Login</span>
              </button>
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
        {(() => {
          if (screen === "home") return renderHome();
          if (screen === "setup") return renderSetup();
          if (screen === "failures") return renderProgress();
          if (screen === "errors") return renderErrors();
          if (screen === "auth") return renderAuth();
          if (screen === "playing") return renderGame();
          if (screen === "quiz") return renderQuiz();
          if (screen === "quiz_selection") return renderQuizSelection();
          if (screen === "quiz_category_selection") return renderQuizCategorySelection();
          if (screen === "examen_2025_selection") return renderExamen2025Selection();
          return renderHome();
        })()}
      </main>

      {screen === "playing" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-50">
          <button onClick={() => { setScreen("setup"); setGameStatus("setup"); }} className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-2 font-black uppercase text-xs tracking-widest">
            <ChevronLeft className="w-4 h-4" /> Menú de Línea
          </button>
          <button onClick={startNewGame} className="bg-white text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-2 font-black uppercase text-xs tracking-widest border-2 border-slate-200">
            <RotateCcw className="w-4 h-4" /> Resetear
          </button>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; border: 2px solid #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
      {resumeDialog.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-800 mb-2">¡Test en curso detectado!</h3>
            <p className="text-slate-500 text-sm mb-6">Hemos encontrado un test guardado de <strong>{resumeDialog.exam?.examen}</strong> que no has terminado. ¿Qué quieres hacer?</p>
            <div className="space-y-3">
              <button 
                onClick={resumeQuiz}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all"
              >
                Continuar donde lo dejé
              </button>
              <button 
                onClick={() => {
                  setResumeDialog({ ...resumeDialog, visible: false });
                  startQuiz(resumeDialog.type, resumeDialog.exam, true); // Force start fresh
                }}
                className="w-full py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-black uppercase text-xs tracking-widest hover:border-rose-200 hover:text-rose-600 transition-all"
              >
                Empezar de cero
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
