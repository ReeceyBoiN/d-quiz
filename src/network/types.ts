/**
 * Network message types for player-host communication
 */

export type PlayerMessageType =
  | 'PLAYER_JOIN'      // Player registers team name
  | 'PLAYER_ANSWER'    // Player submits answer
  | 'PLAYER_BUZZ'      // Player buzzes in
  | 'PLAYER_BUZZER_SELECT'  // Player selects a buzzer audio file
  | 'PLAYER_DISCONNECT'
  | 'ADMIN_COMMAND';   // Controller sends admin command to host

export type HostMessageType =
  | 'PICTURE'
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
  | 'CONTROLLER_AUTH_SUCCESS'  // Host confirms PIN authentication
  | 'CONTROLLER_AUTH_FAILED'   // Host denies PIN authentication
  | 'ADMIN_RESPONSE';          // Host responds to admin command

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
  buzzerSound?: string; // Selected buzzer audio filename
}

export interface PlayerBuzzerSelectMessage {
  type: 'PLAYER_BUZZER_SELECT';
  playerId: string;
  deviceId: string;
  teamName: string;
  buzzerSound: string; // Buzzer audio filename
  timestamp?: number;
}
