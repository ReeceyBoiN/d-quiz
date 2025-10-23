import { useEffect, useRef, useCallback, useState } from 'react';

export interface UseTimerConfig {
  onEnd?: () => void;
  onTick?: (remaining: number) => void;
  tickInterval?: number; // milliseconds between ticks (default 100ms for smooth animation)
}

export interface UseTimerControls {
  start: (totalSeconds: number, silent?: boolean) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: (totalSeconds: number) => void;
  timeRemaining: number;
  totalTime: number;
  isRunning: boolean;
  isPaused: boolean;
  progress: number; // 0–100
}

/**
 * Custom hook for managing a countdown timer.
 * Provides smooth animation with configurable tick interval.
 * 
 * Usage:
 *   const timer = useTimer({ onEnd: handleTimerEnd, onTick: handleTick });
 *   timer.start(30);  // Start 30-second countdown
 *   <div style={{ width: timer.progress + '%' }}>drain</div>
 */
export function useTimer(config?: UseTimerConfig): UseTimerControls {
  const { onEnd, onTick, tickInterval = 100 } = config || {};

  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef({
    remaining: 0,
    total: 0,
    silent: false,
  });

  const progress = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 100;

  // Start the timer
  const start = useCallback(
    (totalSeconds: number, silent: boolean = false) => {
      if (isRunning) return;

      setTotalTime(totalSeconds);
      setTimeRemaining(totalSeconds);
      timerRef.current = {
        remaining: totalSeconds,
        total: totalSeconds,
        silent,
      };
      setIsRunning(true);
      setIsPaused(false);

      // Clear any existing interval
      if (intervalRef.current) clearInterval(intervalRef.current);

      // Start countdown interval
      intervalRef.current = setInterval(() => {
        timerRef.current.remaining -= tickInterval / 1000;

        if (timerRef.current.remaining <= 0) {
          timerRef.current.remaining = 0;
          setTimeRemaining(0);
          setIsRunning(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (onEnd) onEnd();
        } else {
          setTimeRemaining(Math.max(0, timerRef.current.remaining));
          if (onTick) onTick(timerRef.current.remaining);
        }
      }, tickInterval);
    },
    [isRunning, onEnd, onTick, tickInterval]
  );

  // Stop and reset timer
  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setTimeRemaining(0);
    setTotalTime(0);
    timerRef.current = { remaining: 0, total: 0, silent: false };
  }, []);

  // Pause timer
  const pause = useCallback(() => {
    if (intervalRef.current && isRunning) {
      clearInterval(intervalRef.current);
      setIsRunning(false);
      setIsPaused(true);
    }
  }, [isRunning]);

  // Resume paused timer
  const resume = useCallback(() => {
    if (!isRunning && isPaused && timerRef.current.remaining > 0) {
      setIsRunning(true);
      setIsPaused(false);

      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        timerRef.current.remaining -= tickInterval / 1000;

        if (timerRef.current.remaining <= 0) {
          timerRef.current.remaining = 0;
          setTimeRemaining(0);
          setIsRunning(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (onEnd) onEnd();
        } else {
          setTimeRemaining(Math.max(0, timerRef.current.remaining));
          if (onTick) onTick(timerRef.current.remaining);
        }
      }, tickInterval);
    }
  }, [isRunning, isPaused, onEnd, onTick, tickInterval]);

  // Reset timer without starting
  const reset = useCallback((totalSeconds: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTotalTime(totalSeconds);
    setTimeRemaining(totalSeconds);
    setIsRunning(false);
    setIsPaused(false);
    timerRef.current = { remaining: totalSeconds, total: totalSeconds, silent: false };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    start,
    stop,
    pause,
    resume,
    reset,
    timeRemaining,
    totalTime,
    isRunning,
    isPaused,
    progress,
  };
}
