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
  | 'TEAM_DECLINED'
  | 'DISPLAY_MODE'
  | 'DISPLAY_UPDATE'
  | 'LEADERBOARD_UPDATE'
  | 'SLIDESHOW_UPDATE'
  | 'GO_WIDE';

export interface HostMessage {
  type: HostMessageType;
  data?: any;
  timestamp?: number;
}

export interface Question {
  type?: string;
  text?: string;
  q?: string;
  options?: string[];
  correctIndex?: number;
  imageUrl?: string;
  revealed?: boolean;
  revealedAnswer?: string;
  goWideEnabled?: boolean;
}

export interface TeamPhotoMessage {
  type: 'TEAM_PHOTO_UPDATE';
  teamName: string;
  photoData: string; // Base64 encoded image
  timestamp: number;
}
