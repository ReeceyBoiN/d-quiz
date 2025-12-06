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
  | 'PLAYER_REGISTERED'
  | 'PLAYER_LIST'
  | 'TEAM_APPROVED'
  | 'APPROVAL_PENDING'
  | 'TEAM_DECLINED'
  | 'ANSWER_CONFIRMED'
  | 'ANSWER_ACK';

export interface HostMessage {
  type: HostMessageType;
  data?: any;
  timestamp?: number;
}

export type QuestionType = 'letters' | 'multi' | 'numbers' | 'nearest' | 'buzzin' | 'sequence' | string;

export interface Question {
  type: QuestionType;
  text?: string;
  q?: string;
  options?: string[];
  correctIndex?: number;
  imageUrl?: string;
  revealed?: boolean;
  revealedAnswer?: string;
  shown?: boolean; // Whether the question text should be displayed
  maxAnswers?: number; // Maximum number of answers allowed (default 1, or 2+ for go wide mode)
}
