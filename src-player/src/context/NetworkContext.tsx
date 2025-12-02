import { createContext } from 'react';

interface NetworkContextType {
  isConnected: boolean;
  playerId: string;
  teamName: string;
}

export const NetworkContext = createContext<NetworkContextType | undefined>(undefined);
