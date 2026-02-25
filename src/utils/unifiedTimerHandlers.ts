/**
 * Unified Timer Handler Utilities
 *
 * This module provides pure, testable handler functions for timer actions
 * that can be called identically from both:
 * - Host app UI (direct function calls)
 * - Host remote (via ADMIN_COMMAND messaging)
 *
 * This ensures no logic divergence between the two execution paths.
 */

import { playCountdownAudio } from './countdownAudio';
import { sendTimerToPlayers } from '../network/wsHost';

export interface TimerActionResult {
  success: boolean;
  timerDuration: number;
  timerStartTime: number;
  silent: boolean;
  flowStateUpdate: {
    flow: 'running';
    timerMode: 'normal' | 'silent';
  };
}

/**
 * Execute a normal (non-silent) timer start action.
 * This is the canonical implementation called by both UI and remote.
 *
 * @param timerDuration - Duration in seconds
 * @param onExternalDisplay - Optional callback to notify external display
 * @returns TimerActionResult with all necessary state updates
 */
export async function executeStartNormalTimer(
  timerDuration: number,
  onExternalDisplay?: (messageData: any) => void
): Promise<TimerActionResult> {
  const now = Date.now();

  try {
    // Step 1: Play countdown audio (with normal sound)
    // This must complete before starting the timer
    await playCountdownAudio(timerDuration, false);
    console.log('[TimerHandlers] Normal countdown audio started');
  } catch (error) {
    console.error('[TimerHandlers] Error playing normal countdown audio:', error);
    // Don't fail - continue with timer even if audio fails
  }

  // Step 2: Send timer to players with synchronized start time
  // Players use timerStartTime to calculate accurate response times
  sendTimerToPlayers(timerDuration, false, now);
  console.log('[TimerHandlers] Timer broadcast to players:', {
    duration: timerDuration,
    startTime: now,
    silent: false,
  });

  // Step 3: Update external display with timer
  if (onExternalDisplay) {
    try {
      onExternalDisplay({
        type: 'TIMER',
        data: { seconds: timerDuration, totalTime: timerDuration },
        totalTime: timerDuration,
      });
      console.log('[TimerHandlers] External display timer updated');
    } catch (err) {
      console.warn('[TimerHandlers] Could not update external display:', err);
    }
  }

  return {
    success: true,
    timerDuration,
    timerStartTime: now,
    silent: false,
    flowStateUpdate: {
      flow: 'running',
      timerMode: 'normal',
    },
  };
}

/**
 * Execute a silent timer start action.
 * This is the canonical implementation called by both UI and remote.
 *
 * @param timerDuration - Duration in seconds
 * @param onExternalDisplay - Optional callback to notify external display
 * @returns TimerActionResult with all necessary state updates
 */
export async function executeStartSilentTimer(
  timerDuration: number,
  onExternalDisplay?: (messageData: any) => void
): Promise<TimerActionResult> {
  const now = Date.now();

  try {
    // Step 1: Play countdown audio (silent mode - no sound)
    // This must complete before starting the timer
    await playCountdownAudio(timerDuration, true);
    console.log('[TimerHandlers] Silent countdown audio started');
  } catch (error) {
    console.error('[TimerHandlers] Error playing silent countdown audio:', error);
    // Don't fail - continue with timer even if audio fails
  }

  // Step 2: Send timer to players with synchronized start time
  // Players use timerStartTime to calculate accurate response times
  sendTimerToPlayers(timerDuration, true, now);
  console.log('[TimerHandlers] Timer broadcast to players:', {
    duration: timerDuration,
    startTime: now,
    silent: true,
  });

  // Step 3: Update external display with timer
  if (onExternalDisplay) {
    try {
      onExternalDisplay({
        type: 'TIMER',
        data: { seconds: timerDuration, totalTime: timerDuration },
        totalTime: timerDuration,
      });
      console.log('[TimerHandlers] External display timer updated');
    } catch (err) {
      console.warn('[TimerHandlers] Could not update external display:', err);
    }
  }

  return {
    success: true,
    timerDuration,
    timerStartTime: now,
    silent: true,
    flowStateUpdate: {
      flow: 'running',
      timerMode: 'silent',
    },
  };
}

/**
 * Validate timer duration for security and sanity
 * - Must be a finite number
 * - Must be between 1 and 600 seconds (10 minutes)
 * 
 * @param duration - The duration to validate
 * @param fallback - Default value if validation fails
 * @returns Validated duration
 */
export function validateTimerDuration(duration: unknown, fallback: number = 30): number {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    console.warn('[TimerHandlers] Invalid timer duration:', duration, 'using fallback:', fallback);
    return fallback;
  }
  
  // Clamp to reasonable bounds: 1 second to 10 minutes
  const clamped = Math.max(1, Math.min(600, Math.floor(duration)));
  
  if (clamped !== duration) {
    console.warn('[TimerHandlers] Timer duration clamped:', {
      original: duration,
      clamped,
    });
  }
  
  return clamped;
}
