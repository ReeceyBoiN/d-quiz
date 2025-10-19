import { useEffect, useState, useCallback } from "react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "motion/react";
import { Clock, SkipForward } from "lucide-react";
import { useSettings } from "../utils/SettingsContext";

// Voice-enabled Timer Component
function TimerWithVoice({ timerValue, onSkipTimer }: { timerValue: number; onSkipTimer: () => void }) {
  const { voiceCountdown } = useSettings();
  const [lastSpokenValue, setLastSpokenValue] = useState<number | null>(null);

  // Voice countdown effect
  useEffect(() => {
    // Only speak if voice countdown is enabled
    if (!voiceCountdown) return;
    
    // Only speak at 5-second intervals (30, 25, 20, 15, 10, 5, 0) or "time's up" at 0
    const shouldSpeak = timerValue === 0 || (timerValue > 0 && timerValue % 5 === 0);
    
    if (shouldSpeak && timerValue !== lastSpokenValue) {
      setLastSpokenValue(timerValue);
      
      // Use Web Speech API if available
      if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const text = timerValue === 0 ? "Time's up!" : timerValue.toString();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Configure voice settings for clear, immediate playback
        utterance.rate = 1.0;
        utterance.volume = 1.0;
        utterance.pitch = 1.0;
        
        // Use a clear, neutral voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.includes('Google') || voice.name.includes('Microsoft') || voice.name.includes('Alex'))
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        
        // Speak immediately - no delay
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [timerValue, lastSpokenValue, voiceCountdown]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-8"
    >
      <div className="bg-[#e74c3c] text-white px-6 py-3 rounded-lg">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6" />
          TIMER
        </h2>
      </div>
      <motion.div
        className="text-8xl font-bold text-[#e74c3c]"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        {timerValue}
      </motion.div>
      <Button
        onClick={onSkipTimer}
        className="bg-[#f39c12] hover:bg-[#e67e22] text-white px-6 py-3 text-lg font-bold flex items-center gap-2"
      >
        <SkipForward className="h-5 w-5" />
        SKIP TIMER
      </Button>
    </motion.div>
  );
}

export type QuizStage = 
  | "loading" 
  | "question" 
  | "possibleAnswers" 
  | "timer" 
  | "questionRepeat" 
  | "correctAnswer" 
  | "fastestTeam"
  | "leaderboard-intro"
  | "leaderboard-reveal";

interface PopoutDisplayProps {
  stage: QuizStage;
  onNext: () => void;
  onSkipTimer: () => void;
  questionData?: {
    question: string;
    answers: string[];
    correctAnswer: string;
    fastestTeam?: string;
  };
  timerValue?: number;
  leaderboardData?: {
    team: {
      id: string;
      name: string;
      score: number;
    };
    position: number;
    totalTeams: number;
    isLast: boolean;
    revealedTeamsWithPositions?: {
      id: string;
      name: string;
      score: number;
      actualPosition: number;
    }[];
  };
  revealedTeams?: {
    id: string;
    name: string;
    score: number;
  }[];
}

export function PopoutDisplay({ 
  stage, 
  onNext, 
  onSkipTimer, 
  questionData = {
    question: "What is the capital of France?",
    answers: ["A) London", "B) Berlin", "C) Paris", "D) Madrid"],
    correctAnswer: "C) Paris",
    fastestTeam: "Team Thunder"
  },
  timerValue = 30,
  leaderboardData,
  revealedTeams = []
}: PopoutDisplayProps) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Space" && stage !== "timer") {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [onNext, stage]);

  const LoadingSpinner = () => (
    <motion.div
      className="w-16 h-16 border-4 border-[#3498db] border-t-transparent rounded-full"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  );

  const renderStage = () => {
    switch (stage) {
      case "loading":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-8"
          >
            <LoadingSpinner />
            <h1 className="text-6xl font-bold text-[#ecf0f1]">LOADING</h1>
            <p className="text-xl text-[#95a5a6]">Preparing next question...</p>
          </motion.div>
        );

      case "question":
      case "questionRepeat":
        return (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-8 text-center px-12"
          >
            <div className="bg-[#3498db] text-white px-6 py-3 rounded-lg">
              <h2 className="text-2xl font-bold">QUESTION</h2>
            </div>
            <h1 className="text-5xl font-bold text-[#ecf0f1] leading-tight">
              {questionData.question}
            </h1>
            {stage === "questionRepeat" && (
              <div className="bg-[#f39c12] text-white px-4 py-2 rounded">
                <span className="text-lg font-semibold">REPEAT</span>
              </div>
            )}
          </motion.div>
        );

      case "possibleAnswers":
        return (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-8 text-center px-12"
          >
            <div className="bg-[#27ae60] text-white px-6 py-3 rounded-lg">
              <h2 className="text-2xl font-bold">POSSIBLE ANSWERS</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 w-full max-w-4xl">
              {questionData.answers.map((answer, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className="bg-[#34495e] text-[#ecf0f1] p-6 rounded-lg border-2 border-[#4a5568]"
                >
                  <span className="text-3xl font-bold">{answer}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        );

      case "timer":
        // Timer is now handled by ExternalDisplayWindow overlay, return nothing
        return null;

      case "correctAnswer":
        return (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-8 text-center px-12"
          >
            <div className="bg-[#27ae60] text-white px-6 py-3 rounded-lg">
              <h2 className="text-2xl font-bold">CORRECT ANSWER</h2>
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="bg-[#27ae60] text-white p-8 rounded-lg border-4 border-[#2ecc71]"
            >
              <span className="text-5xl font-bold">{questionData.correctAnswer}</span>
            </motion.div>
          </motion.div>
        );

      case "fastestTeam":
        return (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-8 text-center px-12"
          >
            <div className="bg-[#f39c12] text-white px-6 py-3 rounded-lg">
              <h2 className="text-2xl font-bold">FASTEST TEAM</h2>
            </div>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 150 }}
              className="bg-gradient-to-br from-[#f39c12] to-[#e67e22] text-white p-12 rounded-lg border-4 border-[#f1c40f] shadow-2xl"
            >
              <span className="text-6xl font-bold">{questionData.fastestTeam}</span>
            </motion.div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-2xl text-[#f39c12] font-bold emoji"
            >
              🏅 CONGRATULATIONS! 🏅
            </motion.div>
          </motion.div>
        );

      case "leaderboard-intro":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-8 text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-8xl mb-8"
            >
              🏆
            </motion.div>
            <motion.h1
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-6xl font-bold text-[#f39c12] mb-4"
            >
              AND THE SCORES ARE...
            </motion.h1>
            <motion.p
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-2xl text-[#ecf0f1] opacity-80"
            >
              Get ready for the results!
            </motion.p>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1, type: "spring", stiffness: 200 }}
              className="text-xl text-[#95a5a6] mt-8"
            >
              Host will reveal teams from last place to first...
            </motion.div>
          </motion.div>
        );

      case "leaderboard-reveal":
        // If no leaderboard data yet, show waiting state
        if (!leaderboardData || !leaderboardData.team) {
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center gap-8 text-center h-full"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-8xl mb-8"
              >
                🏆
              </motion.div>
              <motion.h1
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-6xl font-bold text-[#f39c12] mb-4"
              >
                WAITING FOR REVEAL...
              </motion.h1>
              <motion.p
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-2xl text-[#ecf0f1] opacity-80"
              >
                Host will start revealing teams soon!
              </motion.p>
            </motion.div>
          );
        }
        
        const { team, position, totalTeams, isLast, revealedTeamsWithPositions } = leaderboardData;
        
        const getPositionSuffix = (pos: number) => {
          if (pos % 10 === 1 && pos !== 11) return "st";
          if (pos % 10 === 2 && pos !== 12) return "nd";
          if (pos % 10 === 3 && pos !== 13) return "rd";
          return "th";
        };

        // Use the enhanced revealed teams data with actual positions if available,
        // otherwise fall back to calculating from regular revealed teams
        const sortedRevealedTeams = revealedTeamsWithPositions && revealedTeamsWithPositions.length > 0
          ? revealedTeamsWithPositions
              .sort((a, b) => a.actualPosition - b.actualPosition) // Sort by actual position (1st, 2nd, 3rd, etc.)
              .map(team => ({
                ...team,
                position: team.actualPosition // Use the actual position from the host
              }))
          : [...revealedTeams]
              .sort((a, b) => b.score - a.score)
              .map((revealedTeam) => {
                // Fallback: count teams with better scores to get position
                const betterTeams = revealedTeams.filter(t => t.score > revealedTeam.score).length;
                return {
                  ...revealedTeam,
                  position: betterTeams + 1
                };
              });

        return (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 flex flex-col items-center justify-center gap-6 text-center px-8 py-6 max-h-screen overflow-hidden"
            style={{ zIndex: 10 }}
          >
            {/* Header */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="bg-gradient-to-r from-[#f39c12] to-[#e67e22] text-white px-8 py-4 rounded-lg"
            >
              <h1 className="text-4xl font-bold emoji">🏅 LEADERBOARD 🏅</h1>
            </motion.div>

            {/* Current reveal highlight */}
            {team && (
              <motion.div
                initial={{ scale: 0, rotate: -5 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 150 }}
                className="bg-[#e74c3c] text-white px-6 py-3 rounded-lg border-2 border-white"
              >
                <div className="text-lg font-bold emoji">
                  🎯 NOW REVEALING: {team.name} in {position}{getPositionSuffix(position)} place!
                </div>
              </motion.div>
            )}

            {/* Scores Table */}
            {sortedRevealedTeams.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="w-full max-w-4xl"
              >
                <div className="bg-[#1a252f] rounded-lg border-4 border-[#f39c12] overflow-hidden shadow-2xl">
                  {/* Table Header */}
                  <div className="bg-[#f39c12] px-6 py-4 border-b-2 border-[#e67e22]">
                    <div className="grid grid-cols-12 gap-4 text-white text-2xl font-bold">
                      <div className="col-span-2 text-center">Position</div>
                      <div className="col-span-7">Team Name</div>
                      <div className="col-span-3 text-center">Score</div>
                    </div>
                  </div>

                  {/* Table Body */}
                  <div className="max-h-96 overflow-y-auto bg-[#1a252f]">
                    {sortedRevealedTeams.map((revealedTeam, index) => {
                      const isCurrentTeam = team && revealedTeam.id === team.id;
                      return (
                        <motion.div
                          key={revealedTeam.id}
                          initial={{ opacity: 0, x: -50 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.8 + (index * 0.1) }}
                          className={`grid grid-cols-12 gap-4 px-6 py-6 border-b-2 border-[#34495e] transition-all duration-500 ${
                            isCurrentTeam ? 'bg-[#f39c12] border-[#e67e22] text-white shadow-lg' : 'bg-[#1a252f] hover:bg-[#233242] text-white'
                          }`}
                        >
                          {/* Position */}
                          <div className="col-span-2 flex items-center justify-center">
                            {revealedTeam.position === 1 && (
                              <div className="text-4xl emoji">🥇</div>
                            )}
                            {revealedTeam.position === 2 && (
                              <div className="text-4xl emoji">🥈</div>
                            )}
                            {revealedTeam.position === 3 && (
                              <div className="text-4xl emoji">🥉</div>
                            )}
                            {revealedTeam.position > 3 && (
                              <div className={`text-3xl font-bold px-4 py-2 rounded-full border-2 ${
                                isCurrentTeam ? 'text-white border-white' : 'text-[#3498db] border-[#3498db]'
                              }`}>
                                {revealedTeam.position}
                              </div>
                            )}
                          </div>

                          {/* Team Name */}
                          <div className="col-span-7 flex items-center">
                            <span className={`text-3xl font-bold ${
                              isCurrentTeam ? 'text-white' : 'text-white'
                            }`}>
                              {revealedTeam.name}
                            </span>
                            {isCurrentTeam && (
                              <span className="ml-4 text-xl text-white animate-bounce">
                                ← NEW!
                              </span>
                            )}
                          </div>

                          {/* Score */}
                          <div className="col-span-3 flex items-center justify-center">
                            <div className={`text-4xl font-bold ${
                              isCurrentTeam ? 'text-white' : 'text-[#3498db]'
                            }`}>
                              {revealedTeam.score}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Winner celebration */}
            {isLast && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ delay: 1.2, duration: 2, repeat: Infinity }}
                className="text-5xl mt-4 emoji"
              >
                🎉 FINAL RESULTS REVEALED! 🎉
              </motion.div>
            )}

            {/* Confetti effect for winner - moved to back */}
            {isLast && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="fixed inset-0 pointer-events-none z-0"
                style={{ zIndex: 0 }}
              >
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute text-2xl opacity-60"
                    initial={{ 
                      x: "50%", 
                      y: "50%", 
                      scale: 0,
                      rotate: 0 
                    }}
                    animate={{ 
                      x: `${Math.random() * 100}%`, 
                      y: `${Math.random() * 100}%`, 
                      scale: 1,
                      rotate: 360 
                    }}
                    transition={{ 
                      duration: 3, 
                      delay: Math.random() * 1,
                      ease: "easeOut"
                    }}
                  >
                    {['🎉', '🎊', '🏅', '⭐', '🌟'][Math.floor(Math.random() * 5)]}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Special confetti celebration for first place winner */}
            {position === 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="fixed inset-0 pointer-events-none"
                style={{ zIndex: 0 }}
              >
                {/* Confetti falling from top */}
                {[...Array(100)].map((_, i) => {
                  const delay = Math.random() * 2;
                  const startX = Math.random() * 100;
                  const color = ['#f39c12', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f1c40f'][Math.floor(Math.random() * 6)];
                  const shape = ['🎊', '🎉', '⭐', '🌟', '💫', '✨'][Math.floor(Math.random() * 6)];
                  
                  return (
                    <motion.div
                      key={`confetti-${i}`}
                      className="absolute text-2xl emoji"
                      style={{
                        left: `${startX}%`,
                        top: '-5%',
                        color: color
                      }}
                      initial={{ 
                        y: 0,
                        x: 0,
                        scale: 0,
                        rotate: 0,
                        opacity: 1 
                      }}
                      animate={{ 
                        y: window.innerHeight + 100,
                        x: (Math.random() - 0.5) * 200, // Slight horizontal drift
                        scale: [0, 1, 1, 0.8],
                        rotate: Math.random() * 720, // Random rotation
                        opacity: [0, 1, 1, 0] 
                      }}
                      transition={{ 
                        duration: 4 + Math.random() * 2, // Varying fall speeds
                        delay: delay,
                        ease: "easeIn",
                        repeat: Infinity,
                        repeatDelay: Math.random() * 3
                      }}
                    >
                      {shape}
                    </motion.div>
                  );
                })}
                
                {/* Side confetti cannons */}
                {[...Array(40)].map((_, i) => {
                  const isLeft = i < 20;
                  const delay = Math.random() * 1;
                  const color = ['#f39c12', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f1c40f'][Math.floor(Math.random() * 6)];
                  
                  return (
                    <motion.div
                      key={`side-confetti-${i}`}
                      className="absolute w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: color,
                        left: isLeft ? '5%' : '95%',
                        top: '70%',
                      }}
                      initial={{ 
                        x: 0,
                        y: 0,
                        scale: 0,
                        opacity: 1 
                      }}
                      animate={{ 
                        x: isLeft ? Math.random() * 400 + 200 : -(Math.random() * 400 + 200),
                        y: -(Math.random() * 300 + 100),
                        scale: [0, 1, 0],
                        opacity: [1, 1, 0] 
                      }}
                      transition={{ 
                        duration: 3, 
                        delay: delay,
                        ease: "easeOut",
                        repeat: Infinity,
                        repeatDelay: Math.random() * 2
                      }}
                    />
                  );
                })}
                
                {/* Golden sparkles */}
                {[...Array(50)].map((_, i) => (
                  <motion.div
                    key={`gold-sparkle-${i}`}
                    className="absolute text-4xl emoji"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      color: '#f1c40f'
                    }}
                    initial={{ 
                      scale: 0,
                      rotate: 0,
                      opacity: 0 
                    }}
                    animate={{ 
                      scale: [0, 1.5, 0],
                      rotate: [0, 180, 360],
                      opacity: [0, 1, 0] 
                    }}
                    transition={{ 
                      duration: 2, 
                      delay: Math.random() * 3,
                      ease: "easeInOut",
                      repeat: Infinity,
                      repeatDelay: Math.random() * 4
                    }}
                  >
                    ⭐
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen bg-[#1a252f] flex items-center justify-center overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full flex items-center justify-center relative z-10"
          style={{ backgroundColor: '#1a252f' }}
        >
          {renderStage()}
        </motion.div>
      </AnimatePresence>
      
      {/* Stage indicator for host */}
      <div className="absolute bottom-4 left-4 bg-[#34495e] text-[#ecf0f1] px-4 py-2 rounded-lg opacity-75">
        <div className="text-sm font-bold">
          External Display: {stage.toUpperCase().replace('-', ' ')}
        </div>
        {stage !== "timer" && !stage.startsWith("leaderboard") && (
          <div className="text-xs text-[#95a5a6] mt-1">
            Press SPACEBAR to continue
          </div>
        )}
        {stage.startsWith("leaderboard") && (
          <div className="text-xs text-[#95a5a6] mt-1">
            Controlled from LEADER BOARD tab
          </div>
        )}
      </div>
    </div>
  );
}