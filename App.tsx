
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GamePhase, 
  GameSettings, 
  Player, 
  HanjaData, 
  Cell, 
  QuizState,
  Grade
} from './types';
import { fetchHanjaData } from './services/geminiService';
import Card from './components/Card';
import QuizBattle from './components/QuizBattle';
import { Users, Grid3X3, Trophy, Play, SkipForward, Eye, BrainCircuit, Timer, CheckCircle2, XCircle, ChevronRight, Hourglass, ScrollText, Sparkles, Swords } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- Utils ---
function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b']; // Blue, Red, Green, Yellow
const TURN_TIMEOUT = 30; // Shared time for PEEK and SELECT
const QUIZ_TIMEOUT = 10;

const checkBingo = (board: Cell[]): number => {
  const size = 5;
  let lines = 0;

  // Rows
  for (let i = 0; i < size; i++) {
    if (board.slice(i * size, (i + 1) * size).every(c => c.isFlipped)) lines++;
  }
  // Cols
  for (let i = 0; i < size; i++) {
    let colFull = true;
    for (let j = 0; j < size; j++) {
      if (!board[j * size + i].isFlipped) colFull = false;
    }
    if (colFull) lines++;
  }
  // Diagonals
  if ([0, 6, 12, 18, 24].every(i => board[i].isFlipped)) lines++;
  if ([4, 8, 12, 16, 20].every(i => board[i].isFlipped)) lines++;

  return lines;
};

const App: React.FC = () => {
  // --- State ---
  const [phase, setPhase] = useState<GamePhase>(GamePhase.SETUP);
  const [settings, setSettings] = useState<GameSettings>({
    grade: '8급',
    playerCount: 2,
    mode: 'STANDARD',
    winLines: 1
  });
  const [players, setPlayers] = useState<Player[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [peekedCardIds, setPeekedCardIds] = useState<string[]>([]); // Current turn peeking
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Refs for async logic (avoid stale closures)
  const playersRef = useRef(players);
  playersRef.current = players;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const activePlayer = players[turnIndex];
  const isMyTurn = activePlayer?.id === 'player-1';

  // --- Helpers ---
  const addLog = (msg: string) => setGameLog(prev => [msg, ...prev].slice(0, 5));

  // --- Phase Logic ---

  const startGame = async () => {
    setPhase(GamePhase.LOADING);
    const hanjaPool = await fetchHanjaData(settings.grade, 25);
    
    // Create Players with Numbered Names
    const newPlayers: Player[] = Array.from({ length: settings.playerCount }).map((_, i) => ({
      id: `player-${i + 1}`,
      name: i === 0 ? 'P1 나' : `P${i + 1} AI`,
      isAI: i !== 0,
      board: shuffle(hanjaPool).map((h, idx) => ({ 
        id: `${h.id}-${i}`, 
        hanja: h, 
        isFlipped: false, 
        isPeeked: false,
        gridIndex: idx 
      })),
      score: 0,
      color: COLORS[i],
      bonusGauge: 0,
      hasShield: false
    }));

    setPlayers(newPlayers);
    // RANDOM TURN ORDER
    const startTurn = Math.floor(Math.random() * newPlayers.length);
    setTurnIndex(startTurn);
    
    setPhase(GamePhase.TURN_START);
    addLog(`게임 시작! ${settings.grade}, ${settings.mode} 모드.`);
  };

  // Turn Management
  useEffect(() => {
    if (phase === GamePhase.TURN_START) {
      const currentPlayer = players[turnIndex];
      // Guard against empty players during transitions
      if (!currentPlayer) return;

      addLog(`${currentPlayer.name}의 차례입니다.`);
      
      setPeekedCardIds([]);
      
      // Auto-transition to PEEK
      setTimeout(() => {
        setPhase(GamePhase.PEEK);
      }, 1000);
    }
  }, [phase, turnIndex, players]);

  // Timer Initialization on Phase Change
  useEffect(() => {
    // Start shared timer at the beginning of the turn sequence (PEEK)
    if (phase === GamePhase.PEEK) {
      setTimeLeft(TURN_TIMEOUT);
    }
    // CRITICAL: Do NOT reset timer on GamePhase.SELECT. It shares the same countdown from PEEK.
    
    if (phase === GamePhase.QUIZ) {
      setTimeLeft(QUIZ_TIMEOUT);
    }
  }, [phase]);

  // Timer Countdown & Expiry
  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>;

    if ((phase === GamePhase.PEEK || phase === GamePhase.SELECT || phase === GamePhase.QUIZ) && timeLeft > 0) {
      timerId = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // Timeout Logic
      if (phase === GamePhase.PEEK) {
        // If time runs out in PEEK, force move to SELECT.
        // Since timeLeft is 0, the next tick will catch phase=SELECT and time=0, triggering auto-select immediately.
        if (phaseRef.current === GamePhase.PEEK) {
          finishPeek();
        }
      } else if (phase === GamePhase.SELECT) {
        // Auto-select random card for active player
        if (activePlayer && phaseRef.current === GamePhase.SELECT) {
          const unrevealed = activePlayer.board.filter(c => !c.isFlipped);
          const target = unrevealed.length > 0 ? shuffle(unrevealed)[0] : activePlayer.board[0];
          addLog("시간 초과! 랜덤 카드가 선택되었습니다.");
          handleSelectCard(target.hanja);
        }
      } else if (phase === GamePhase.QUIZ && quizState && !quizState.resultsShown) {
        // Auto-submit 'TIMEOUT' for anyone who hasn't answered
        const missingPlayers = players.filter(p => !quizState.answers[p.id]);
        if (missingPlayers.length > 0) {
          setQuizState(prev => {
             if (!prev) return null;
             const newAnswers = { ...prev.answers };
             missingPlayers.forEach(p => {
               newAnswers[p.id] = 'TIMEOUT_WRONG';
             });
             return { ...prev, answers: newAnswers };
          });
        }
      }
    }

    return () => clearInterval(timerId);
  }, [timeLeft, phase, activePlayer, players, quizState]);

  // AI Behavior Controller
  useEffect(() => {
    if (!activePlayer?.isAI) return;

    const runAITurn = async () => {
      // 1. Peek Phase
      if (phase === GamePhase.PEEK) {
        // AI Peeking Strategy
        const thinkTime = 1000 + Math.random() * 1000;
        await new Promise(r => setTimeout(r, thinkTime)); 
        
        const unrevealed = activePlayer.board.filter(c => !c.isFlipped);
        const peekCount = Math.min(2, unrevealed.length);
        const toPeek = shuffle<Cell>(unrevealed).slice(0, peekCount).map((c) => c.id);
        
        setPeekedCardIds(toPeek); 
        
        // AI finishes peek after a short delay
        await new Promise(r => setTimeout(r, 1500));
        finishPeek();
      }

      // 2. Select Phase
      if (phase === GamePhase.SELECT) {
        // AI Selecting Strategy
        const thinkTime = 1000 + Math.random() * 1000;
        await new Promise(r => setTimeout(r, thinkTime)); 
        
        const unrevealed = activePlayer.board.filter(c => !c.isFlipped);
        const target = unrevealed.length > 0 ? shuffle(unrevealed)[0] : activePlayer.board[0];
        
        if (phaseRef.current === GamePhase.SELECT) {
          handleSelectCard(target.hanja);
        }
      }

      // 3. Quiz Phase (Answering)
      if (phase === GamePhase.QUIZ && quizState && !quizState.answers[activePlayer.id]) {
        // AI answers faster now (within 5s usually since quiz is 10s)
        const delay = 1000 + Math.random() * 3000;
        setTimeout(() => {
           if (phaseRef.current === GamePhase.QUIZ && timeLeft > 0) {
               // 80% chance to be correct for higher grades, adjustable logic
               const isCorrect = Math.random() > 0.2; 
               const answerId = isCorrect 
                 ? quizState.correctOptionId 
                 : shuffle<HanjaData>(quizState.options)[0].id;
               
               handleQuizAnswer(activePlayer.id, answerId);
           }
        }, delay);
      }
    };

    runAITurn();
  }, [phase, activePlayer, quizState]); 

  // Simulate other AI answering during Quiz phase (Non-active players)
  useEffect(() => {
    if (phase === GamePhase.QUIZ && quizState) {
      players.forEach((p: Player) => {
        if (p.isAI && !quizState.answers[p.id]) {
            const delay = 1000 + Math.random() * 4000; 
             const timer = setTimeout(() => {
                 if (phaseRef.current === GamePhase.QUIZ && !quizState.answers[p.id]) {
                     const isCorrect = Math.random() > 0.3;
                     const targetOption = isCorrect 
                        ? quizState.correctOptionId 
                        : shuffle<HanjaData>(quizState.options.filter(o => o.id !== quizState.correctOptionId))[0]?.id || quizState.options[0].id;
                     
                     handleQuizAnswer(p.id, targetOption);
                 }
            }, delay);
            return () => clearTimeout(timer);
        }
      });
    }
  }, [phase, quizState]);


  // --- Actions ---

  const handlePeekClick = (cell: Cell) => {
    if (phase !== GamePhase.PEEK || !isMyTurn || cell.isFlipped) return;
    if (peekedCardIds.includes(cell.id)) return;
    if (peekedCardIds.length < 3) {
      setPeekedCardIds(prev => [...prev, cell.id]);
    }
  };

  const finishPeek = () => {
    setPhase(GamePhase.SELECT);
    setPeekedCardIds([]); 
    // Do NOT reset timeLeft here. It continues from where it was.
  };

  const handleSelectCard = (hanja: HanjaData) => {
    // Generate Quiz
    const isHanjaToHunEum = Math.random() > 0.5;
    const allHanja = players[0].board.map(c => c.hanja); 
    const distractors = shuffle(allHanja.filter(h => h.id !== hanja.id)).slice(0, 3);
    const options = shuffle([hanja, ...distractors]);

    setQuizState({
      targetHanja: hanja,
      type: isHanjaToHunEum ? 'HANJA_TO_HUNEUM' : 'HUNEUM_TO_HANJA',
      options,
      correctOptionId: hanja.id,
      answers: {},
      resultsShown: false
    });
    setPhase(GamePhase.QUIZ);
    addLog("퀴즈 대결 시작!");
  };

  const handleQuizAnswer = (playerId: string, optionId: string) => {
    setQuizState(prev => {
      if (!prev) return null;
      if (prev.answers[playerId]) return prev;

      const newAnswers = { ...prev.answers, [playerId]: optionId };
      return { ...prev, answers: newAnswers };
    });
  };

  // Evaluate Quiz Results
  useEffect(() => {
    if (phase === GamePhase.QUIZ && quizState) {
      const allAnswered = players.every(p => quizState.answers[p.id]);
      
      if (allAnswered && !quizState.resultsShown) {
        setQuizState(prev => prev ? ({ ...prev, resultsShown: true }) : null);
        // Delay to show results on the board
        setTimeout(() => {
          evaluateRound();
        }, 3000);
      }
    }
  }, [quizState, phase, players]);

  const evaluateRound = () => {
    if (!quizState) return;

    const correctHanjaId = quizState.correctOptionId;
    
    const nextPlayers = players.map((p: Player) => {
        const userAnswer = quizState.answers[p.id];
        const isCorrect = userAnswer === correctHanjaId;
        
        if (isCorrect) {
            const updatedBoard = p.board.map(cell => {
                if (cell.hanja.id === correctHanjaId) {
                    return { ...cell, isFlipped: true };
                }
                return cell;
            });
            const bingoCount = checkBingo(updatedBoard);
            return {
                ...p,
                board: updatedBoard,
                score: bingoCount
            };
        }
        return p;
    });

    setPlayers(nextPlayers);
    
    const winner = nextPlayers.find(p => p.score >= settings.winLines);
    if (winner) {
      setPhase(GamePhase.GAME_OVER);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      addLog(`${winner.name} 승리!`);
    } else {
      setPhase(GamePhase.TURN_START);
      setTurnIndex(prev => (prev + 1) % players.length);
      setQuizState(null);
    }
  };


  // --- UI Render Helpers ---

  // Helper to render result overlay on a cell
  const renderCellOverlay = (hanjaId: string, player: Player) => {
    if (phase === GamePhase.QUIZ && quizState?.resultsShown && quizState.targetHanja?.id === hanjaId) {
      const isCorrect = quizState.answers[player.id] === quizState.correctOptionId;
      return (
        <div className={`absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-xl animate-in fade-in zoom-in duration-300`}>
          {isCorrect ? (
             <CheckCircle2 className="text-green-400 w-2/3 h-2/3 drop-shadow-lg" strokeWidth={3} />
          ) : (
             <XCircle className="text-red-500 w-2/3 h-2/3 drop-shadow-lg" strokeWidth={3} />
          )}
        </div>
      );
    }
    return null;
  };


  // --- Main Render ---

  if (phase === GamePhase.SETUP) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,#2e1065,transparent)] z-0" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 animate-pulse z-0" />

        <div className="bg-slate-800/90 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl border border-indigo-500/30 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.3)] max-w-lg w-full relative z-10 transform transition-all">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-500/20 rounded-2xl mb-4 shadow-inner ring-1 ring-indigo-500/50">
               <Swords size={40} className="text-yellow-400" />
            </div>
            <h1 className="text-5xl sm:text-7xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 drop-shadow-sm tracking-tighter">
              한빙고
            </h1>
            <p className="text-indigo-200 text-lg font-medium">
              실시간 한자 배틀 로얄
            </p>
          </div>

          <div className="space-y-6">
            <div className="group">
              <label className="block text-xs uppercase font-bold text-indigo-400 mb-2 tracking-widest">
                 Challenge Level
              </label>
              <div className="relative group">
                <select 
                    value={settings.grade}
                    onChange={(e) => setSettings({...settings, grade: e.target.value as Grade})}
                    className="w-full bg-slate-900 border-2 border-slate-700 text-white text-lg font-bold rounded-2xl p-4 appearance-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer hover:bg-slate-800 hover:border-slate-600"
                >
                    {['8급', '7급', '6급', '5급', '4급', '3급', '2급', '1급'].map(g => (
                    <option key={g} value={g}>{g}</option>
                    ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-white transition-colors">▼</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div>
                    <label className="block text-xs uppercase font-bold text-indigo-400 mb-2 tracking-widest">
                        Players
                    </label>
                    <div className="flex bg-slate-900 rounded-2xl p-1.5 border-2 border-slate-700">
                    {[2, 3, 4].map(num => (
                        <button
                        key={num}
                        onClick={() => setSettings({...settings, playerCount: num})}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${settings.playerCount === num ? 'bg-indigo-600 text-white shadow-lg scale-100' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                        >
                        {num}인
                        </button>
                    ))}
                    </div>
                </div>
                <div>
                     <label className="block text-xs uppercase font-bold text-indigo-400 mb-2 tracking-widest">
                        Goal
                     </label>
                    <div className="flex bg-slate-900 rounded-2xl p-1.5 border-2 border-slate-700">
                    {[1, 3].map(num => (
                        <button
                        key={num}
                        onClick={() => setSettings({...settings, winLines: num as 1|3})}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${settings.winLines === num ? 'bg-indigo-600 text-white shadow-lg scale-100' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                        >
                        {num}줄
                        </button>
                    ))}
                    </div>
                </div>
            </div>

            <button 
              onClick={startGame}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white text-xl font-black py-5 rounded-2xl shadow-xl shadow-orange-500/20 transform transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-6 group border-b-4 border-orange-800 active:border-b-0 active:translate-y-1"
            >
              <Play fill="currentColor" size={24} className="group-hover:scale-110 transition-transform" />
              GAME START
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === GamePhase.LOADING) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white">
            <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                <BrainCircuit className="text-indigo-400 mb-6 relative z-10 animate-bounce" size={64} />
            </div>
            <h2 className="text-2xl font-bold mb-2">대결 준비 중...</h2>
            <p className="text-slate-400 animate-pulse">Gemini AI가 한자 보드를 생성하고 있습니다.</p>
        </div>
    );
  }

  if (!activePlayer || players.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center relative pb-20 overflow-x-hidden">
      
      {/* Top Status Bar */}
      <div className="w-full bg-slate-900 border-b border-slate-700 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center p-2 sm:p-3 gap-2">
            
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
               <h1 className="font-extrabold text-2xl text-yellow-500 hidden md:flex items-center gap-2 tracking-tighter">
                 <Swords size={20}/> 한빙고
               </h1>
               
               <div className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-full border border-slate-600 shadow-inner">
                   <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">TURN</div>
                   <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_currentColor]" style={{color: activePlayer.color, backgroundColor: activePlayer.color}} />
                       <span className="font-bold text-white text-base">{activePlayer.name}</span>
                   </div>
               </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50 overflow-x-auto max-w-full no-scrollbar">
               {[
                 { id: GamePhase.PEEK, label: '미리보기', icon: Eye },
                 { id: GamePhase.SELECT, label: '카드선택', icon: Hourglass },
                 { id: GamePhase.QUIZ, label: '퀴즈대결', icon: BrainCircuit }
               ].map((step, idx) => {
                 const isActive = phase === step.id;
                 const isPast = [GamePhase.PEEK, GamePhase.SELECT, GamePhase.QUIZ].indexOf(phase) > idx;
                 return (
                   <div key={step.id} className={`flex items-center ${isActive ? 'text-yellow-400' : isPast ? 'text-slate-500' : 'text-slate-600'}`}>
                      <div className={`
                         flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all
                         ${isActive ? 'bg-yellow-500/10 font-bold shadow-sm ring-1 ring-yellow-500/20' : ''}
                      `}>
                          <step.icon size={14} />
                          <span className="text-xs sm:text-sm whitespace-nowrap">{step.label}</span>
                      </div>
                      {idx < 2 && <ChevronRight size={14} className="text-slate-700 mx-1" />}
                   </div>
                 )
               })}
            </div>

            {/* Timer */}
            {(phase === GamePhase.PEEK || phase === GamePhase.SELECT || phase === GamePhase.QUIZ) && (
              <div className={`
                 flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl font-bold min-w-[100px] justify-center transition-all duration-300
                 ${timeLeft <= 5 ? 'bg-red-500/20 text-red-400 animate-pulse ring-1 ring-red-500/50' : 'bg-slate-800 text-yellow-400 ring-1 ring-slate-600'}
              `}>
                  <Timer size={18} />
                  <span>{timeLeft}s</span>
              </div>
            )}
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 w-full max-w-7xl p-4 flex flex-col lg:flex-row gap-8 justify-center items-start mt-2">
        
        {/* Main Board (User's Board) */}
        {/* INCREASED MAX-WIDTH to 2xl to allow cards to be much bigger */}
        <div className="flex-1 w-full max-w-2xl mx-auto lg:max-w-3xl">
            <div className="mb-4 flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm">
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                    <Grid3X3 className="text-indigo-400" size={20}/> 나의 보드
                </h2>
                <div className="flex gap-2">
                     <div className="flex items-center gap-1.5 text-sm text-yellow-400 font-bold bg-slate-900 px-4 py-1.5 rounded-lg border border-slate-700">
                         <Trophy size={14} /> {players[0].score}/{settings.winLines} 줄
                     </div>
                </div>
            </div>
            
            {/* Phase Instructions */}
            <div className="mb-6 h-16 relative">
                 {isMyTurn && phase === GamePhase.PEEK && (
                     <div className="absolute inset-0 bg-indigo-600/20 border-l-4 border-indigo-500 p-4 rounded-r-xl flex items-center gap-4 animate-in fade-in slide-in-from-left-2">
                         <div className="bg-indigo-500 p-2 rounded-lg text-white shadow-lg"><Eye size={24}/></div>
                         <div>
                            <div className="text-indigo-300 font-bold text-xs uppercase tracking-wider mb-0.5">PEEK PHASE</div>
                            <div className="text-white font-medium text-lg leading-none">카드 2~3장을 뒤집어 위치를 기억하세요!</div>
                         </div>
                     </div>
                 )}
                 {isMyTurn && phase === GamePhase.SELECT && (
                     <div className="absolute inset-0 bg-yellow-600/20 border-l-4 border-yellow-500 p-4 rounded-r-xl flex items-center gap-4 animate-in fade-in slide-in-from-left-2">
                         <div className="bg-yellow-500 p-2 rounded-lg text-slate-900 shadow-lg"><Hourglass size={24}/></div>
                         <div>
                            <div className="text-yellow-500 font-bold text-xs uppercase tracking-wider mb-0.5">SELECT PHASE</div>
                            <div className="text-white font-medium text-lg leading-none">대결할 카드를 선택하세요!</div>
                         </div>
                     </div>
                 )}
            </div>

            {/* Interactive Board */}
            <div className={`
               grid grid-cols-5 gap-3 sm:gap-4 p-4 sm:p-5 bg-slate-800 rounded-3xl shadow-2xl
               border-2 transition-all duration-500 relative overflow-hidden
               ${isMyTurn ? 'border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.15)]' : 'border-slate-700 grayscale-[0.3]'}
            `}>
                {isMyTurn && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent animate-shimmer" />}
                
                {players[0].board.map((cell) => (
                    <div key={cell.id} className="relative group">
                        <Card 
                            cell={cell} 
                            isRevealed={cell.isFlipped}
                            isPeeked={peekedCardIds.includes(cell.id)}
                            highlight={phase === GamePhase.SELECT && isMyTurn && !cell.isFlipped}
                            onClick={() => {
                                if (phase === GamePhase.PEEK) handlePeekClick(cell);
                                if (phase === GamePhase.SELECT && isMyTurn) handleSelectCard(cell.hanja);
                            }}
                            disabled={!isMyTurn && phase !== GamePhase.QUIZ}
                        />
                        {/* Overlay for Quiz Result */}
                        {renderCellOverlay(cell.hanja.id, players[0])}
                    </div>
                ))}
            </div>

            {/* Action Area */}
            <div className="mt-8">
                {isMyTurn && phase === GamePhase.PEEK && (
                     <button 
                        onClick={finishPeek}
                        disabled={peekedCardIds.length < 1}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-8 py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl transition-all text-xl border-b-4 border-indigo-800 hover:border-indigo-700 active:border-b-0 active:translate-y-1"
                     >
                         미리보기 완료 <SkipForward size={24} />
                     </button>
                )}
                
                {!isMyTurn && (
                    <div className="w-full bg-slate-800 border-2 border-slate-700 border-dashed text-slate-400 py-6 rounded-2xl text-center flex items-center justify-center gap-3 animate-pulse">
                        <BrainCircuit size={24} />
                        <span className="font-medium text-xl">{activePlayer.name}의 행동을 기다리는 중...</span>
                    </div>
                )}
            </div>
        </div>

        {/* Side Panel */}
        <div className="w-full lg:w-96 flex flex-col gap-6">
            
            {/* Player List / Mini Boards */}
            <div className="space-y-6">
                {players.slice(1).map((ai) => {
                    const isAiTurn = activePlayer?.id === ai.id;
                    return (
                        <div key={ai.id} className={`
                            bg-slate-800 p-5 rounded-2xl border-2 transition-all duration-300 relative
                            ${isAiTurn ? 'border-yellow-500 shadow-xl scale-[1.03] z-10' : 'border-slate-700 opacity-80'}
                        `}>
                             {isAiTurn && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-900 text-[10px] font-black px-3 py-1 rounded-full shadow-md tracking-widest uppercase">
                                    Current Turn
                                </div>
                             )}
                             <div className="flex justify-between items-center text-sm mb-4">
                                 <span className="font-bold flex items-center gap-3 text-white text-lg">
                                     <div className="w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]" style={{color: ai.color, backgroundColor: ai.color}}/>
                                     {ai.name} 
                                 </span>
                                 <span className="text-yellow-400 font-mono font-bold flex items-center gap-1 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                                    <Trophy size={14}/> {ai.score}
                                 </span>
                             </div>
                             
                             <div className="grid grid-cols-5 gap-2 relative">
                                 {ai.board.map((c, i) => (
                                     <div key={i} className={`
                                        w-full aspect-square rounded-lg relative transition-colors duration-300
                                        ${c.isFlipped 
                                            ? 'bg-gradient-to-br from-green-500 to-green-700 shadow-inner' 
                                            : 'bg-slate-700'}
                                     `}>
                                          {/* Mini Board Overlay */}
                                          {renderCellOverlay(c.hanja.id, ai)}
                                     </div>
                                 ))}
                             </div>
                        </div>
                    );
                })}
            </div>

             {/* Game Log */}
             <div className="bg-slate-800 rounded-2xl p-0 border border-slate-700 shadow-sm flex-1 min-h-[250px] flex flex-col overflow-hidden">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider p-4 bg-slate-900/50 border-b border-slate-700 flex items-center gap-2">
                    <ScrollText size={14}/> Game Log
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[300px] scrollbar-thin scrollbar-thumb-slate-600">
                    {gameLog.map((log, i) => (
                        <div key={i} className="text-sm text-slate-300 animate-in slide-in-from-left-2 fade-in leading-relaxed pl-3 border-l-2 border-slate-600">
                            <span className="text-slate-500 mr-2 font-mono block text-[10px] mb-0.5">
                                {new Date().toLocaleTimeString().slice(3,8)}
                            </span>
                            {log}
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* QUIZ OVERLAY */}
      {phase === GamePhase.QUIZ && quizState && (
          <QuizBattle 
            quizState={quizState}
            players={players}
            onAnswer={(optId) => handleQuizAnswer(players[0].id, optId)}
            currentPlayerId={activePlayer.id}
            myPlayerId={players[0].id}
            timeLeft={timeLeft}
          />
      )}

      {/* GAME OVER MODAL */}
      {phase === GamePhase.GAME_OVER && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-500">
               <div className="bg-slate-800 p-10 rounded-3xl border border-yellow-500/50 shadow-2xl text-center max-w-sm w-full relative overflow-hidden">
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent" />
                   
                   <Trophy size={80} className="mx-auto text-yellow-400 mb-6 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                   
                   <h2 className="text-4xl font-black text-white mb-2 tracking-tight">
                       {players.find(p => p.score >= settings.winLines)?.name} 승리!
                   </h2>
                   <p className="text-slate-400 mb-8 font-medium">멋진 승부였습니다!</p>
                   
                   <button 
                     onClick={() => setPhase(GamePhase.SETUP)}
                     className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95 text-lg flex items-center justify-center gap-2"
                   >
                       <Play size={20} fill="currentColor"/> 다시 하기
                   </button>
               </div>
          </div>
      )}
    </div>
  );
};

export default App;
