/**
 * Scoring Engine - Core scoring algorithm for all game modes
 * Handles standard points, speed bonuses, evil mode, punishment, staggered bonuses, and go-wide penalties
 */

export interface ScoringConfig {
  pointsValue: number;              // Base points for correct answer
  speedBonusValue: number;          // Speed bonus points for fastest
  evilModeEnabled: boolean;         // Subtract points for wrong
  punishmentModeEnabled: boolean;   // Subtract points for no-answer
  staggeredEnabled: boolean;        // Scale bonus by rank
  goWideEnabled: boolean;           // Allow 2 answers (half points)
}

export interface TeamScoreData {
  teamId: string;
  correctAnswer: boolean;
  noAnswer: boolean;
  answerCount: number;              // 1 or 2 (if go wide)
  responseTime: number;             // ms from timer start
  rank?: number;                    // Position in speed ranking (1st, 2nd, etc.)
}

export interface ScoreResult {
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
  description: string;
}

/**
 * Calculate points for a single team based on their answer and the game configuration
 */
export function calculateTeamPoints(
  team: TeamScoreData,
  config: ScoringConfig,
  totalCorrectTeams: number
): ScoreResult {
  const result: ScoreResult = {
    basePoints: 0,
    speedBonus: 0,
    totalPoints: 0,
    description: ''
  };

  // CORRECT ANSWER TEAMS
  if (team.correctAnswer) {
    // Calculate base points (with go-wide penalty)
    if (config.goWideEnabled && team.answerCount === 2) {
      // Half points for 2-answer submission, rounded UP
      result.basePoints = Math.ceil(config.pointsValue * 0.5);
      result.description = `Correct (2 answers: ${result.basePoints} points)`;
    } else {
      result.basePoints = config.pointsValue;
      result.description = `Correct (${result.basePoints} points)`;
    }

    // Calculate speed bonus
    if (config.staggeredEnabled && team.rank !== undefined && team.rank > 0) {
      // Staggered: 1st=max, 2nd=max-1, 3rd=max-2, etc., until 0
      result.speedBonus = Math.max(config.speedBonusValue - (team.rank - 1), 0);
      result.description += ` + Speed bonus (rank ${team.rank}: ${result.speedBonus} points)`;
    } else if (!config.staggeredEnabled && team.rank === 1) {
      // Non-staggered: only 1st place gets bonus
      result.speedBonus = config.speedBonusValue;
      result.description += ` + Speed bonus (${result.speedBonus} points)`;
    }

    result.totalPoints = result.basePoints + result.speedBonus;
  }
  // INCORRECT ANSWER TEAMS
  else if (!team.noAnswer) {
    if (config.evilModeEnabled) {
      result.totalPoints = -config.pointsValue;
      result.description = `Incorrect (-${config.pointsValue} points)`;
    } else {
      result.totalPoints = 0;
      result.description = `Incorrect (0 points)`;
    }
  }
  // NO-ANSWER TEAMS
  else {
    if (config.punishmentModeEnabled) {
      result.totalPoints = -config.pointsValue;
      result.description = `No answer (-${config.pointsValue} points)`;
    } else {
      result.totalPoints = 0;
      result.description = `No answer (0 points)`;
    }
  }

  return result;
}

/**
 * Determine if go-wide should be disabled for this question based on option count
 */
export function shouldAutoDisableGoWide(optionCount: number, goWideEnabled: boolean): boolean {
  // Auto-disable if 2 or fewer options and go-wide is enabled
  return goWideEnabled && optionCount <= 2;
}

/**
 * Batch calculate points for all teams
 */
export function calculateAllTeamPoints(
  teams: TeamScoreData[],
  config: ScoringConfig
): { [teamId: string]: ScoreResult } {
  const results: { [teamId: string]: ScoreResult } = {};

  teams.forEach(team => {
    const correctTeams = teams.filter(t => t.correctAnswer);
    results[team.teamId] = calculateTeamPoints(team, config, correctTeams.length);
  });

  return results;
}

/**
 * Rank correct teams by response time
 */
export function rankCorrectTeams(
  correctTeams: Array<{ teamId: string; responseTime: number }>
): { [teamId: string]: number } {
  const rankings: { [teamId: string]: number } = {};

  // Sort by response time (ascending - fastest first)
  correctTeams
    .sort((a, b) => a.responseTime - b.responseTime)
    .forEach((team, index) => {
      rankings[team.teamId] = index + 1; // 1st place, 2nd place, etc.
    });

  return rankings;
}
