import { createContext } from 'react';
import type { PlayerSettings } from '../hooks/usePlayerSettings';
import type { ClientMessage } from '../types/network';

interface NetworkContextType {
  isConnected: boolean;
  playerId: string;
  deviceId?: string;
  teamName: string;
  playerSettings?: PlayerSettings;
  goWideEnabled?: boolean;
  autoDisableGoWide?: boolean;
  answerRevealed?: boolean;
  correctAnswer?: string | number | (string | number)[];
  selectedAnswers?: any[];
  showAnswerFeedback?: boolean;
  isAnswerCorrect?: boolean;
  sendMessage?: (message: ClientMessage) => void;
}

export const NetworkContext = createContext<NetworkContextType | undefined>(undefined);
