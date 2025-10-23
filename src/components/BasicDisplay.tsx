import { useEffect, useState } from 'react';

interface BasicDisplayProps {
  className?: string;
}

export function BasicDisplay({ className = '' }: BasicDisplayProps) {
  // Emoji waterfall effect - much slower and subtle
  useEffect(() => {
    console.log('♪ Starting slow emoji waterfall for basic mode');
    
    const emojis = [
      '🎯', '🎪', '🎉', '🏆', '⭐', '💫', '🎊', '🎈',
      '🎺', '🧠', '🎨', '🎭', '🎸', '🎲', '🎳', '🎮',
      '🎱', '🎰', '🎵', '🌮', '🍕', '🍦', '🍪', '🍰',
      '🧁', '🍓', '🍊', '🍌', '🍍', '🐶', '🐱', '🐭',
      '🐹', '🐰', '🦊', '🐻', '🐨', '🐯', '🌸', '🌺',
      '🌻', '🌷', '🌹', '🌵', '🌲', '🌳', '🍀', '🍃',
      '✨', '🌙', '☀️', '🌤️', '⛅', '🌦️', '❄️', '🚀',
      '🛸', '🎡', '🎢', '🎠', '🔥', '💖', '🌈', '⚡'
    ];

    const activeTimeouts = new Set<NodeJS.Timeout>();
    let emojiInterval: NodeJS.Timeout;

    const spawnEmoji = () => {
      try {
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        const emojiElement = document.createElement('div');

        emojiElement.textContent = emoji;
        emojiElement.className = 'falling-emoji emoji-font';

        const leftPercent = Math.random() * 100;

        emojiElement.style.cssText = `
          position: fixed;
          left: ${leftPercent}vw;
          top: -60px;
          font-size: 2rem;
          pointer-events: none;
          z-index: 5;
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiSymbols", "EmojiOne Color", "Twemoji Mozilla", system-ui, sans-serif !important;
          animation: falling-emoji 8s linear forwards;
          transform: translateX(-50%);
        `;

        if (document.body) {
          document.body.appendChild(emojiElement);

          const cleanupTimeout = setTimeout(() => {
            try {
              if (emojiElement && emojiElement.parentNode) {
                emojiElement.parentNode.removeChild(emojiElement);
              }
              activeTimeouts.delete(cleanupTimeout);
            } catch (error) {
              console.warn('Error cleaning up emoji:', error);
            }
          }, 8200);

          activeTimeouts.add(cleanupTimeout);
        }
      } catch (error) {
        console.warn('Error spawning emoji:', error);
      }
    };

    spawnEmoji();
    emojiInterval = setInterval(spawnEmoji, 15000);
    
    return () => {
      if (emojiInterval) {
        clearInterval(emojiInterval);
      }
      
      activeTimeouts.forEach(timeout => clearTimeout(timeout));
      activeTimeouts.clear();
      
      try {
        const existingEmojis = document.querySelectorAll('.falling-emoji');
        existingEmojis.forEach(emoji => {
          if (emoji.parentNode) {
            emoji.parentNode.removeChild(emoji);
          }
        });
      } catch (error) {
        console.warn('Error cleaning up emojis:', error);
      }
    };
  }, []);

  return (
    <div className="basic-display-bg" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: '#f1c40f',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 0,
      padding: 0
    }}>
      {/* Main centered card */}
      <div className="pop-quiz-card" style={{
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{
          backgroundColor: '#f97316',
          padding: '4rem 6rem',
          borderRadius: '1rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: '6px solid white',
          transform: 'rotate(-3deg)',
          transition: 'transform 0.3s ease'
        }}>
          <h1 style={{
            fontSize: '10rem',
            fontWeight: 900,
            letterSpacing: '0.05em',
            margin: 0,
            color: 'black',
            textShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            lineHeight: 0.9
          }}>
            POP
          </h1>
          <h2 style={{
            fontSize: '10rem',
            fontWeight: 900,
            letterSpacing: '0.05em',
            marginTop: '0.5rem',
            marginBottom: 0,
            color: 'black',
            textShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            lineHeight: 0.9
          }}>
            QUIZ!
          </h2>
        </div>

        {/* Decorative emoji stickers */}
        <div className="emoji-font" style={{
          position: 'absolute',
          top: '-1rem',
          left: '-1rem',
          fontSize: '3rem',
          animation: 'bounce 2s infinite',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
        }}>🎯</div>
        
        <div className="emoji-font" style={{
          position: 'absolute',
          top: '2rem',
          right: '-2rem',
          fontSize: '2.5rem',
          animation: 'bounce 2s infinite 0.3s',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
        }}>🌟</div>
        
        <div className="emoji-font" style={{
          position: 'absolute',
          bottom: '3rem',
          right: '-3rem',
          fontSize: '2.5rem',
          animation: 'bounce 2s infinite 0.7s',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
        }}>🏆</div>
        
        <div className="emoji-font" style={{
          position: 'absolute',
          bottom: '-2rem',
          left: '-2rem',
          fontSize: '2rem',
          animation: 'bounce 2s infinite 1s',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
        }}>🎵</div>

        <div className="emoji-font" style={{
          position: 'absolute',
          top: '50%',
          right: '-4rem',
          fontSize: '2rem',
          animation: 'bounce 2s infinite 0.5s',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
        }}>💬</div>

        <div className="emoji-font" style={{
          position: 'absolute',
          top: '-2rem',
          right: '30%',
          fontSize: '2.5rem',
          animation: 'bounce 2s infinite 0.8s',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
        }}>🎨</div>

        <div className="emoji-font" style={{
          position: 'absolute',
          bottom: '-1rem',
          right: '20%',
          fontSize: '2rem',
          animation: 'bounce 2s infinite 1.2s',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
        }}>🐟</div>

        <div className="emoji-font" style={{
          position: 'absolute',
          top: '40%',
          left: '-3rem',
          fontSize: '2rem',
          animation: 'bounce 2s infinite 0.4s',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
        }}>🧠</div>
      </div>
    </div>
  );
}
