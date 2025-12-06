import { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';

interface ImageLoaderProps {
  src?: string;
  alt?: string;
  onLoadStart?: () => void;
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
  timeout?: number; // milliseconds
}

export function ImageLoader({
  src,
  alt = 'Question image',
  onLoadStart,
  onLoadSuccess,
  onLoadError,
  timeout = 5000,
}: ImageLoaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when src changes
    setIsLoading(false);
    setHasError(false);
    setImageUrl(null);

    if (!src) {
      return;
    }

    setIsLoading(true);
    onLoadStart?.();

    // Create an Image object to preload
    const img = new Image();
    let timeoutId: NodeJS.Timeout;

    const handleLoad = () => {
      clearTimeout(timeoutId);
      if (!hasError) {
        setImageUrl(src);
        setIsLoading(false);
        onLoadSuccess?.();
      }
    };

    const handleError = () => {
      clearTimeout(timeoutId);
      const error = new Error(`Failed to load image: ${src}`);
      setHasError(true);
      setIsLoading(false);
      onLoadError?.(error);
    };

    const handleTimeout = () => {
      img.onerror = null;
      img.onload = null;
      const error = new Error(`Image load timeout after ${timeout}ms`);
      setHasError(true);
      setIsLoading(false);
      onLoadError?.(error);
    };

    img.onload = handleLoad;
    img.onerror = handleError;
    timeoutId = setTimeout(handleTimeout, timeout);

    // Start loading
    img.src = src;

    return () => {
      clearTimeout(timeoutId);
      img.onerror = null;
      img.onload = null;
    };
  }, [src, onLoadStart, onLoadSuccess, onLoadError, timeout, hasError]);

  if (!src) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mb-8">
        <div
          className="rounded-lg shadow-lg bg-slate-700 flex items-center justify-center animate-pulse"
          style={{
            width: '300px',
            height: '450px',
            aspectRatio: '2 / 3',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-slate-300 text-sm">Loading image...</p>
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="mb-8">
        <div
          className="rounded-lg shadow-lg bg-slate-700 flex items-center justify-center border-2 border-red-500/50"
          style={{
            width: '300px',
            height: '450px',
            aspectRatio: '2 / 3',
          }}
        >
          <div className="text-center">
            <p className="text-slate-300 text-sm mb-2">Image failed to load</p>
            <p className="text-slate-400 text-xs">Continuing with question...</p>
          </div>
        </div>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div className="mb-8">
        <div
          className="rounded-lg shadow-lg bg-slate-700 flex items-center justify-center overflow-hidden"
          style={{
            width: '300px',
            height: '450px',
            aspectRatio: '2 / 3',
          }}
        >
          <img
            src={imageUrl}
            alt={alt}
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    );
  }

  return null;
}
