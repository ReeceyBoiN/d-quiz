import { useState, useRef } from 'react';
import { Button } from '../ui/button';

interface PinEntryScreenProps {
  teamName: string;
  welcomeMessage: string;
  onSubmit: (pin: string) => void;
  error?: string;
  accepted?: boolean;
}

export function PinEntryScreen({ teamName, welcomeMessage, onSubmit, error, accepted }: PinEntryScreenProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    // Auto-advance to next input
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = digits.join('');
    if (pin.length === 4) {
      onSubmit(pin);
    }
  };

  const pinComplete = digits.every(d => d !== '');

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome</h1>
          <p className="text-blue-400 text-lg font-medium">{teamName}</p>
        </div>

        {welcomeMessage && (
          <div className="bg-slate-700/50 rounded-lg p-4 mb-6 text-center">
            <p className="text-slate-200 text-sm whitespace-pre-wrap">{welcomeMessage}</p>
          </div>
        )}

        {accepted ? (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-green-600/50">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-green-600/20 border-2 border-green-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-400 font-medium text-lg">PIN Accepted</p>
              <p className="text-slate-400 text-sm">Waiting for the host to let you in...</p>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-600 border-t-blue-400"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <p className="text-white text-center font-medium mb-4">
              Enter the 4-digit PIN to join
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex justify-center gap-3">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    autoFocus={i === 0}
                    className="w-14 h-16 text-center text-2xl font-bold bg-slate-700 border-2 border-slate-600 rounded-lg text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 outline-none transition-colors"
                  />
                ))}
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <Button
                type="submit"
                disabled={!pinComplete}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
              >
                Submit PIN
              </Button>
            </form>

            <p className="text-slate-500 text-xs text-center mt-4">
              Ask the quiz host for the PIN code
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
