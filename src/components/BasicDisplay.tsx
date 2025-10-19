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
        emojiElement.style.cssText = `
          position: fixed;
          left: ${Math.random() * 100}%;
          top: -60px;
          font-size: 2rem;
          pointer-events: none;
          z-index: 5;
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiSymbols", "EmojiOne Color", "Twemoji Mozilla", system-ui, sans-serif !important;
          animation: falling-emoji 8s linear forwards;
        `;
        
        if (document.body) {
          document.body.appendChild(emojiElement);
          
          // Clean up after animation with tracked timeout
          const cleanupTimeout = setTimeout(() => {
            try {
              if (emojiElement && emojiElement.parentNode) {
                emojiElement.parentNode.removeChild(emojiElement);
              }
              activeTimeouts.delete(cleanupTimeout);
            } catch (error) {
              console.warn('Error cleaning up emoji:', error);
            }
          }, 8200); // Slightly longer than animation duration
          
          activeTimeouts.add(cleanupTimeout);
        }
      } catch (error) {
        console.warn('Error spawning emoji:', error);
      }
    };

    // Spawn first emoji immediately
    spawnEmoji();
    
    // Then spawn every 15 seconds (reduced frequency to improve performance)
    emojiInterval = setInterval(spawnEmoji, 15000);
    
    return () => {
      // Clear interval
      if (emojiInterval) {
        clearInterval(emojiInterval);
      }
      
      // Clear all tracked timeouts
      activeTimeouts.forEach(timeout => clearTimeout(timeout));
      activeTimeouts.clear();
      
      // Clean up any remaining emojis
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
    <div className={`w-full h-full relative overflow-hidden bg-orange-500 flex items-center justify-center ${className}`}>
      {/* Background animated circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-yellow-400 rounded-full animate-pulse"></div>
        <div className="absolute top-60 right-32 w-24 h-24 bg-red-400 rounded-full animate-pulse delay-500"></div>
        <div className="absolute bottom-60 left-40 w-40 h-40 bg-green-400 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-red-400 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-32 w-28 h-28 bg-pink-400 rounded-full animate-pulse delay-2000"></div>
        <div className="absolute bottom-40 right-40 w-36 h-36 bg-purple-400 rounded-full animate-pulse delay-500"></div>
      </div>
      
      {/* Main content */}
      <div className="relative z-10 text-center transform -rotate-6">
        <div className="bg-orange-500 text-black px-20 py-12 rounded-2xl shadow-2xl border-4 border-white transform rotate-3 hover:rotate-0 transition-transform duration-300">
          <h1 className="text-[12rem] font-black tracking-wider drop-shadow-lg">
            POP
          </h1>
          <h2 className="text-[12rem] font-black tracking-wider -mt-8 drop-shadow-lg">
            QUIZ!
          </h2>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -top-8 -left-8 text-6xl animate-bounce emoji-font">🎯</div>
        <div className="absolute -top-8 -right-8 text-6xl animate-bounce delay-300 emoji-font">🧠</div>
        <div className="absolute -bottom-8 -left-8 text-6xl animate-bounce delay-700 emoji-font">🎵</div>
        <div className="absolute -bottom-8 -right-8 text-6xl animate-bounce delay-1000 emoji-font">🏆</div>
      </div>
      
      {/* Floating elements */}
      <div className="absolute top-1/4 left-1/4 text-4xl animate-spin emoji-font">⭐</div>
      <div className="absolute top-3/4 right-1/4 text-4xl animate-spin delay-500 emoji-font">✨</div>
      <div className="absolute top-1/2 left-1/6 text-3xl animate-pulse emoji-font">🎵</div>
      <div className="absolute top-1/3 right-1/6 text-3xl animate-pulse delay-300 emoji-font">⚡</div>
    </div>
  );
}