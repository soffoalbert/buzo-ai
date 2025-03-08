import { useEffect, useRef } from 'react';

/**
 * A custom hook that provides a declarative way to set up an interval.
 * @param callback The function to call on each interval
 * @param delay The delay in milliseconds (or null to pause)
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }
    
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
    
    // No cleanup needed if delay is null
    return undefined;
  }, [delay]);
} 