import { useState, useEffect } from 'react';

interface SlideshowImage {
  id: string;
  path: string;
  name: string;
}

interface SlideshowPlayerDisplayProps {
  images: SlideshowImage[];
  rotationInterval?: number; // milliseconds, default 10000 (10 seconds)
}

export function SlideshowPlayerDisplay({ 
  images, 
  rotationInterval = 10000 
}: SlideshowPlayerDisplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const currentImage = images.length > 0 ? images[currentIndex] : null;

  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
      setImageError(false);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [images.length, rotationInterval]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
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
        backgroundColor: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* No images available */}
      {images.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: '#fff',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>No Images Available</h1>
          <p style={{ fontSize: '1rem', opacity: 0.7 }}>
            Please add images to the Phone Slideshow folder
          </p>
        </div>
      ) : imageError ? (
        <div style={{
          textAlign: 'center',
          color: '#fff',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Image Not Found</h1>
          <p style={{ fontSize: '1rem', opacity: 0.7 }}>
            {currentImage?.name}
          </p>
        </div>
      ) : (
        <>
          {/* Image container with fade animation */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadeInImage 0.5s ease-in',
            }}
          >
            {isLoading && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                color: '#fff',
                textAlign: 'center',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #fff',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem',
                }}></div>
                <p>Loading...</p>
              </div>
            )}
            
            <img
              key={currentImage?.id}
              src={currentImage?.path}
              alt={currentImage?.name}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Image counter */}
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            {currentIndex + 1} / {images.length}
          </div>

          {/* Progress bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: '#00bcd4',
                width: `${((currentIndex + 1) / images.length) * 100}%`,
                transition: `width ${rotationInterval}ms linear`,
              }}
            ></div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeInImage {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
