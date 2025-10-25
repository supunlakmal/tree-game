"use client";

import { MouseEvent, MutableRefObject, PointerEvent, useCallback, useEffect } from "react";

import { GameEngine } from "@/lib/game/GameEngine";

interface MobileControlsProps {
  engineRef: MutableRefObject<GameEngine | null>;
  disabled?: boolean;
}

const CONTROL_MAP = {
  left: 37,
  right: 39,
  forward: 38,
  backward: 40,
} as const;

export function MobileControls({ engineRef, disabled = false }: MobileControlsProps) {
  const updateKeyState = useCallback(
    (keyCode: number, isPressed: boolean) => {
      if (disabled) return;
      engineRef.current?.setKeyState(keyCode, isPressed);
    },
    [disabled, engineRef]
  );

  const handlePointerDown = useCallback(
    (keyCode: number) => (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updateKeyState(keyCode, true);
    },
    [updateKeyState]
  );

  const handlePointerEnd = useCallback(
    (keyCode: number) => (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      updateKeyState(keyCode, false);
    },
    [updateKeyState]
  );

  const handlePointerCancel = useCallback(
    (keyCode: number) => () => {
      updateKeyState(keyCode, false);
    },
    [updateKeyState]
  );

  const handleContextMenu = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(CONTROL_MAP).forEach((code) => {
        engineRef.current?.setKeyState(code, false);
      });
    };
  }, [engineRef]);

  useEffect(() => {
    if (!disabled) {
      return;
    }
    Object.values(CONTROL_MAP).forEach((code) => {
      engineRef.current?.setKeyState(code, false);
    });
  }, [disabled, engineRef]);

  return (
    <div className="mobile-controls">
      <div className="mobile-controls__group mobile-controls__group--left">
        <button
          type="button"
          aria-label="Turn left"
          className="mobile-controls__button mobile-controls__button--left"
          onPointerDown={handlePointerDown(CONTROL_MAP.left)}
          onPointerUp={handlePointerEnd(CONTROL_MAP.left)}
          onPointerLeave={handlePointerCancel(CONTROL_MAP.left)}
          onPointerCancel={handlePointerCancel(CONTROL_MAP.left)}
          onContextMenu={handleContextMenu}
        >
          <span aria-hidden className="mobile-controls__icon" />
        </button>
        <button
          type="button"
          aria-label="Turn right"
          className="mobile-controls__button mobile-controls__button--right"
          onPointerDown={handlePointerDown(CONTROL_MAP.right)}
          onPointerUp={handlePointerEnd(CONTROL_MAP.right)}
          onPointerLeave={handlePointerCancel(CONTROL_MAP.right)}
          onPointerCancel={handlePointerCancel(CONTROL_MAP.right)}
          onContextMenu={handleContextMenu}
        >
          <span aria-hidden className="mobile-controls__icon" />
        </button>
      </div>
      <div className="mobile-controls__group mobile-controls__group--right">
        <button
          type="button"
          aria-label="Accelerate"
          className="mobile-controls__button mobile-controls__button--up"
          onPointerDown={handlePointerDown(CONTROL_MAP.forward)}
          onPointerUp={handlePointerEnd(CONTROL_MAP.forward)}
          onPointerLeave={handlePointerCancel(CONTROL_MAP.forward)}
          onPointerCancel={handlePointerCancel(CONTROL_MAP.forward)}
          onContextMenu={handleContextMenu}
        >
          <span aria-hidden className="mobile-controls__icon" />
        </button>
        <button
          type="button"
          aria-label="Reverse"
          className="mobile-controls__button mobile-controls__button--down"
          onPointerDown={handlePointerDown(CONTROL_MAP.backward)}
          onPointerUp={handlePointerEnd(CONTROL_MAP.backward)}
          onPointerLeave={handlePointerCancel(CONTROL_MAP.backward)}
          onPointerCancel={handlePointerCancel(CONTROL_MAP.backward)}
          onContextMenu={handleContextMenu}
        >
          <span aria-hidden className="mobile-controls__icon" />
        </button>
      </div>
    </div>
  );
}
