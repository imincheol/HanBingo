
import React from 'react';
import { Cell } from '../types';
import { Eye, CheckCircle2, Flower2 } from 'lucide-react';

interface CardProps {
  cell: Cell;
  isRevealed: boolean; // Fully flipped (correct answer)
  isPeeked: boolean; // Temporarily visible (peek phase)
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
}

const Card: React.FC<CardProps> = ({ cell, isRevealed, isPeeked, onClick, disabled, highlight }) => {
  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`
        relative w-full aspect-square cursor-pointer perspective-1000 select-none
        ${disabled ? 'cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95 transition-transform'}
      `}
    >
      <div 
        className={`
          w-full h-full relative transform-style-3d transition-all duration-500 shadow-xl rounded-xl
          ${isRevealed || isPeeked ? 'rotate-y-180' : ''}
        `}
      >
        {/* Front (Hidden - Card Back Design) */}
        <div className={`
          absolute w-full h-full backface-hidden rounded-xl flex items-center justify-center overflow-hidden
          ${highlight 
            ? 'bg-slate-800 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' 
            : 'bg-slate-800 border border-slate-600'}
        `}>
          {/* Decorative Pattern Background */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-100 via-slate-500 to-slate-900" />
          
          <div className="relative z-10 flex flex-col items-center justify-center text-slate-500">
             {/* Traditional-ish Icon */}
             <div className={`
                w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 flex items-center justify-center mb-1
                ${highlight ? 'border-yellow-500/50 text-yellow-500' : 'border-slate-600 text-slate-600'}
             `}>
               <Flower2 size={24} strokeWidth={1.5} className={highlight ? 'animate-spin-slow' : ''} />
             </div>
          </div>

          {highlight && <div className="absolute inset-0 bg-yellow-500/10 animate-pulse rounded-xl" />}
        </div>

        {/* Back (Revealed/Peeked - Content) */}
        <div className={`
          absolute w-full h-full backface-hidden rounded-xl shadow-md rotate-y-180 flex flex-col items-center justify-center p-1 sm:p-2
          ${isRevealed 
            ? 'bg-gradient-to-br from-green-700 to-emerald-900 text-white border-2 border-green-500' 
            : 'bg-gradient-to-br from-indigo-700 to-slate-900 text-white border border-indigo-400'}
        `}>
          {isRevealed && (
            <div className="absolute top-1 right-1 text-green-300 drop-shadow-md">
              <CheckCircle2 size={16} />
            </div>
          )}
          {isPeeked && !isRevealed && (
            <div className="absolute top-1 right-1 text-yellow-300 drop-shadow-md animate-pulse">
              <Eye size={16} />
            </div>
          )}
          
          {/* Character */}
          <div className="text-4xl sm:text-5xl font-serif font-black mb-0.5 sm:mb-1 drop-shadow-lg leading-none">
            {cell.hanja.char}
          </div>
          
          {/* Meaning & Sound separated */}
          <div className="flex flex-col items-center gap-0.5 w-full">
            <div className="text-xs sm:text-sm text-center font-medium opacity-90 bg-black/30 px-2 py-0.5 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
              {cell.hanja.hun}
            </div>
            <div className="text-sm sm:text-base text-center font-bold text-yellow-300">
              {cell.hanja.eum}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Card;
