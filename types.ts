export type Grade = '8급' | '7급' | '6급' | '5급' | '4급' | '3급' | '2급' | '1급';

export interface HanjaData {
  id: string;
  char: string;
  hun: string; // meaning (e.g. 하늘)
  eum: string; // sound (e.g. 천)
  hunEum: string; // combined (e.g. 하늘 천)
}

export interface Cell {
  id: string; // unique cell id
  hanja: HanjaData;
  isFlipped: boolean; // Has been correctly answered
  isPeeked: boolean; // Temporarily visible during PEEK phase (local UI only)
  gridIndex: number; // 0-24 position
}

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  board: Cell[]; // Each player has their own arrangement of the same 25 hanja
  score: number; // Lines completed
  color: string;
  bonusGauge: number; // Accumulates to 3 for a shield
  hasShield: boolean;
}

export enum GamePhase {
  SETUP = 'SETUP',
  LOADING = 'LOADING',
  TURN_START = 'TURN_START',
  PEEK = 'PEEK',
  SELECT = 'SELECT',
  QUIZ = 'QUIZ',
  EVALUATE = 'EVALUATE',
  GAME_OVER = 'GAME_OVER'
}

export interface GameSettings {
  grade: Grade;
  playerCount: number; // 2-4
  mode: 'STANDARD' | 'DRAFT';
  winLines: 1 | 3;
}

export interface QuizState {
  targetHanja: HanjaData | null;
  type: 'HANJA_TO_HUNEUM' | 'HUNEUM_TO_HANJA';
  options: HanjaData[]; // 4 options
  correctOptionId: string;
  answers: Record<string, string>; // playerId -> optionId
  resultsShown: boolean;
}
