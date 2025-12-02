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
  | 'PLAYER_REGISTERED'
  | 'PLAYER_LIST'
  | 'TEAM_APPROVED'
  | 'APPROVAL_PENDING'
  | 'TEAM_DECLINED';

export interface HostMessage {
  type: HostMessageType;
  data?: any;
  timestamp?: number;
}

export interface Question {
  type: string;
  text?: string;
  q?: string;
  options?: string[];
  correctIndex?: number;
  imageUrl?: string;
  revealed?: boolean;
  revealedAnswer?: string;
}
