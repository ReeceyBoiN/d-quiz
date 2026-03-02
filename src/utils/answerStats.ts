/**
 * Shared utilities for calculating answer statistics
 * Used by both KeypadInterface and QuizHost to compute results
 */

export interface AnswerStats {
  correct: number;
  wrong: number;
  noAnswer: number;
}

export interface Team {
  id: string;
  name: string;
  score?: number;
}

/**
 * Check if an answer is correct based on question type
 * Handles numbers type specially with numeric comparison
 * Other types use string comparison
 */
export const isAnswerCorrect = (
  teamAnswer: string,
  correctAnswer: string,
  questionType: string | null
): boolean => {
  if (!teamAnswer || !correctAnswer) return false;

  // For numbers type, use numeric comparison
  if (questionType?.toLowerCase() === 'numbers') {
    const submittedNum = parseInt(String(teamAnswer).trim(), 10);
    const correctNum = parseInt(String(correctAnswer).trim(), 10);
    return !isNaN(submittedNum) && !isNaN(correctNum) && submittedNum === correctNum;
  }

  // For all other types, use string comparison (exact match, case-sensitive)
  return teamAnswer === correctAnswer;
};

/**
 * Calculate answer statistics from team answers
 * Returns counts of correct, wrong, and no-answer responses
 */
export const calculateAnswerStats = (
  teamAnswers: { [teamId: string]: string } | null | undefined,
  teams: Team[],
  correctAnswer: string | null | undefined,
  questionType: string | null
): AnswerStats => {
  if (!teamAnswers || Object.keys(teamAnswers).length === 0) {
    return { correct: 0, wrong: 0, noAnswer: teams.length };
  }

  if (!correctAnswer) {
    return { correct: 0, wrong: 0, noAnswer: teams.length };
  }

  let correct = 0;
  let wrong = 0;
  let noAnswer = 0;

  teams.forEach(team => {
    const teamAnswer = teamAnswers[team.id];

    if (!teamAnswer || teamAnswer.trim() === '') {
      noAnswer++;
    } else if (isAnswerCorrect(teamAnswer, correctAnswer, questionType)) {
      correct++;
    } else {
      wrong++;
    }
  });

  return { correct, wrong, noAnswer };
};

/**
 * Find the fastest team that answered correctly
 * Returns the team and their response time in milliseconds
 */
export const getFastestCorrectTeam = (
  teamAnswers: { [teamId: string]: string } | null | undefined,
  teams: Team[],
  correctAnswer: string | null | undefined,
  questionType: string | null,
  teamResponseTimes: { [teamId: string]: number }
): { team: Team; responseTime: number } | null => {
  if (!teamAnswers || Object.keys(teamAnswers).length === 0) {
    return null;
  }

  if (!correctAnswer) {
    return null;
  }

  const correctTeams = teams.filter(team => {
    const teamAnswer = teamAnswers[team.id];
    return teamAnswer && isAnswerCorrect(teamAnswer, correctAnswer, questionType);
  });

  if (correctTeams.length === 0) {
    return null;
  }

  // Find the team with the shortest answer time
  let fastestTeam = correctTeams[0];
  let fastestTime = teamResponseTimes[fastestTeam.id] || Infinity;

  correctTeams.forEach(team => {
    const teamTime = teamResponseTimes[team.id] || Infinity;
    if (teamTime < fastestTime) {
      fastestTime = teamTime;
      fastestTeam = team;
    }
  });

  const fastestTeamResponseTime = teamResponseTimes[fastestTeam.id] || 0;
  return {
    team: fastestTeam,
    responseTime: fastestTeamResponseTime
  };
};
