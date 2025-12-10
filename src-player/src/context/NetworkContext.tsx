import { createContext } from 'react';
import type { PlayerSettings } from '../hooks/usePlayerSettings';

interface NetworkContextType {
  isConnected: boolean;
  playerId: string;
  teamName: string;
  playerSettings?: PlayerSettings;
  goWideEnabled?: boolean;
  answerRevealed?: boolean;
  correctAnswer?: string | number | (string | number)[];
  selectedAnswers?: any[];
}

export const NetworkContext = createContext<NetworkContextType | undefined>(undefined);
