
import React from 'react';
import { QuizState, Player } from '../types';
import { Timer, HelpCircle, User } from 'lucide-react';

interface QuizBattleProps {
  quizState: QuizState;
  players: Player[];
  onAnswer: (optionId: string) => void;
  currentPlayerId: string; // The person whose turn initiated this
  myPlayerId: string; // The human user
  timeLeft: number;
}

const QuizBattle: React.FC<QuizBattleProps> = ({ 
  quizState, 
  players, 
  onAnswer, 
  currentPlayerId, 
  myPlayerId,
  timeLeft 
}) => {
  const { targetHanja, type, options, answers, resultsShown, correctOptionId } = quizState;

  if (!targetHanja) return null;

  const isHanjaToHunEum = type === 'HANJA_TO_HUNEUM';
  const questionText = isHanjaToHunEum 
    ? `다음 한자의 훈(뜻)과 음(소리)은?` 
    : `다음 뜻과 소리에 맞는 한자는?`;
  
  const questionContent = isHanjaToHunEum 
    ? <span className="text-7xl font-serif font-black text-yellow-400 drop-shadow-lg">{targetHanja.char}</span>
    : <span className="text-4xl font-bold text-yellow-400 drop-shadow-lg">{targetHanja.hunEum}</span>;

  const hasAnswered = !!answers[myPlayerId];
  const initiator = players.find(p => p.id === currentPlayerId);

  // Calculate percentage for timer bar
  const timerPercentage = (timeLeft / 10) * 100; // Assuming 10s is max

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-slate-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-700 relative">
        
        {/* Timer Bar */}
        <div className="absolute top-0 left-0 h-2 bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000 ease-linear z-10"
             style={{ width: `${Math.min(timerPercentage, 100)}%` }} />

        {/* Header */}
        <div className="bg-slate-900 p-5 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
                 <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Turn</span>
                 <span className="font-bold text-white flex items-center gap-2 text-lg">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: initiator?.color}}/>
                    {initiator?.name}
                 </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
             {/* Live Answer Status with Avatars */}
             <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase hidden sm:block">Status</span>
                <div className="flex -space-x-2">
                    {players.map(p => {
                        const hasSubmitted = !!answers[p.id];
                        return (
                            <div key={p.id} 
                                className={`
                                    relative w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center transition-all duration-300
                                    ${hasSubmitted 
                                        ? 'bg-green-500 text-white scale-110 z-10' 
                                        : 'bg-slate-700 text-slate-500 opacity-50'}
                                `}
                                title={`${p.name} ${hasSubmitted ? '제출 완료' : '생각 중'}`}
                            >
                                <User size={14} />
                                {/* Status Indicator Dot */}
                                {hasSubmitted ? (
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-white rounded-full border-2 border-slate-900"/>
                                ) : (
                                    <div className="absolute inset-0 rounded-full border-2 border-slate-500 border-dashed animate-spin-slow opacity-30"/>
                                )}
                            </div>
                        )
                    })}
                </div>
             </div>

              <div className={`
                 flex items-center gap-1 font-mono font-black text-2xl
                 ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}
              `}>
                 <Timer size={24} /> {timeLeft}
              </div>
          </div>
        </div>

        {/* Question Area */}
        <div className="p-10 flex flex-col items-center justify-center bg-slate-800 text-center space-y-6">
          <p className="text-indigo-200 font-bold text-lg">{questionText}</p>
          <div className="py-2 transform transition-transform hover:scale-105">{questionContent}</div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 gap-3 p-6 bg-slate-900/50">
          {options.map((option, idx) => {
            const isSelected = answers[myPlayerId] === option.id;
            const isCorrect = option.id === correctOptionId;
            
            let btnClass = "p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group ";
            
            if (resultsShown) {
              if (isCorrect) btnClass += "bg-green-600/20 border-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)] ";
              else if (isSelected && !isCorrect) btnClass += "bg-red-600/20 border-red-500 text-white opacity-50 ";
              else btnClass += "bg-slate-800 border-slate-700 text-slate-500 opacity-50 ";
            } else {
              if (isSelected) btnClass += "bg-indigo-600 border-indigo-400 text-white shadow-lg scale-[1.02] z-10 ";
              else btnClass += "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750 hover:border-slate-500 hover:text-white ";
            }

            return (
              <button
                key={option.id}
                onClick={() => !hasAnswered && !resultsShown && timeLeft > 0 && onAnswer(option.id)}
                disabled={hasAnswered || resultsShown || timeLeft === 0}
                className={btnClass}
              >
                <div className="flex items-center gap-5">
                  <span className={`
                     flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-lg font-black transition-colors
                     ${isSelected 
                        ? 'bg-white text-indigo-700 shadow-sm' 
                        : resultsShown && isCorrect 
                            ? 'bg-green-500 text-white' 
                            : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'}
                  `}>
                    {idx + 1}
                  </span>
                  <span className="text-xl font-bold tracking-wide">
                    {isHanjaToHunEum ? option.hunEum : option.char}
                  </span>
                </div>
                
                {/* Answer Avatars (shown at end) */}
                {resultsShown && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex -space-x-2">
                    {players.filter(p => answers[p.id] === option.id).map(p => (
                       <div key={p.id} 
                            className="w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center text-xs text-white font-bold shadow-md relative z-10"
                            style={{ backgroundColor: p.color }}
                            title={p.name}>
                         {p.name.includes("나") ? "Me" : p.name.replace(/[^0-9]/g, '')}
                       </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuizBattle;
