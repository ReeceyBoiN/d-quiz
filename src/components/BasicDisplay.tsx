import { useEffect, useRef } from 'react';

export function BasicDisplay() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  console.log('BasicDisplay rendering');

  useEffect(() => {
    console.log('BasicDisplay mounted, containerRef:', containerRef.current);
    
    const emojis = [
      '🎯','🎪','🎉','🏆','⭐','💫','🎊','🎈','🎺','🧠','🎨','🎭','🎸','🎲','🎳','🎮',
      '🎱','🎰','🎵','🌮','🍕','🍦','🍪','🍰','🧁','🍓','🍊','🍌','🍍','🐶','🐱','🐭',
      '🐹','🐰','🦊','🐻','🐨','🐯','🌸','🌺','🌻','🌷','🌹','🌵','🌲','🌳','🍀','🍃',
      '✨','🌙','☀️','🌤️','⛅','🌦️','❄️','🚀','🛸','🎡','🎢','🎠','🔥','💖','���','⚡'
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
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        backgroundColor: '#f1c40f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'relative', width: 'min(80vw, 1200px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div 
          role="img" 
          aria-label="Pop quiz card"
          style={{
            background: '#f97316',
            padding: '4rem 6rem',
            borderRadius: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            border: '6px solid white',
            transform: 'rotate(-3deg)',
            transition: 'transform 0.3s ease',
            textAlign: 'center',
          }}
        >
          <h1 
            style={{
              fontSize: 'clamp(3rem, 12vw, 10rem)',
              fontWeight: 900,
              letterSpacing: '0.05em',
              margin: 0,
              color: 'black',
              textShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              lineHeight: 0.9,
            }}
          >
            POP
          </h1>
          <h2 
            style={{
              fontSize: 'clamp(3rem, 12vw, 10rem)',
              fontWeight: 900,
              letterSpacing: '0.05em',
              margin: 0,
              color: 'black',
              textShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              lineHeight: 0.9,
            }}
          >
            QUIZ!
          </h2>
        </div>

        <div style={{ position: 'absolute', top: '-1rem', left: '-1rem', fontSize: '3rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🎯</div>
        <div style={{ position: 'absolute', top: '1.5rem', right: '-2rem', fontSize: '2.5rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🌟</div>
        <div style={{ position: 'absolute', bottom: '3rem', right: '-3rem', fontSize: '2.5rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🏆</div>
        <div style={{ position: 'absolute', bottom: '-2rem', left: '-2rem', fontSize: '2rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🎵</div>
        <div style={{ position: 'absolute', top: '50%', right: '-4rem', fontSize: '2rem', transform: 'translateY(-50%)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>💬</div>
        <div style={{ position: 'absolute', top: '-2rem', right: '30%', fontSize: '2.5rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.12))', animation: 'bounce 2s infinite' }}>🎨</div>
      </div>
    </div>
  );
}
