export type QuestionFlowState =
  | 'idle'           // no question active; waiting for setup
  | 'ready'          // question loaded; nothing sent yet
  | 'sent-picture'   // picture broadcasted to external/players
  | 'sent-question'  // text/options broadcasted
  | 'running'        // timer counting down
  | 'timeup'         // timer hit zero; lock submissions; wait to reveal
  | 'revealed'       // answer revealed
  | 'fastest'        // fastest team overlay/page shown
  | 'complete';      // no more questions; ready to end round

export interface HostFlow {
  isQuestionMode: boolean;      // true for question-based modes; false for wheel/bingo
  flow: QuestionFlowState;
  totalTime: number;            // seconds (from settings/type)
  timeRemaining: number;        // seconds, counts down
  currentQuestionIndex: number;
  currentQuestion: any;         // from quizLoader normalized shape
  pictureSent: boolean;
  questionSent: boolean;
  answerSubmitted?: string;     // Type 2: on-the-spot host's answer
  selectedQuestionType?: 'letters' | 'numbers' | 'multiple-choice'; // On-the-spot question type
}

export const initialFlow: HostFlow = {
  isQuestionMode: false,
  flow: 'idle',
  totalTime: 30,
  timeRemaining: 30,
  currentQuestionIndex: 0,
  currentQuestion: null,
  pictureSent: false,
  questionSent: false,
  answerSubmitted: undefined,
};

/**
 * Reset flow state for a new question.
 * Called when loading a new question or starting a new round.
 */
export function resetFlowForNewQuestion(
  question: any,
  totalTime: number
): HostFlow {
  return {
    isQuestionMode: true,
    flow: 'ready',
    totalTime,
    timeRemaining: totalTime,
    currentQuestionIndex: 0, // Update this in the parent component
    currentQuestion: question,
    pictureSent: false,
    questionSent: false,
    answerSubmitted: undefined,
  };
}

/**
 * Determine total time for a question based on its type and settings.
 * (Settings fallback to 30s if not available)
 */
export function getTotalTimeForQuestion(
  question: any,
  gameModeTimers?: { keypad?: number; buzzin?: number; nearestwins?: number }
): number {
  if (!question) return 30;

  const timers = gameModeTimers || { keypad: 30, buzzin: 30, nearestwins: 10 };

  const qType = (question.type || '').toLowerCase();

  switch (qType) {
    case 'nearest':
    case 'numbers':
      return timers.nearestwins ?? 30;
    case 'buzzin':
      return timers.buzzin ?? 30;
    case 'letters':
    case 'multi':
    case 'sequence':
    default:
      return timers.keypad ?? 30;
  }
}

/**
 * Determine if question has a picture.
 */
export function hasQuestionImage(question: any): boolean {
  return !!(question?.imageDataUrl);
}

/**
 * Get the question type label for display.
 */
export function getQuestionTypeLabel(type: string): string {
  if (!type) return 'Question';
  const t = type.toLowerCase();
  switch (t) {
    case 'letters':
      return 'Letters';
    case 'multi':
      return 'Multiple Choice';
    case 'numbers':
    case 'nearest':
      return 'Numbers';
    case 'sequence':
      return 'Sequence';
    case 'buzzin':
      return 'Buzz In';
    default:
      return type;
  }
}
