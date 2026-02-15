import { useState, useEffect, useRef, useContext } from 'react';
import { Button } from '../ui/button';
import { NetworkContext } from '../context/NetworkContext';
import { usePlayerSettings } from '../hooks/usePlayerSettings';

interface BuzzerSelectionModalProps {
  isOpen: boolean;
  selectedBuzzers?: Record<string, string>; // deviceId -> buzzerSound mapping
  onConfirm: (buzzerSound: string) => void;
  onCancel?: () => void;
}

export function BuzzerSelectionModal({
  isOpen,
  selectedBuzzers = {},
  onConfirm,
  onCancel
}: BuzzerSelectionModalProps) {
  const [buzzers, setBuzzers] = useState<string[]>([]);
  const [selectedBuzzer, setSelectedBuzzer] = useState<string | null>(null);
  const [playingBuzzer, setPlayingBuzzer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const networkContext = useContext(NetworkContext);
  const { settings } = usePlayerSettings();

  // Helper function to remove file extension from buzzer name for display
  const getDisplayName = (buzzerName: string): string => {
    return buzzerName.replace(/\.[^/.]+$/, ''); // Remove file extension
  };

  // Load buzzer list from API
  useEffect(() => {
    if (!isOpen) return;

    const loadBuzzers = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get host info to construct correct API URL
        const hostInfoResponse = await fetch('/api/host-info');
        const hostInfo = await hostInfoResponse.json();
        const apiUrl = `http://${hostInfo.localIP}:${hostInfo.port}/api/buzzers/list`;

        console.log('[BuzzerSelectionModal] Loading buzzers from:', apiUrl);

        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Failed to load buzzers: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[BuzzerSelectionModal] Loaded buzzers:', data.buzzers);

        setBuzzers(data.buzzers || []);

        // If current selection exists and is still available, pre-select it
        if (settings.buzzerSound && data.buzzers.includes(settings.buzzerSound)) {
          setSelectedBuzzer(settings.buzzerSound);
        } else {
          // Clear selection if buzzer no longer available (e.g., folder changed)
          setSelectedBuzzer(null);
        }
      } catch (err) {
        console.error('[BuzzerSelectionModal] Error loading buzzers:', err);
        setError(err instanceof Error ? err.message : 'Failed to load buzzers');
        setBuzzers([]);
      } finally {
        setLoading(false);
      }
    };

    loadBuzzers();
  }, [isOpen, settings.buzzerSound]);

  // Play buzzer preview
  const handlePlayBuzzer = async (buzzerName: string) => {
    try {
      setPlayingBuzzer(buzzerName);

      // Get host info to construct correct API URL
      const hostInfoResponse = await fetch('/api/host-info');
      const hostInfo = await hostInfoResponse.json();
      const audioUrl = `http://${hostInfo.localIP}:${hostInfo.port}/api/buzzers/${buzzerName}`;

      console.log('[BuzzerSelectionModal] Playing buzzer from:', audioUrl);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
      }
    } catch (err) {
      console.error('[BuzzerSelectionModal] Error playing buzzer:', err);
      setPlayingBuzzer(null);
    }
  };

  // Handle buzzer selection
  const handleSelectBuzzer = (buzzerName: string) => {
    setSelectedBuzzer(buzzerName);
    setShowConfirmation(true);
  };

  // Handle confirmation
  const handleConfirmBuzzer = () => {
    if (selectedBuzzer) {
      console.log('[BuzzerSelectionModal] Confirmed buzzer selection:', selectedBuzzer);
      onConfirm(selectedBuzzer);
      setShowConfirmation(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowConfirmation(false);
    // Don't reset selection, allow user to try again
  };

  // Check if buzzer is selected by another team
  const isBuzzerTaken = (buzzerName: string): boolean => {
    return Object.values(selectedBuzzers).includes(buzzerName);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="px-6 py-6 border-b border-slate-700">
          <h2 className="text-3xl font-bold text-white mb-2">🔊 Select Your Buzzer</h2>
          <p className="text-slate-300">
            Choose a buzzer sound that will play when you answer
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
              </div>
              <p className="text-slate-300 mt-4">Loading buzzers...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900 bg-opacity-30 border border-red-500 rounded-lg p-4 mb-4">
              <p className="text-red-400">⚠️ Error: {error}</p>
            </div>
          )}

          {!loading && buzzers.length === 0 && !error && (
            <div className="text-center py-8">
              <p className="text-slate-400 text-lg">No buzzers available yet</p>
              <p className="text-slate-500 text-sm mt-2">
                The host will add buzzers soon
              </p>
            </div>
          )}

          {!loading && buzzers.length > 0 && (
            <div className="space-y-3">
              {buzzers.map((buzzer) => {
                const isTaken = isBuzzerTaken(buzzer);
                const isSelected = selectedBuzzer === buzzer;

                return (
                  <div
                    key={buzzer}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isTaken
                        ? 'border-slate-600 bg-slate-700 opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'border-cyan-400 bg-slate-700'
                        : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-white font-semibold">{getDisplayName(buzzer)}</p>
                        {isTaken && (
                          <p className="text-slate-400 text-sm">
                            Already selected by another team
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePlayBuzzer(buzzer)}
                          disabled={isTaken || playingBuzzer === buzzer}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                            isTaken
                              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                              : playingBuzzer === buzzer
                              ? 'bg-cyan-500 text-white'
                              : 'bg-slate-600 hover:bg-slate-500 text-white'
                          }`}
                        >
                          {playingBuzzer === buzzer ? (
                            <>
                              <span>⏸</span>
                              <span className="hidden sm:inline">Playing</span>
                            </>
                          ) : (
                            <>
                              <span>▶</span>
                              <span className="hidden sm:inline">Preview</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleSelectBuzzer(buzzer)}
                          disabled={isTaken}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            isTaken
                              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                              : isSelected
                              ? 'bg-cyan-500 text-white'
                              : 'bg-slate-600 hover:bg-slate-500 text-white'
                          }`}
                        >
                          {isSelected ? '✓ Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmation && selectedBuzzer && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-60">
            <div className="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl border-2 border-cyan-500">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">🔊</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Confirm Your Selection
                </h3>
                <p className="text-slate-300">
                  You selected: <span className="text-cyan-400 font-semibold">{getDisplayName(selectedBuzzer)}</span>
                </p>
              </div>

              <div className="bg-slate-700 rounded-lg p-4 mb-6">
                <button
                  onClick={() => handlePlayBuzzer(selectedBuzzer)}
                  disabled={playingBuzzer === selectedBuzzer}
                  className={`w-full px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                    playingBuzzer === selectedBuzzer
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-white'
                  }`}
                >
                  {playingBuzzer === selectedBuzzer ? (
                    <>
                      <span>⏸</span>
                      <span>Playing Preview...</span>
                    </>
                  ) : (
                    <>
                      <span>▶</span>
                      <span>Preview Buzzer</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Change
                </button>
                <button
                  onClick={handleConfirmBuzzer}
                  className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!showConfirmation && buzzers.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-700 bg-slate-700 flex gap-3">
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => selectedBuzzer && handleSelectBuzzer(selectedBuzzer)}
              disabled={!selectedBuzzer}
              className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              Select Buzzer
            </button>
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingBuzzer(null)}
        className="hidden"
      />
    </div>
  );
}
