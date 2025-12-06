import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

interface NumbersInterfaceProps {
  onSubmit: (answer: string | string[]) => void;
  disabled?: boolean;
  questionShown?: boolean;
  maxAnswers?: number;
}

export function NumbersInterface({
  onSubmit,
  disabled = false,
  questionShown = false,
  maxAnswers = 1,
}: NumbersInterfaceProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [showClearFeedback, setShowClearFeedback] = useState(false);

  useEffect(() => {
    setSelectedNumbers([]);
    setSubmitted(false);
    setInputValue('');
    setShowClearFeedback(false);
  }, [maxAnswers, disabled, questionShown]);

  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  const handleNumberClick = (num: string) => {
    if (!questionShown || disabled || submitted) return;

    const newValue = inputValue + num;
    setInputValue(newValue);
  };

  const handleAddNumber = () => {
    if (!inputValue || submitted || !questionShown || disabled) return;

    // If maxAnswers reached, don't allow more
    if (selectedNumbers.length >= maxAnswers) return;

    const newSelection = [...selectedNumbers, inputValue];
    setSelectedNumbers(newSelection);
    setInputValue('');

    // Auto-submit if maxAnswers is 1
    if (maxAnswers === 1) {
      setSubmitted(true);
      onSubmit(inputValue);
    }
  };

  const handleRemoveNumber = (index: number) => {
    if (submitted) return;
    setSelectedNumbers(selectedNumbers.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!inputValue && selectedNumbers.length === 0) return;

    if (inputValue && !submitted && !questionShown) return;

    setSubmitted(true);
    const finalAnswers =
      inputValue && selectedNumbers.length < maxAnswers
        ? [...selectedNumbers, inputValue]
        : selectedNumbers.length > 0
        ? selectedNumbers
        : inputValue;

    onSubmit(maxAnswers === 1 ? (Array.isArray(finalAnswers) ? finalAnswers[0] : finalAnswers) : finalAnswers);
  };

  const handleClear = () => {
    if (submitted) return;
    setSelectedNumbers([]);
    setInputValue('');
    setShowClearFeedback(true);
    setTimeout(() => setShowClearFeedback(false), 500);
  };

  const displayValue =
    selectedNumbers.length === 0 && inputValue === ''
      ? '0'
      : selectedNumbers.length > 0
      ? selectedNumbers.join(', ')
      : inputValue || '0';

  const hasSelection = selectedNumbers.length > 0 || inputValue !== '';

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 w-full">
      <p className="text-slate-400 text-sm min-h-[20px]">
        {showClearFeedback && 'Cleared ✓'}
        {!showClearFeedback && !questionShown && 'Waiting for question...'}
        {!showClearFeedback && questionShown && submitted && 'Answer submitted!'}
        {!showClearFeedback && questionShown && !submitted && maxAnswers === 1 && 'Enter your answer'}
        {!showClearFeedback && questionShown && !submitted && maxAnswers > 1 && `Enter up to ${maxAnswers} answers (${selectedNumbers.length}/${maxAnswers})`}
      </p>

      <div className="w-full max-w-xs">
        <div
          className={`text-center text-2xl font-bold rounded-lg p-4 mb-4 transition-colors ${
            !questionShown
              ? 'bg-slate-600 text-slate-400'
              : 'bg-slate-700 text-white'
          }`}
        >
          {displayValue}
        </div>
      </div>

      <div className="grid gap-2">
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['0'],
        ].map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2 justify-center">
            {row.map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                disabled={submitted || !questionShown || disabled}
                className={`w-16 h-16 rounded-lg font-bold text-xl transition-all transform ${
                  !questionShown
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                    : submitted
                    ? 'bg-slate-600 text-slate-300 opacity-50'
                    : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Selected numbers display for multi-answer mode */}
      {maxAnswers > 1 && selectedNumbers.length > 0 && (
        <div className="w-full max-w-xs bg-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-2">Selected answers:</p>
          <div className="flex flex-wrap gap-2">
            {selectedNumbers.map((num, index) => (
              <div
                key={index}
                className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                {num}
                {!submitted && (
                  <button
                    onClick={() => handleRemoveNumber(index)}
                    className="ml-1 hover:text-red-300"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 w-full max-w-xs">
        {inputValue && selectedNumbers.length < maxAnswers && (
          <button
            onClick={handleAddNumber}
            disabled={!inputValue || submitted || !questionShown || disabled || selectedNumbers.length >= maxAnswers}
            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
              !inputValue || submitted || !questionShown || disabled || selectedNumbers.length >= maxAnswers
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            Add
          </button>
        )}

        <button
          onClick={handleClear}
          disabled={submitted || !hasSelection || !questionShown || disabled}
          className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
            !questionShown || submitted || !hasSelection || disabled
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
              : 'bg-slate-700 hover:bg-slate-600 text-white'
          }`}
        >
          <X className="w-4 h-4" />
          Clear
        </button>

        <button
          onClick={handleSubmit}
          disabled={(!inputValue && selectedNumbers.length === 0) || submitted || !questionShown || disabled}
          className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all transform ${
            submitted
              ? 'bg-green-500 text-white'
              : (!inputValue && selectedNumbers.length === 0) || !questionShown || disabled
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
              : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
          }`}
        >
          {submitted ? '✓ Submitted' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
