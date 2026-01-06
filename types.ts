
export interface BusStop {
  id: string;
  name: string;
}

export type GameDirection = 'ida' | 'vuelta';

export interface RouteData {
  id: string;
  name: string;
  stops: string[]; // Order of stop names
}

export type GameStatus = 'setup' | 'playing' | 'success' | 'failed';

export interface GameState {
  currentRoute: RouteData | null;
  direction: GameDirection;
  selectedStops: string[];
  remainingOptions: string[];
  status: GameStatus;
  streak: number;
}

export type GameDifficulty = 'normal' | 'hard' | 'study';

export type GameMode = 'standard' | 'study';
