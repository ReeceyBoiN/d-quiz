import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHostTerminalAPI } from './useHostTerminalAPI';

interface QuestionTypeSelectorProps {
  deviceId: string;
  playerId: string;
  teamName: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
  isOnTheSpotMode: boolean;
  flowState?: {
    flow: string;
    isQuestionMode: boolean;
    isQuizPackMode?: boolean;
  } | null;
}

interface QuestionTypeConfig {
  id: 'letters' | 'numbers' | 'multiple-choice';
  label: string;
  description: string;
  emoji: string;
  example: string;
}

const QUESTION_TYPES: QuestionTypeConfig[] = [
  {
    id: 'letters',
    label: 'Letters',
    description: 'A-F options',
    emoji: '🔤',
    example: 'Answer: A, B, C, D, E, or F'
  },
  {
    id: 'numbers',
    label: 'Numbers',
    description: '0-9 digits',
    emoji: '🔢',
    example: 'Answer: Any number (0-9, multiple digits)'
  },
  {
    id: 'multiple-choice',
    label: 'Multiple Choice',
    description: 'A/B/C/D options',
    emoji: '📋',
    example: 'Answer: A, B, C, or D'
  }
];

export function QuestionTypeSelector({
  deviceId,
  playerId,
  teamName,
  wsRef,
  isOnTheSpotMode,
  flowState,
}: QuestionTypeSelectorProps) {
  const [selectedTypeIndex, setSelectedTypeIndex] = useState<number>(0);
  const { sendAdminCommand } = useHostTerminalAPI({
    deviceId,
    playerId,
    teamName,
    wsRef,
  });

  // Only show this component in on-the-spot mode when in idle state
  const shouldShow = isOnTheSpotMode && flowState?.flow === 'idle' && flowState?.isQuestionMode;

  if (!shouldShow) {
    return null;
  }

  const handleSelectType = (typeId: 'letters' | 'numbers' | 'multiple-choice') => {
    console.log('[QuestionTypeSelector] Selecting question type:', typeId);
    sendAdminCommand('select-question-type', { type: typeId });
  };

  const handlePrevious = () => {
    setSelectedTypeIndex((prev) => (prev > 0 ? prev - 1 : QUESTION_TYPES.length - 1));
  };

  const handleNext = () => {
    setSelectedTypeIndex((prev) => (prev < QUESTION_TYPES.length - 1 ? prev + 1 : 0));
  };

  const selectedType = QUESTION_TYPES[selectedTypeIndex];

  console.log('[QuestionTypeSelector] Rendering with mode:', { isOnTheSpotMode, flowState });

  return (
    <div className="flex flex-col h-full p-6 bg-gradient-to-b from-slate-800 to-slate-900 overflow-auto">
      <h2 className="text-xl font-bold text-white mb-6">On-The-Spot Question Type</h2>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Question Type Preview */}
        <div className="w-full max-w-md mb-8 p-6 bg-slate-700 rounded-lg border-2 border-blue-500">
          <div className="text-center mb-6">
            <div className="text-6xl mb-3">{selectedType.emoji}</div>
            <h3 className="text-2xl font-bold text-white">{selectedType.label}</h3>
            <p className="text-slate-300 text-sm mt-2">{selectedType.description}</p>
          </div>

          <div className="bg-slate-600 rounded p-3 mb-4">
            <p className="text-slate-200 text-sm text-center">{selectedType.example}</p>
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handlePrevious}
              className="p-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white transition-colors"
              title="Previous question type"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="flex-1 text-center">
              <p className="text-slate-300 text-sm">
                {selectedTypeIndex + 1} of {QUESTION_TYPES.length}
              </p>
            </div>

            <button
              onClick={handleNext}
              className="p-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white transition-colors"
              title="Next question type"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Quick Selection Buttons */}
        <div className="w-full max-w-md space-y-3 mb-6">
          {QUESTION_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => handleSelectType(type.id)}
              className={`w-full px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-between ${
                selectedType.id === type.id
                  ? 'bg-blue-600 border-2 border-blue-400 text-white'
                  : 'bg-slate-700 border-2 border-transparent hover:border-slate-600 text-slate-300 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-2xl">{type.emoji}</span>
                <span>{type.label}</span>
              </span>
              <span className="text-sm">{type.description}</span>
            </button>
          ))}
        </div>

        {/* Confirm Selection Button */}
        <button
          onClick={() => handleSelectType(selectedType.id)}
          className="w-full max-w-md px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-lg transition-all active:scale-95"
        >
          <span className="text-2xl mr-2">✅</span>
          Confirm & Start
        </button>
      </div>

      <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
        <p className="text-slate-300 text-sm">
          <span className="font-semibold">ℹ️ Next Step:</span> Select a question type above and confirm. Teams will see the answer options on their keypads.
        </p>
      </div>
    </div>
  );
}
