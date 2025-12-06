/**
 * Network message types for player-host communication
 */

export type PlayerMessageType =
  | 'PLAYER_JOIN'      // Player registers team name
  | 'PLAYER_ANSWER'    // Player submits answer
  | 'PLAYER_BUZZ'      // Player buzzes in
  | 'PLAYER_DISCONNECT';

export type HostMessageType =
  | 'PICTURE'
  | 'QUESTION_READY'
  | 'QUESTION'
  | 'TIMER_START'
  | 'TIMER'
  | 'TIMEUP'
  | 'LOCK'
  | 'REVEAL'
  | 'FASTEST'
  | 'SCORES'
  | 'NEXT'
  | 'END_ROUND'
  | 'PLAYER_REGISTERED'  // Host confirms player registration
  | 'PLAYER_LIST'        // Send list of current players
  | 'ANSWER_CONFIRMED';  // Host confirms answer was received

export interface PlayerMessage {
  type: PlayerMessageType;
  playerId: string;
  teamName?: string;
  answer?: any;
  timestamp: number;
}

export interface HostMessage {
  type: HostMessageType;
  data?: any;
  timestamp?: number;
}

export interface NetworkPlayer {
  id: string;
  teamName: string;
  timestamp: number;
  isConnected: boolean;
}
