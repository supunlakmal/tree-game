import { RefObject, useEffect, useRef } from "react";

import { GameEngine } from "./GameEngine";

export interface UseGameEngineOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  onHit: (hits: number) => void;
  enabled?: boolean;
}

export function useGameEngine({ containerRef, onHit, enabled = true }: UseGameEngineOptions) {
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) return;

    const engine = new GameEngine({
      container,
      onHit,
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [containerRef, enabled, onHit]);

  return engineRef;
}
