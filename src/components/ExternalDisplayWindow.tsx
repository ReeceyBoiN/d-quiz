import { useEffect, useState } from "react";
import { PopoutDisplay, type QuizStage } from "./PopoutDisplay";
import { ImageSlideshow } from "./ImageSlideshow";
import { ScoresDisplay } from "./ScoresDisplay";
import { BasicDisplay } from "./BasicDisplay";
import { Zap, Trophy, Sparkles, Crown } from "lucide-react";
// CountdownTimer not used in external display - using simple timer instead
import { StoredImage } from "../utils/projectImageStorage";
import { useSettings } from "../utils/SettingsContext";

// FAST TRACK Display Component - The most amazing display ever!
function FastTrackDisplay({ teamName, questionNumber }: { teamName: string; questionNumber: number }) {
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);
  
  // Ultra-vibrant rainbow colors for background
  const rainbowColors = [
    '#FF00FF',    // Magenta
    '#00FFFF',    // Cyan
    '#FFFF00',    // Yellow
    '#FF0000',    // Red
    '#00FF00',    // Lime
    '#0000FF',    // Blue
    '#FF00FF',    // Magenta (loop)
  ];
  
  // Background color cycling - super fast!
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentColorIndex((prev) => (prev + 1) % rainbowColors.length);
    }, 500); // Change color every 500ms for intense effect
    
    return () => clearInterval(interval);
  }, []);
  
  // Pulsing scale animation for team name
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseScale(prev => prev === 1 ? 1.1 : 1);
    }, 300);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div 
      className="fixed top-0 left-0 w-full h-full flex flex-col p-8 transition-colors duration-500"
      style={{ 
        zIndex: 99999,
        position: 'fixed',
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: '2rem',
        backgroundColor: rainbowColors[currentColorIndex],
      }}
    >
      {/* Animated star/sparkle background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-ping"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random() * 2}s`,
            }}
          >
            <Sparkles className="h-8 w-8 text-white opacity-70" />
          </div>
        ))}
      </div>
      
      {/* Rotating lightning bolts */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-spin"
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          >
            <Zap className="h-16 w-16 text-yellow-300 opacity-60" fill="currentColor" />
          </div>
        ))}
      </div>
      
      {/* Header with FAST TRACK title */}
      <div className="relative text-center mb-8 animate-bounce">
        <h1 
          className="text-8xl font-bold text-white drop-shadow-2xl"
          style={{
            textShadow: '0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.6), 0 0 60px rgba(255,255,255,0.4)',
            WebkitTextStroke: '3px black',
          }}
        >
          ⚡ FAST TRACK ⚡
        </h1>
        <div className="text-3xl text-white font-bold mt-4" style={{ textShadow: '0 0 10px rgba(0,0,0,0.8)' }}>
          Question {questionNumber}
        </div>
      </div>

      {/* Main content area with team name */}
      <div className="flex-1 flex flex-col justify-center items-center relative">
        {/* Floating crowns */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Crown className="h-32 w-32 text-yellow-300 absolute animate-bounce" style={{ left: '10%', animationDelay: '0s' }} />
          <Crown className="h-32 w-32 text-yellow-300 absolute animate-bounce" style={{ right: '10%', animationDelay: '0.3s' }} />
        </div>
        
        <div className="text-center relative z-10">
          <div 
            className="text-5xl text-white mb-8 font-bold animate-pulse"
            style={{ textShadow: '0 0 20px rgba(0,0,0,0.9), 0 0 40px rgba(255,255,255,0.8)' }}
          >
            🏆 FAST TRACKED TO FIRST PLACE! 🏆
          </div>
          
          {/* Ultra-large team name display with extreme effects */}
          <div 
            className="font-bold text-white transition-transform duration-300"
            style={{
              fontSize: '10rem',
              textShadow: '0 0 30px rgba(0,0,0,1), 0 0 50px rgba(255,255,255,1), 0 0 70px rgba(255,255,0,0.8), 0 0 90px rgba(255,0,255,0.6)',
              WebkitTextStroke: '4px black',
              transform: `scale(${pulseScale})`,
              lineHeight: '1.2',
            }}
          >
            {teamName}
          </div>
          
          {/* Trophy explosion */}
          <div className="mt-12 flex justify-center gap-8">
            <Trophy className="h-24 w-24 text-yellow-300 animate-bounce" style={{ animationDelay: '0s' }} fill="currentColor" />
            <Trophy className="h-32 w-32 text-yellow-400 animate-bounce" style={{ animationDelay: '0.2s' }} fill="currentColor" />
            <Trophy className="h-24 w-24 text-yellow-300 animate-bounce" style={{ animationDelay: '0.4s' }} fill="currentColor" />
          </div>
          
          <div 
            className="text-6xl text-white font-bold mt-12 animate-pulse"
            style={{ textShadow: '0 0 20px rgba(0,0,0,0.9), 0 0 40px rgba(255,255,255,0.8)' }}
          >
            ⭐ 1ST PLACE WITH +1 POINT LEAD! ⭐
          </div>
        </div>
      </div>
    </div>
  );
}

// Component for animated background similar to BasicDisplay
function WelcomeBackgroundAnimation({ children }: { children: React.ReactNode }) {
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  
  const backgroundColors = [
    '#f39c12',    // Starting orange like BasicDisplay  
    '#e74c3c',    // Red
    '#e91e63',    // Pink  
    '#9b59b6',    // Purple
    '#3498db',    // Blue
    '#27ae60',    // Green
    '#f1c40f',    // Yellow
  ];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentColorIndex((prev) => (prev + 1) % backgroundColors.length);
    }, 3000); // Change color every 3 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div 
      className="w-full h-full relative overflow-hidden flex items-center justify-center transition-colors duration-[3000ms] ease-in-out"
      style={{ backgroundColor: backgroundColors[currentColorIndex] }}
    >
      {/* Background animated circles - same pattern as BasicDisplay */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-yellow-400 rounded-full animate-pulse"></div>
        <div className="absolute top-60 right-32 w-24 h-24 bg-red-400 rounded-full animate-pulse delay-500"></div>
        <div className="absolute bottom-60 left-40 w-40 h-40 bg-green-400 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-red-400 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-32 w-28 h-28 bg-pink-400 rounded-full animate-pulse delay-2000"></div>
        <div className="absolute bottom-40 right-40 w-36 h-36 bg-purple-400 rounded-full animate-pulse delay-500"></div>
      </div>
      
      {children}
    </div>
  );
}

interface Quiz {
  id: string;
  name: string;
  type: "test" | "round";
  icon?: string;
  score?: number;
  scrambled?: boolean;
}

interface ExternalDisplayWindowProps {
  onClose?: () => void;
}

export function ExternalDisplayWindow({ onClose }: ExternalDisplayWindowProps) {
  const { countdownStyle, gameModeTimers } = useSettings();
  const [displayMode, setDisplayMode] = useState<"basic" | "slideshow" | "scores" | "leaderboard-intro" | "leaderboard-reveal" | "timer" | "correctAnswer" | "fastestTeam" | "fastTrack" | "nearest-wins-question" | "nearest-wins-timer" | "nearest-wins-results" | "team-welcome">("basic");
  const [baseDisplayMode, setBaseDisplayMode] = useState<"basic" | "slideshow" | "scores" | "leaderboard-intro" | "leaderboard-reveal" | "nearest-wins-question" | "nearest-wins-timer" | "nearest-wins-results" | "team-welcome">("basic");
  const [images, setImages] = useState<StoredImage[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [slideshowSpeed, setSlideshowSpeed] = useState(5);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [revealedTeams, setRevealedTeams] = useState<Quiz[]>([]);
  const [timerValue, setTimerValue] = useState<number | null>(null);
  const [answerData, setAnswerData] = useState<any>(null);
  const [questionInfo, setQuestionInfo] = useState<{number: number, type: string, total: number} | null>(null);
  const [nearestWinsData, setNearestWinsData] = useState<any>(null);
  const [currentGameMode, setCurrentGameMode] = useState<"keypad" | "buzzin" | "nearestwins">("keypad");
  const [teamName, setTeamName] = useState<string | null>(null);
  const [welcomeTeamName, setWelcomeTeamName] = useState<string>("");

  // Listen for messages from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "DISPLAY_UPDATE") {
        const newMode = event.data.mode;
        
        console.log('ExternalDisplay: Received display update', {
          newMode,
          eventData: event.data,
          timerValue: event.data.timerValue,
          hasTimerValue: event.data.timerValue !== undefined
        });
        
        setDisplayMode(newMode);
        
        // Store base display mode when not showing timer, answer, fastest team, or fast track overlays
        if (newMode !== "timer" && newMode !== "correctAnswer" && newMode !== "fastestTeam" && newMode !== "fastTrack") {
          setBaseDisplayMode(newMode);
        }
        
        // Clear data when switching to basic mode
        if (newMode === "basic") {
          console.log('ExternalDisplay: Clearing data for basic mode');
          setNearestWinsData(null);
          setTimerValue(null);
          setAnswerData(null);
          setQuestionInfo(null);
          setTeamName(null);
        }
        
        if (event.data.images) setImages(event.data.images);
        if (event.data.quizzes) setQuizzes(event.data.quizzes);
        if (event.data.slideshowSpeed) setSlideshowSpeed(event.data.slideshowSpeed);
        if (event.data.leaderboardData) setLeaderboardData(event.data.leaderboardData);
        if (event.data.revealedTeams) setRevealedTeams(event.data.revealedTeams);
        if (event.data.timerValue !== undefined) {
          setTimerValue(event.data.timerValue);
        }
        if (event.data.data) setAnswerData(event.data.data);
        if (event.data.questionInfo) setQuestionInfo(event.data.questionInfo);
        if (event.data.gameMode) setCurrentGameMode(event.data.gameMode);
        if (event.data.teamName) setTeamName(event.data.teamName);
        if (event.data.targetNumber !== undefined || event.data.gameInfo) setNearestWinsData(prev => ({...prev, ...event.data}));
        if (event.data.results) setNearestWinsData(prev => ({...prev, ...event.data}));
        if (event.data.correctAnswer !== undefined) setNearestWinsData(prev => ({...prev, ...event.data}));
        if (event.data.answerRevealed !== undefined) setNearestWinsData(prev => ({...prev, ...event.data}));
        if (event.data.data?.teamName) setWelcomeTeamName(event.data.data.teamName);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []); // Removed displayMode dependency to prevent infinite re-renders

  // Handle window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      onClose?.();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [onClose]);

  const renderDisplayContent = () => {
    // When showing timer, answer, fastest team, or fast track overlays, render nothing underneath
    if (displayMode === "timer" || displayMode === "nearest-wins-timer" || displayMode === "correctAnswer" || displayMode === "fastestTeam" || displayMode === "fastTrack") {
      return <div className="w-full h-full bg-transparent" />;
    }
    
    // Use normal displayMode for rendering the main content
    const modeToRender = displayMode;
    
    console.log(`ExternalDisplay: renderDisplayContent called with displayMode=${displayMode}, baseDisplayMode=${baseDisplayMode}, modeToRender=${modeToRender}`);
    
    switch (modeToRender) {
      case "leaderboard-intro":
      case "leaderboard-reveal":
        return (
          <PopoutDisplay 
            stage={modeToRender as QuizStage}
            onNext={() => {}}
            onSkipTimer={() => {}}
            leaderboardData={leaderboardData}
            revealedTeams={revealedTeams}
          />
        );
      case "slideshow":
        return <ImageSlideshow images={images} interval={slideshowSpeed * 1000} />;
      case "scores":
        return <ScoresDisplay quizzes={quizzes} />;
      case "nearest-wins-question":
        return (
          <div className="h-full w-full flex items-center justify-center bg-[#2c3e50]">
            <div className="text-center">
              <div className="text-6xl font-bold text-[#f39c12] mb-8">
                Nearest Wins Question {nearestWinsData?.questionNumber || 1}
              </div>
              <div className="text-4xl text-white mb-8">
                Guess as close as you can!
              </div>
              <div className="text-2xl text-[#95a5a6]">
                Teams: Submit your best guess now
              </div>
            </div>
          </div>
        );

      case "nearest-wins-results":
        console.log('Nearest wins results data:', {
          answerRevealed: nearestWinsData?.answerRevealed,
          hasWinner: !!nearestWinsData?.results?.winner,
          winner: nearestWinsData?.results?.winner,
          fullData: nearestWinsData
        });
        
        console.log('answerRevealed check:', nearestWinsData?.answerRevealed, typeof nearestWinsData?.answerRevealed);
        return (
          <div className="h-full w-full flex items-center justify-center bg-[#2c3e50]">
            <div className="text-center">
              <div className="text-2xl text-gray-400 mb-8">Target: {nearestWinsData?.targetNumber || 50}</div>
              
              {nearestWinsData?.answerRevealed ? (
                nearestWinsData?.results?.winner ? (
                  <>
                    <div className="text-4xl text-gray-400 mb-8">♕ WINNER ♕</div>
                    <div className="text-8xl font-bold text-green-400 mb-4">
                      {nearestWinsData.results.winner.name}
                    </div>
                    <div className="text-4xl text-white mb-4">
                      Guess: {nearestWinsData.results.winner.guess}
                    </div>
                    <div className="text-2xl text-gray-400">
                      Difference: {nearestWinsData.results.winner.difference}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl text-gray-400 mb-8">♕ WINNER ♕</div>
                    <div className="text-8xl font-bold text-green-400 mb-4">
                      Ahmad
                    </div>
                    <div className="text-4xl text-white mb-4">
                      Guess: 52
                    </div>
                    <div className="text-2xl text-gray-400">
                      Difference: 2
                    </div>
                  </>
                )
              ) : (
                <>
                  <div className="text-4xl text-gray-400 mb-8">Results are in...</div>
                  <div className="text-8xl font-bold text-white mb-4 animate-pulse">
                    ◉
                  </div>
                  <div className="text-2xl text-gray-400 animate-pulse">
                    Waiting for reveal...
                  </div>
                </>
              )}
            </div>
          </div>
        );
      case "team-welcome":
        return (
          <div className="w-full h-full flex items-center justify-center bg-green-500">
            <div className="text-center">
              <div className="text-4xl text-white mb-8 font-bold">
                🎉 Welcome! 🎉
              </div>
              <div className="text-8xl font-bold text-white mb-8 drop-shadow-lg" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.5)'}}>
                {welcomeTeamName || "Team Name"}
              </div>
              <div className="text-3xl text-white font-semibold">
                Let's hear your buzzer sound!
              </div>
            </div>
          </div>
        );

      case "basic":
      default:
        return <BasicDisplay />;
    }
  };

  const renderOverlays = () => {
    const overlays = [];



    // Timer overlay - completely covers screen and eliminates all branding
    if ((displayMode === "timer" || displayMode === "nearest-wins-timer") && timerValue !== null) {
      overlays.push(
        <div 
          key="timer-overlay"
          className="fixed top-0 left-0 w-full h-full bg-[#f1c40f] flex flex-col p-8"
          style={{ 
            zIndex: 99999,
            position: 'fixed',
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: '2rem'
          }}
        >
          {/* Header with Timer title */}
          <div className="text-center mb-8">
            <h1 className="text-6xl font-bold text-[#2c3e50]">
              {displayMode === "nearest-wins-timer" 
                ? `Nearest Wins • Timer` 
                : `Question ${questionInfo?.number || 1} • Timer`}
            </h1>
          </div>

          {/* Main content area with dark rounded rectangle */}
          <div className="flex-1 bg-[#2c3e50] rounded-3xl p-12 flex flex-col justify-center">
            <div className="text-center">
              <div className="text-6xl text-white mb-12">Time Remaining</div>
              
              {/* Simple timer display for external window */}
              <div className="text-center">
                <div className="text-9xl font-bold text-white mb-4" style={{
                  textShadow: '0 0 20px rgba(255,255,255,0.3)',
                  animation: timerValue <= 5 ? 'pulse 1s ease-in-out infinite' : 'none'
                }}>
                  {timerValue}
                </div>
                <div className="text-3xl text-white opacity-80">
                  seconds
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Correct Answer overlay - completely covers screen and eliminates all branding
    if (displayMode === "correctAnswer" && answerData) {
      overlays.push(
        <div 
          key="answer-overlay"
          className="fixed top-0 left-0 w-full h-full bg-[#f1c40f] flex flex-col p-8"
          style={{ 
            zIndex: 99999,
            position: 'fixed',
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: '2rem'
          }}
        >
          {/* Header with Results title */}
          <div className="text-center mb-8">
            <h1 className="text-6xl font-bold text-[#2c3e50]">Question {questionInfo?.number || 1} • Results</h1>
          </div>

          {/* Main content area with dark rounded rectangle */}
          <div className="flex-1 bg-[#2c3e50] rounded-3xl p-12 flex flex-col justify-center">
            {/* Stats summary in one line if available */}
            {answerData.stats && (
              <div className="text-center mb-8">
                <div className="text-2xl text-white">
                  {answerData.stats.correct > 0 
                    ? `${answerData.stats.correct} team${answerData.stats.correct !== 1 ? 's' : ''} answered correctly`
                    : 'No teams answered correctly'
                  }
                </div>
                <div className="w-full h-px bg-white/30 my-8"></div>
              </div>
            )}

            {/* The correct answer is... */}
            <div className="text-center">
              <div className="text-3xl text-white mb-8">The correct answer is...</div>
              
              {/* Large answer display */}
              <div className="text-8xl font-bold text-white mb-4">
                {answerData.revealed ? (answerData.correctAnswer || 'No Answer') : '...'}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Fastest Team overlay - completely covers screen and eliminates all branding
    if (displayMode === "fastestTeam" && answerData) {
      overlays.push(
        <div 
          key="fastest-team-overlay"
          className="fixed top-0 left-0 w-full h-full bg-[#f1c40f] flex flex-col p-8"
          style={{ 
            zIndex: 99999,
            position: 'fixed',
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: '2rem'
          }}
        >
          {/* Header with Fastest Team title */}
          <div className="text-center mb-8">
            <h1 className="text-6xl font-bold text-[#2c3e50]">Question {questionInfo?.number || 1} • Fastest Team</h1>
          </div>

          {/* Main content area with dark rounded rectangle */}
          <div className="flex-1 bg-[#2c3e50] rounded-3xl p-12 flex flex-col justify-center">
            <div className="text-center">
              <div className="text-3xl text-white mb-8">The fastest correct answer was...</div>
              
              {/* Large team name display */}
              <div className="text-8xl font-bold text-[#27ae60] mb-4">
                {answerData.fastestTeam ? answerData.fastestTeam.name : 'Unknown Team'}
              </div>
              
              {/* Lightning emoji animation */}
              <div className="text-6xl animate-pulse">⚡</div>
            </div>
          </div>
        </div>
      );
    }

    // FAST TRACK overlay - completely covers screen with amazing animation
    if (displayMode === "fastTrack" && answerData) {
      overlays.push(
        <FastTrackDisplay
          key="fast-track-overlay"
          teamName={answerData.fastestTeam ? answerData.fastestTeam.name : 'Unknown Team'}
          questionNumber={questionInfo?.number || 1}
        />
      );
    }

    return overlays;
  }; 

  return (
    <div className="h-screen w-screen bg-[#1a252f] overflow-hidden">
      {/* Display Content Area */}
      <div className="w-full h-full relative">
        <div className="w-full h-full">
          {renderDisplayContent()}
        </div>
        
        {/* Render overlays on top of base content */}
        {renderOverlays()}
        
        {/* Position Watermark */}
        <div className="absolute bottom-4 right-4 text-xs text-white/30 font-mono">
          EXT-1
        </div>
      </div>
    </div>
  );
}