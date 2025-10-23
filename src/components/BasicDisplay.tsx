import { useEffect, useRef } from 'react';

export function BasicDisplay() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const emojis = [
      '🎯','🎪','🎉','🏆','⭐','💫','🎊','🎈','🎺','🧠','🎨','🎭','🎸','🎲','🎳','🎮',
      '🎱','🎰','🎵','🌮','🍕','🍦','🍪','🍰','🧁','🍓','🍊','����','🍍','🐶','🐱','🐭',
      '🐹','🐰','🦊','🐻','🐨','🐯','🌸','🌺','🌻','🌷','🌹','🌵','🌲','🌳','🍀','🍃',
      '✨','🌙','☀️','🌤️','⛅','🌦️','❄️','🚀','🛸','🎡','🎢','🎠','🔥','💖','🌈','⚡'
    ];

    const activeTimeouts = new Set<number>();
    let emojiInterval: number | undefined;

    const spawnEmoji = () => {
      try {
        if (!containerRef.current) return;
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        const emojiElement = document.createElement('div');
        emojiElement.textContent = emoji;
        emojiElement.className = 'basic-emoji emoji-font';

        const leftPercent = Math.random() * 100;
        emojiElement.style.left = `${leftPercent}vw`;

        containerRef.current.appendChild(emojiElement);

        const cleanupId = window.setTimeout(() => {
          try {
            if (emojiElement && emojiElement.parentNode) emojiElement.parentNode.removeChild(emojiElement);
            activeTimeouts.delete(cleanupId);
          } catch (e) {
            console.warn('Error cleaning up emoji', e);
          }
        }, 8200);

        activeTimeouts.add(cleanupId);
      } catch (error) {
        console.warn('Error spawning emoji:', error);
      }
    };

    spawnEmoji();
    emojiInterval = window.setInterval(spawnEmoji, 15000);

    return () => {
      if (emojiInterval) window.clearInterval(emojiInterval);
      activeTimeouts.forEach(id => window.clearTimeout(id));
      activeTimeouts.clear();
      try {
        if (containerRef.current) {
          const existing = containerRef.current.querySelectorAll('.basic-emoji');
          existing.forEach((el) => el.remove());
        }
      } catch (e) {
        console.warn('Error cleaning emojis on unmount', e);
      }
    };
  }, []);

  return (
    <div className="external-display-root" ref={containerRef}>
      <div className="pop-quiz-wrapper">
        <div className="pop-quiz-card" role="img" aria-label="Pop quiz card">
          <h1 className="pop-quiz-line">POP</h1>
          <h2 className="pop-quiz-line">QUIZ!</h2>
        </div>

        <div className="decor-emoji decor-top-left emoji-font">🎯</div>
        <div className="decor-emoji decor-top-right emoji-font">🌟</div>
        <div className="decor-emoji decor-bottom-right emoji-font">🏆</div>
        <div className="decor-emoji decor-bottom-left emoji-font">🎵</div>
        <div className="decor-emoji decor-mid-right emoji-font">💬</div>
        <div className="decor-emoji decor-top-mid emoji-font">🎨</div>
      </div>
    </div>
  );
}
