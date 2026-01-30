import { calculateTeamPoints, type ScoringConfig } from "./scoringEngine";

/**
 * Extract the correct answer from a question based on its type
 * Converts correctIndex to letters (A, B, C) for multi-choice and letters question types
 * Returns sequence item for sequence type, or answerText/meta.short_answer for others
 *
 * This ensures consistency with player portal submissions which use letters
 */
export const getAnswerText = (question: any): string => {
  if (!question) return '';

  // For multiple-choice and letters: convert correctIndex to letter (A, B, C, etc.)
  // This must be checked FIRST to ensure we return letters, not option text
  if (question.type?.toLowerCase() === 'multi' && question.correctIndex !== undefined) {
    return String.fromCharCode(65 + question.correctIndex);
  }

  if (question.type?.toLowerCase() === 'letters' && question.correctIndex !== undefined) {
    return String.fromCharCode(65 + question.correctIndex);
  }

  // For sequence: return the sequence item at correctIndex
  if (question.type?.toLowerCase() === 'sequence' && question.options && question.correctIndex !== undefined) {
    return question.options[question.correctIndex] || '';
  }

  // For other types: use answerText or meta.short_answer
  if (question.answerText) {
    return question.answerText;
  }

  if (question.meta?.short_answer) {
    return question.meta.short_answer;
  }

  return '';
};

/**
 * Compute and award points to ALL teams (correct, wrong, no-answer)
 * Handles: normal points, speed bonus, staggered mode, go-wide penalty, evil/punishment modes
 * This is the unified scoring function that replaces the old handleAwardPointsWithScoring
 * 
 * Factory function: Returns the handler function with dependencies injected
 */
export const createHandleComputeAndAwardScores = (
  quizzes: any[],
  teamAnswers: { [teamId: string]: string },
  teamAnswerCounts: { [teamId: string]: number },
  currentRoundPoints: number | null,
  currentRoundSpeedBonus: number | null,
  defaultPoints: number,
  defaultSpeedBonus: number,
  scoresPaused: boolean,
  staggeredEnabled: boolean,
  goWideEnabled: boolean,
  evilModeEnabled: boolean,
  punishmentEnabled: boolean,
  handleScoreChange: (teamId: string, points: number) => void
) => {
  return (
    correctTeamIds: string[],
    gameMode: 'keypad' | 'buzzin' | 'nearestwins' | 'wheelspinner',
    fastestTeamId?: string,
    teamResponseTimes?: { [teamId: string]: number }
  ) => {
    if (scoresPaused) {
      console.log('[Scoring] Scores are paused. Ignoring points award.');
      return;
    }

    // Use current scoring settings from component-level useSettings
    const scoringConfig: ScoringConfig = {
      pointsValue: currentRoundPoints || defaultPoints || 0,
      speedBonusValue: currentRoundSpeedBonus || defaultSpeedBonus || 0,
      evilModeEnabled: evilModeEnabled || false,
      punishmentModeEnabled: punishmentEnabled || false,
      staggeredEnabled: staggeredEnabled || false,
      goWideEnabled: goWideEnabled || false
    };

    // Process all teams (correct, wrong, and no-answer)
    quizzes.forEach((team) => {
      const teamAnswer = teamAnswers[team.id];
      const teamResponse = teamResponseTimes?.[team.id];

      // Determine if this team answered correctly
      const isCorrect = correctTeamIds.includes(team.id);
      const hasNoAnswer = !teamAnswer || String(teamAnswer).trim() === '';

      // Determine if team submitted 2 answers (go-wide) - use tracked answerCount or default
      const answerCount = teamAnswerCounts[team.id] || (isCorrect || !hasNoAnswer ? 1 : 0);

      // Determine rank for staggered mode (only for correct teams)
      let teamRank: number | undefined;
      if (isCorrect) {
        if (fastestTeamId === team.id) {
          teamRank = 1;
        } else if (staggeredEnabled && teamResponse) {
          teamRank = Object.entries(teamResponseTimes || {})
            .filter(([id]) => correctTeamIds.includes(id))
            .sort(([, timeA], [, timeB]) => timeA - timeB)
            .findIndex(([id]) => id === team.id) + 1;
        }
      }

      const scoreResult = calculateTeamPoints({
        teamId: team.id,
        correctAnswer: isCorrect,
        noAnswer: hasNoAnswer,
        answerCount,
        responseTime: teamResponse || 0,
        rank: teamRank
      }, scoringConfig, correctTeamIds.length);

      // Only apply score change if there's a non-zero change
      if (scoreResult.totalPoints !== 0) {
        console.log(`[Scoring] Team ${team.name}: ${scoreResult.description}`);
        handleScoreChange(team.id, scoreResult.totalPoints);
      }
    });

    console.log('[Scoring] All team scores computed and awarded for game mode:', gameMode);
  };
};

/**
 * Apply evil mode and punishment mode penalties to wrong/no-answer teams
 * Handles: evil mode (wrong answer penalty), punishment mode (no-answer penalty)
 * 
 * Factory function: Returns the handler function with dependencies injected
 */
export const createHandleApplyEvilModePenalty = (
  quizzes: any[],
  currentRoundPoints: number | null,
  defaultPoints: number,
  evilModeEnabled: boolean,
  punishmentEnabled: boolean,
  scoresPaused: boolean,
  handleScoreChange: (teamId: string, points: number) => void
) => {
  return (
    wrongTeamIds: string[],
    noAnswerTeamIds: string[],
    gameMode: 'keypad' | 'buzzin' | 'nearestwins' | 'wheelspinner'
  ) => {
    if (scoresPaused) {
      console.log('[Evil Mode] Scores are paused. Ignoring penalty.');
      return;
    }

    // Use current round points or default points from component-level useSettings
    const scoringConfig: ScoringConfig = {
      pointsValue: currentRoundPoints || defaultPoints || 0,
      speedBonusValue: 0, // No speed bonus for penalties
      evilModeEnabled: evilModeEnabled || false,
      punishmentModeEnabled: punishmentEnabled || false,
      staggeredEnabled: false, // Staggered doesn't apply to penalties
      goWideEnabled: false // Go-wide doesn't apply to penalties
    };

    // Apply penalties to wrong answer teams
    wrongTeamIds.forEach((teamId) => {
      const team = quizzes.find(t => t.id === teamId);
      if (!team) return;

      const scoreResult = calculateTeamPoints({
        teamId,
        correctAnswer: false,
        noAnswer: false,
        answerCount: 1,
        responseTime: 0
      }, scoringConfig, 0);

      if (scoreResult.totalPoints !== 0) {
        console.log(`[Evil Mode] Team ${team.name}: ${scoreResult.description}`);
        handleScoreChange(teamId, scoreResult.totalPoints);
      }
    });

    // Apply penalties to no-answer teams
    noAnswerTeamIds.forEach((teamId) => {
      const team = quizzes.find(t => t.id === teamId);
      if (!team) return;

      const scoreResult = calculateTeamPoints({
        teamId,
        correctAnswer: false,
        noAnswer: true,
        answerCount: 0,
        responseTime: 0
      }, scoringConfig, 0);

      if (scoreResult.totalPoints !== 0) {
        console.log(`[Evil Mode] Team ${team.name}: ${scoreResult.description}`);
        handleScoreChange(teamId, scoreResult.totalPoints);
      }
    });

    console.log('[Evil Mode] Penalties applied successfully for game mode:', gameMode);
  };
};
