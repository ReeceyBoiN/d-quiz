/**
 * Game State Persistence - Save and restore game state for crash recovery
 * Stores team data, scores, settings, and question history to local file
 */

export interface SavedTeamData {
  id: string;
  name: string;
  score: number;
  photoUrl?: string;
  buzzSound?: string;
  backgroundColor?: string;
}

export interface RoundSettings {
  pointsValue: number;
  speedBonusValue: number;
  evilModeEnabled: boolean;
  punishmentModeEnabled: boolean;
  staggeredEnabled: boolean;
  goWideEnabled: boolean;
}

export interface QuestionEntry {
  questionIndex: number;
  questionText: string;
  questionType: string;
  correctAnswer: string;
  teamResponses: { [teamId: string]: string };
  teamScores: { [teamId: string]: number };
  pointsAwarded: { [teamId: string]: number };
  timestamp: number;
}

export interface SavedGameState {
  version: number;
  teams: SavedTeamData[];
  roundSettings: RoundSettings;
  questionHistory: QuestionEntry[];
  currentQuestionIndex: number;
  lastSavedAt: number;
  sessionId: string;
}

const SAVE_FILE_PATH = '.d-quiz-save/latest-game-state.json';
const SESSION_ID = `session-${Date.now()}`;

/**
 * Save game state to local file via Electron IPC
 */
export async function saveGameState(state: Omit<SavedGameState, 'version' | 'lastSavedAt' | 'sessionId'>): Promise<void> {
  try {
    const fullState: SavedGameState = {
      version: 1,
      lastSavedAt: Date.now(),
      sessionId: SESSION_ID,
      ...state
    };

    if ((window as any).api?.persistence?.saveGameState) {
      await (window as any).api.persistence.saveGameState(fullState);
      console.log('[GameStatePersistence] Game state saved successfully');
    } else {
      console.warn('[GameStatePersistence] Persistence API not available');
    }
  } catch (error) {
    console.error('[GameStatePersistence] Error saving game state:', error);
  }
}

/**
 * Load game state from local file via Electron IPC
 */
export async function loadGameState(): Promise<SavedGameState | null> {
  try {
    if ((window as any).api?.persistence?.loadGameState) {
      const state = await (window as any).api.persistence.loadGameState();
      if (state) {
        console.log('[GameStatePersistence] Game state loaded successfully');
        return state;
      }
    } else {
      console.warn('[GameStatePersistence] Persistence API not available');
    }
  } catch (error) {
    console.error('[GameStatePersistence] Error loading game state:', error);
  }
  return null;
}

/**
 * Clear saved game state (called when "Empty Lobby" is triggered)
 */
export async function clearGameState(): Promise<void> {
  try {
    if ((window as any).api?.persistence?.clearGameState) {
      await (window as any).api.persistence.clearGameState();
      console.log('[GameStatePersistence] Game state cleared');
    }
  } catch (error) {
    console.error('[GameStatePersistence] Error clearing game state:', error);
  }
}

/**
 * Check if a saved state is recent enough to restore (within 1 hour)
 */
export function isSaveStateRecent(savedAt: number, maxAgeMs: number = 60 * 60 * 1000): boolean {
  return Date.now() - savedAt < maxAgeMs;
}

/**
 * Create a game state snapshot from current app state
 */
export function createGameStateSnapshot(
  teams: Array<{ id: string; name: string; score: number; photoUrl?: string; buzzSound?: string; backgroundColor?: string }>,
  roundSettings: RoundSettings,
  questionHistory: QuestionEntry[],
  currentQuestionIndex: number
): Omit<SavedGameState, 'version' | 'lastSavedAt' | 'sessionId'> {
  return {
    teams: teams.map(t => ({
      id: t.id,
      name: t.name,
      score: t.score,
      photoUrl: t.photoUrl,
      buzzSound: t.buzzSound,
      backgroundColor: t.backgroundColor
    })),
    roundSettings,
    questionHistory,
    currentQuestionIndex
  };
}
