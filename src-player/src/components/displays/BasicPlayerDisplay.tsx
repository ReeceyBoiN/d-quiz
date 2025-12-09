import { useEffect, useRef } from 'react';

export function BasicPlayerDisplay() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bgColorRef = useRef(0);

  useEffect(() => {
    const colors = [
      '#FF6B6B', // Red
      '#FF8E72', // Orange
      '#FFD93D', // Yellow
      '#6BCB77', // Green
      '#4D96FF', // Blue
      '#9B59B6', // Purple
      '#E91E63', // Pink
      '#00BCD4', // Cyan
    ];

    let colorChangeInterval: number | undefined;

    // Change background color periodically
    const changeBackgroundColor = () => {
      if (containerRef.current) {
        bgColorRef.current = (bgColorRef.current + 1) % colors.length;
        containerRef.current.style.backgroundColor = colors[bgColorRef.current];
      }
    };

    // Initial color
    changeBackgroundColor();

    // Change color every 5 seconds
    colorChangeInterval = window.setInterval(changeBackgroundColor, 5000);

    return () => {
      if (colorChangeInterval) window.clearInterval(colorChangeInterval);
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
        backgroundColor: '#FF6B6B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 1s ease-in-out',
      }}
    >
      <div style={{ position: 'relative', width: 'min(90vw, 600px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div
          role="img"
          aria-label="Pop quiz"
          style={{
            background: 'white',
            padding: '2rem 3rem',
            borderRadius: '0.75rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            border: '4px solid #333',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(2rem, 10vw, 6rem)',
              fontWeight: 900,
              letterSpacing: '0.05em',
              margin: 0,
              color: '#333',
              textShadow: 'none',
              lineHeight: 0.9,
            }}
          >
            POP
          </h1>
          <h2
            style={{
              fontSize: 'clamp(2rem, 10vw, 6rem)',
              fontWeight: 900,
              letterSpacing: '0.05em',
              margin: 0,
              color: '#333',
              textShadow: 'none',
              lineHeight: 0.9,
            }}
          >
            QUIZ!
          </h2>
          <p
            style={{
              fontSize: 'clamp(0.875rem, 3vw, 1.25rem)',
              color: '#666',
              marginTop: '1.5rem',
              margin: '1.5rem 0 0 0',
              fontWeight: 500,
            }}
          >
            Please wait for your host to get started
          </p>
        </div>
      </div>
    </div>
  );
}
