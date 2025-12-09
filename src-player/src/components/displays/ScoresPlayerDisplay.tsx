import { useEffect, useState, useRef } from 'react';
import { Trophy, Crown, Medal } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  position: number;
}

interface ScoresPlayerDisplayProps {
  scores: LeaderboardEntry[];
}

export function ScoresPlayerDisplay({
  scores
}: ScoresPlayerDisplayProps) {
  const [displayScores, setDisplayScores] = useState<LeaderboardEntry[]>(scores);
  const [shouldScroll, setShouldScroll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayScores(scores);
  }, [scores]);

  // Check if content needs to scroll
  useEffect(() => {
    const checkIfScrollNeeded = () => {
      if (containerRef.current && contentRef.current) {
        const containerHeight = containerRef.current.offsetHeight;
        const contentHeight = contentRef.current.offsetHeight;
        setShouldScroll(contentHeight > containerHeight);
      }
    };

    // Check immediately and after a small delay to ensure DOM is ready
    checkIfScrollNeeded();
    const timer = setTimeout(checkIfScrollNeeded, 100);

    window.addEventListener('resize', checkIfScrollNeeded);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkIfScrollNeeded);
    };
  }, [displayScores]);

  const getPositionIcon = (position: number) => {
    if (position === 1) return <Crown className="w-8 h-8 text-[#f1c40f]" />;
    if (position === 2) return <Medal className="w-6 h-6 text-[#95a5a6]" />;
    if (position === 3) return <Medal className="w-6 h-6 text-[#cd7f32]" />;
    return <div className="w-8 h-8 flex items-center justify-center text-white font-bold text-lg">{position}</div>;
  };

  const getScoreColor = (position: number) => {
    if (position === 1) return '#f1c40f';
    if (position === 2) return '#95a5a6';
    if (position === 3) return '#cd7f32';
    return '#3498db';
  };

  const getBackgroundGradient = (position: number) => {
    if (position === 1) return 'linear-gradient(90deg, rgba(241, 196, 15, 0.2) 0%, transparent 100%)';
    if (position === 2) return 'linear-gradient(90deg, rgba(149, 165, 166, 0.2) 0%, transparent 100%)';
    if (position === 3) return 'linear-gradient(90deg, rgba(205, 127, 50, 0.2) 0%, transparent 100%)';
    return 'linear-gradient(90deg, rgba(52, 152, 219, 0.1) 0%, transparent 100%)';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: '2rem',
      }}
    >
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '2rem',
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          marginBottom: '0.5rem',
        }}>
          <Trophy style={{ width: '2rem', height: '2rem', color: '#f39c12' }} />
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#ecf0f1',
            letterSpacing: '0.05em',
            margin: 0,
          }}>
            LEADERBOARD
          </h1>
        </div>
        <div style={{
          fontSize: '0.9rem',
          color: '#95a5a6',
          marginBottom: '0.75rem',
        }}>
          Current Team Standings
        </div>
        <div style={{
          width: '6rem',
          height: '2px',
          background: 'linear-gradient(90deg, #3498db 0%, #f39c12 100%)',
          margin: '0 auto',
          borderRadius: '1px',
        }}></div>
      </div>

      {/* Scrolling scores container */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {displayScores.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#95a5a6',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
            <p style={{ fontSize: '1.2rem' }}>Waiting for scores...</p>
          </div>
        ) : (
          <div
            ref={contentRef}
            style={{
              width: '90%',
              maxWidth: '600px',
              animation: shouldScroll ? 'scrollScores 30s linear infinite' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {/* Only render scores once if not scrolling, twice if scrolling for continuous animation */}
            {(shouldScroll ? [...displayScores, ...displayScores] : displayScores).map((entry, index) => (
              <div
                key={`${entry.id}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  backgroundColor: 'rgba(52, 152, 219, 0.1)',
                  border: `2px solid ${getScoreColor(entry.position)}`,
                  borderRadius: '0.75rem',
                  background: getBackgroundGradient(entry.position),
                  backdropFilter: 'blur(4px)',
                  transform: entry.position === 1 ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.3s ease',
                }}
              >
                {/* Position Icon */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '3rem',
                }}>
                  {getPositionIcon(entry.position)}
                </div>

                {/* Team Name */}
                <div style={{
                  flex: 1,
                  minWidth: 0,
                }}>
                  <h3 style={{
                    fontSize: entry.position === 1 ? '1.25rem' : '1rem',
                    fontWeight: 'bold',
                    color: '#ecf0f1',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {entry.name}
                  </h3>
                  {entry.position < 4 && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#95a5a6',
                      marginTop: '0.25rem',
                    }}>
                      {entry.position === 1 ? '🏆 Champion' : entry.position === 2 ? '🥈 Runner-up' : '🥉 Third Place'}
                    </div>
                  )}
                </div>

                {/* Score */}
                <div style={{
                  textAlign: 'right',
                  minWidth: '4rem',
                }}>
                  <div style={{
                    fontSize: entry.position === 1 ? '1.75rem' : '1.5rem',
                    fontWeight: 'bold',
                    color: getScoreColor(entry.position),
                  }}>
                    {entry.score}
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: '#95a5a6',
                    marginTop: '0.25rem',
                  }}>
                    PTS
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        paddingBottom: '1.5rem',
        zIndex: 10,
      }}>
        <div style={{
          fontSize: '0.9rem',
          color: '#7f8c8d',
        }}>
          Quiz Competition • Real-time Standings
        </div>
      </div>

      <style>{`
        @keyframes scrollScores {
          0% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-50%);
          }
          100% {
            transform: translateY(-100%);
          }
        }
      `}</style>
    </div>
  );
}
