import { useState, useEffect } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { Button } from "./ui/button";
import { StoredImage } from "../utils/imageStorage";

interface ImageSlideshowProps {
  images: StoredImage[];
  autoPlay?: boolean;
  interval?: number;
}

export function ImageSlideshow({ images, autoPlay = true, interval = 10000 }: ImageSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  useEffect(() => {
    if (!isPlaying || images.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, images.length, interval]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  if (images.length === 0) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black'
      }}>
        <div className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto mb-6 relative">
            <div className="absolute inset-0 border-4 border-[#3498db]/40 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h3 className="text-3xl text-[#ecf0f1]/80 font-semibold">No Images</h3>
          <p className="text-[#95a5a6]/70 max-w-md">
            Upload images using the gear button next to the Display tab to show them here
          </p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      margin: 0,
      padding: 0,
      backgroundColor: 'black',
      overflow: 'hidden'
    }}>
      {/* Main Image */}
      <div className="w-full h-full flex items-center justify-center">
        <ImageWithFallback
          src={currentImage.url}
          alt={currentImage.name}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Navigation Controls */}
      {images.length > 1 && (
        <>
          {/* Previous Button */}
          <Button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white border-0 w-12 h-12 p-0 opacity-20 hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          {/* Next Button */}
          <Button
            onClick={goToNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white border-0 w-12 h-12 p-0 opacity-20 hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>

          {/* Play/Pause Button */}
          <Button
            onClick={togglePlayPause}
            className="absolute bottom-4 left-4 bg-black/60 hover:bg-black/80 text-white border-0 w-12 h-12 p-0 opacity-20 hover:opacity-100 transition-opacity"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
        </>
      )}

      {/* Image Counter */}
      <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded px-3 py-2 opacity-20 hover:opacity-100 transition-opacity">
        <div className="text-sm text-white">
          {currentIndex + 1} of {images.length}
        </div>
        <div className="text-xs text-gray-300 truncate max-w-48" title={currentImage.name}>
          {currentImage.name}
        </div>
      </div>

      {/* Progress Dots */}
      {images.length > 1 && images.length <= 20 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 opacity-20 hover:opacity-100 transition-opacity">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
