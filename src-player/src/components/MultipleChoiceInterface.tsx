import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface MultipleChoiceInterfaceProps {
  options: string[];
  onSubmit: (answerIndex: number | number[], answer: string | string[]) => void;
  disabled?: boolean;
  questionShown?: boolean;
  maxAnswers?: number;
  revealed?: boolean;
  correctIndex?: number;
  playerSelectedIndex?: number | null;
}

export function MultipleChoiceInterface({
  options,
  onSubmit,
  disabled = false,
  questionShown = false,
  maxAnswers = 1,
  revealed = false,
  correctIndex,
  playerSelectedIndex = null,
}: MultipleChoiceInterfaceProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showClearFeedback, setShowClearFeedback] = useState(false);

  useEffect(() => {
    setSelectedIndices([]);
    setSubmitted(false);
    setShowClearFeedback(false);
  }, [options]);

  const handleSelectOption = (index: number) => {
    if (submitted || !questionShown || disabled) return;

    // If already selected, deselect it
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
      return;
    }

    // If maxAnswers reached, don't allow more
    if (selectedIndices.length >= maxAnswers) return;

    const newSelection = [...selectedIndices, index];
    setSelectedIndices(newSelection);

    // Auto-submit if maxAnswers is 1
    if (maxAnswers === 1) {
      setSubmitted(true);
      onSubmit(index, options[index]);
    }
  };

  const handleSubmit = () => {
    if (submitted || selectedIndices.length === 0 || !questionShown) return;

    setSubmitted(true);

    if (maxAnswers === 1) {
      onSubmit(selectedIndices[0], options[selectedIndices[0]]);
    } else {
      const answers = selectedIndices.map(i => options[i]);
      onSubmit(selectedIndices, answers);
    }
  };

  const handleClear = () => {
    if (submitted) return;
    setSelectedIndices([]);
    setShowClearFeedback(true);
    setTimeout(() => setShowClearFeedback(false), 500);
  };

  // Generate letter labels (A, B, C, D, etc.) based on number of options
  const getOptionLabel = (index: number): string => {
    return String.fromCharCode(65 + index); // 65 is 'A'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 w-full">
      <p className="text-slate-400 text-sm min-h-[20px]">
        {showClearFeedback && 'Selections cleared ✓'}
        {!showClearFeedback && !questionShown && 'Waiting for question...'}
        {!showClearFeedback && questionShown && submitted && 'Answer submitted!'}
        {!showClearFeedback && questionShown && !submitted && maxAnswers === 1 && `Select an answer (${options.length} options)`}
        {!showClearFeedback && questionShown && !submitted && maxAnswers > 1 && `Select up to ${maxAnswers} answers (${selectedIndices.length}/${maxAnswers})`}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
        {options.map((option, index) => {
          const isSelected = selectedIndices.includes(index);
          const isDisabled =
            !questionShown || submitted || disabled || (!isSelected && selectedIndices.length >= maxAnswers);

          return (
            <button
              key={index}
              onClick={() => handleSelectOption(index)}
              disabled={isDisabled || revealed}
              className={`p-4 rounded-lg font-semibold text-lg transition-all transform flex items-center gap-3 ${
                revealed && index === correctIndex
                  ? 'reveal-correct'
                  : revealed && index === playerSelectedIndex && playerSelectedIndex !== correctIndex
                  ? 'reveal-wrong'
                  : !questionShown
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                  : isSelected
                  ? 'bg-blue-500 text-white scale-105 shadow-lg shadow-blue-500/50 ring-2 ring-blue-400'
                  : selectedIndices.length >= maxAnswers
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                  : submitted
                  ? 'bg-slate-600 text-slate-300 opacity-50'
                  : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
              }`}
            >
              <span className="text-xl font-bold min-w-[2rem]">
                {getOptionLabel(index)}.
              </span>
              <span className="flex-1 text-left">
                {questionShown ? (
                  option
                ) : (
                  <span className="inline-block h-4 w-24 rounded bg-slate-700 animate-pulse" aria-hidden="true" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {maxAnswers > 1 && (
        <div className="flex gap-3 w-full max-w-2xl px-4">
          <button
            onClick={handleClear}
            disabled={submitted || selectedIndices.length === 0 || !questionShown || disabled}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
              !questionShown || submitted || selectedIndices.length === 0 || disabled
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            <X className="w-4 h-4" />
            Clear
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitted || selectedIndices.length === 0 || !questionShown || disabled}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all transform ${
              submitted
                ? 'bg-green-500 text-white'
                : selectedIndices.length === 0 || !questionShown || disabled
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
