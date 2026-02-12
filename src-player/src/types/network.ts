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

/**
 * Normalize question types from host to standardized player types
 *
 * Host now sends pre-normalized types from normalizeQuestionTypeForBroadcast:
 * - 'letters', 'multiple-choice', 'numbers', 'sequence', 'buzzin'
 *
 * This function provides defensive normalization for any variations or legacy types:
 * - Handles case-insensitive matching
 * - Maps older formats ('multi', 'nearest', 'nearestwins') to new format
 * - Validates and returns one of: 'letters', 'multiple-choice', 'numbers', 'sequence', 'buzzin'
 *
 * @param type - The question type string from host
 * @returns Normalized type suitable for UI rendering
 */
export function normalizeQuestionType(type?: string): string {
  if (!type) return 'buzzin';

  const normalized = type.toLowerCase().trim();

  // Map host types to standard player types
  switch (normalized) {
    // Standard types (sent by host after normalization)
    case 'letters':
      return 'letters';
    case 'multiple-choice':
      return 'multiple-choice';
    case 'numbers':
      return 'numbers';
    case 'sequence':
      return 'sequence';

    // Legacy/variant types (defensive mapping)
    case 'multi':
      return 'multiple-choice';
    case 'nearest':
    case 'nearestwins':
      return 'numbers';

    // Buzz-in variants
    case 'buzzin':
    case 'buzz-in':
    case 'buzz':
      return 'buzzin';

    // Unknown types: attempt intelligent fallback
    default: {
      const lowerType = normalized.toLowerCase();

      // If contains 'letter', treat as letters
      if (lowerType.includes('letter')) {
        console.warn(`[Player] Unknown type "${type}" detected as letters variant`);
        return 'letters';
      }

      // If contains 'multi' or 'choice', treat as multiple-choice
      if (lowerType.includes('multi') || lowerType.includes('choice')) {
        console.warn(`[Player] Unknown type "${type}" detected as multiple-choice variant`);
        return 'multiple-choice';
      }

      // If contains 'number' or 'nearest', treat as numbers
      if (lowerType.includes('number') || lowerType.includes('nearest')) {
        console.warn(`[Player] Unknown type "${type}" detected as numbers variant`);
        return 'numbers';
      }

      // If contains 'sequence', treat as sequence
      if (lowerType.includes('sequence')) {
        console.warn(`[Player] Unknown type "${type}" detected as sequence variant`);
        return 'sequence';
      }

      // Default fallback for truly unknown types
      console.warn(`[Player] Unknown question type: "${type}", defaulting to buzzin`);
      return 'buzzin';
    }
  }
}

/**
 * Get display label for a question type
 * Converts normalized type to human-readable label for UI display
 */
export function getQuestionTypeLabel(type?: string): string {
  const normalized = normalizeQuestionType(type);

  switch (normalized) {
    case 'letters':
      return 'LETTERS';
    case 'multiple-choice':
      return 'MULTIPLE CHOICE';
    case 'numbers':
      return 'NUMBERS';
    case 'sequence':
      return 'SEQUENCE';
    case 'buzzin':
      return 'BUZZ IN';
    default:
      return 'QUESTION';
  }
}

/**
 * Check if question text is a placeholder (waiting for actual question)
 * Used to determine if we should show the question type label instead
 */
export function isPlaceholderQuestion(text?: string): boolean {
  if (!text) return true;

  const lowerText = text.toLowerCase();
  const placeholderKeywords = [
    'waiting',
    'being set up',
    'please wait',
    'standby',
    'setting up',
  ];

  return placeholderKeywords.some(keyword => lowerText.includes(keyword));
}

export interface TeamPhotoMessage {
  type: 'TEAM_PHOTO_UPDATE';
  teamName: string;
  photoData: string; // Base64 encoded image
  timestamp: number;
}

export interface PlayerJoinMessage {
  type: 'PLAYER_JOIN';
  playerId: string;
  deviceId: string;
  teamName: string;
  teamPhoto?: string; // Base64 encoded image (optional)
  timestamp?: number;
}

export interface PlayerAnswerMessage {
  type: 'PLAYER_ANSWER';
  playerId: string;
  deviceId: string;
  teamName: string;
  answer: string | number | any;
  timestamp?: number;
}

export interface PlayerAwayMessage {
  type: 'PLAYER_AWAY';
  playerId: string;
  deviceId: string;
  teamName: string;
  reason: string;
  timestamp: number;
}

export interface PlayerActiveMessage {
  type: 'PLAYER_ACTIVE';
  playerId: string;
  deviceId: string;
  teamName: string;
  reason: string;
  timestamp: number;
}

export type ClientMessage = PlayerJoinMessage | TeamPhotoMessage | PlayerAnswerMessage | PlayerAwayMessage | PlayerActiveMessage;
