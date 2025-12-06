import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

interface LettersInterfaceProps {
  onSubmit: (answer: string | string[]) => void;
  disabled?: boolean;
  questionShown?: boolean;
  maxAnswers?: number;
}

export function LettersInterface({
  onSubmit,
  disabled = false,
  questionShown = false,
  maxAnswers = 1,
}: LettersInterfaceProps) {
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showClearFeedback, setShowClearFeedback] = useState(false);

  useEffect(() => {
    setSelectedLetters([]);
    setSubmitted(false);
    setShowClearFeedback(false);
  }, [maxAnswers, disabled, questionShown]);

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const handleLetterClick = (letter: string) => {
    if (submitted || !questionShown || disabled) return;

    // If already selected, deselect it
    if (selectedLetters.includes(letter)) {
      setSelectedLetters(selectedLetters.filter(l => l !== letter));
      return;
    }

    // If maxAnswers reached, don't allow more
    if (selectedLetters.length >= maxAnswers) return;

    const newSelection = [...selectedLetters, letter];
    setSelectedLetters(newSelection);

    // Auto-submit if maxAnswers is 1
    if (maxAnswers === 1) {
      setSubmitted(true);
      onSubmit(letter);
    }
  };

  const handleSubmit = () => {
    if (submitted || selectedLetters.length === 0 || !questionShown) return;

    setSubmitted(true);
    onSubmit(maxAnswers === 1 ? selectedLetters[0] : selectedLetters);
  };

  const handleClear = () => {
    if (submitted) return;
    setSelectedLetters([]);
    setShowClearFeedback(true);
    setTimeout(() => setShowClearFeedback(false), 500);
  };

  // Arrange letters in a grid (5 rows of 5 + 1 extra)
  const rows = [];
  for (let i = 0; i < letters.length; i += 5) {
    rows.push(letters.slice(i, i + 5));
  }

  const isLetterSelected = (letter: string) => selectedLetters.includes(letter);
  const isLetterDisabled = (letter: string) =>
    !questionShown || submitted || disabled || (!isLetterSelected(letter) && selectedLetters.length >= maxAnswers);

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-slate-400 text-sm mb-4 min-h-[20px]">
        {showClearFeedback && 'Selections cleared ✓'}
        {!showClearFeedback && !questionShown && 'Waiting for question...'}
        {!showClearFeedback && questionShown && submitted && 'Answer submitted!'}
        {!showClearFeedback && questionShown && !submitted && maxAnswers === 1 && 'Select a letter'}
        {!showClearFeedback && questionShown && !submitted && maxAnswers > 1 && `Select up to ${maxAnswers} letters (${selectedLetters.length}/${maxAnswers})`}
      </p>

      <div className="grid gap-2">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2 justify-center">
            {row.map((letter) => (
              <button
                key={letter}
                onClick={() => handleLetterClick(letter)}
                disabled={isLetterDisabled(letter)}
                className={`w-12 h-12 rounded-lg font-bold text-lg transition-all transform ${
                  !questionShown
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                    : isLetterSelected(letter)
                    ? 'bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/50 ring-2 ring-blue-400'
                    : selectedLetters.length >= maxAnswers
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                    : submitted
                    ? 'bg-slate-600 text-slate-300 opacity-50'
                    : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
      </div>

      {maxAnswers > 1 && (
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={handleClear}
            disabled={submitted || selectedLetters.length === 0 || !questionShown || disabled}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
              !questionShown || submitted || selectedLetters.length === 0 || disabled
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            <X className="w-4 h-4" />
            Clear
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitted || selectedLetters.length === 0 || !questionShown || disabled}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all transform ${
              submitted
                ? 'bg-green-500 text-white'
                : selectedLetters.length === 0 || !questionShown || disabled
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
            }`}
          >
            {submitted ? '✓ Submitted' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  );
}
