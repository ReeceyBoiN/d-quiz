import { createContext } from 'react';
import type { PlayerSettings } from '../hooks/usePlayerSettings';

interface NetworkContextType {
  isConnected: boolean;
  playerId: string;
  teamName: string;
  playerSettings?: PlayerSettings;
  goWideEnabled?: boolean;
  autoDisableGoWide?: boolean;
  answerRevealed?: boolean;
  correctAnswer?: string | number | (string | number)[];
  selectedAnswers?: any[];
  showAnswerFeedback?: boolean;
  isAnswerCorrect?: boolean;
}

export const NetworkContext = createContext<NetworkContextType | undefined>(undefined);
