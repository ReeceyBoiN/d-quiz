import { BasicPlayerDisplay } from './displays/BasicPlayerDisplay';
import { SlideshowPlayerDisplay } from './displays/SlideshowPlayerDisplay';
import { ScoresPlayerDisplay } from './displays/ScoresPlayerDisplay';

type DisplayMode = 'basic' | 'slideshow' | 'scores';

interface SlideshowImage {
  id: string;
  path: string;
  name: string;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  position: number;
}

interface PlayerDisplayManagerProps {
  mode: DisplayMode;
  images?: SlideshowImage[];
  rotationInterval?: number;
  scores?: LeaderboardEntry[];
}

/**
 * Router component that displays the appropriate player display based on mode
 */
export function PlayerDisplayManager({
  mode,
  images = [],
  rotationInterval = 10000,
  scores = [],
}: PlayerDisplayManagerProps) {
  switch (mode) {
    case 'slideshow':
      return (
        <SlideshowPlayerDisplay
          images={images}
          rotationInterval={rotationInterval}
        />
      );

    case 'scores':
      return (
        <ScoresPlayerDisplay
          scores={scores}
        />
      );

    case 'basic':
    default:
      return <BasicPlayerDisplay />;
  }
}
