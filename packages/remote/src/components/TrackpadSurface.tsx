import { useEffect, useRef, useCallback, useState } from 'react';
import { createPointerCoalescer, TRACKPAD_TAP_SLOP, TRACKPAD_TAP_MAX_MS } from '../pointer-coalesce';
import type { WsClient } from '../ws-client';
import type { InputCommand } from '@coosy/shared';

type ConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';

interface TrackpadSurfaceProps {
  client: WsClient;
  status: ConnectionStatus;
  onToast: (toast: { message: string; ok: boolean }) => void;
}

export function TrackpadSurface({ client, status, onToast }: TrackpadSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(status);
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const [scrollMode, setScrollMode] = useState(false);

  const touchState = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
    isTwoFinger: false,
  });

  const coalescer = useRef<ReturnType<typeof createPointerCoalescer> | null>(null);

  const sendInput = useCallback((cmd: InputCommand, awaitResult = false) => {
    if (status !== 'CONNECTED') return;
    client.sendInput(cmd, { awaitResult }).catch(err => {
      onToast({ message: `Input error: ${err.message}`, ok: false });
    });
  }, [client, status, onToast]);

  useEffect(() => {
    coalescer.current = createPointerCoalescer({
      send: (cmd) => sendInput(cmd),
      isActive: () => statusRef.current === 'CONNECTED'
    });
    return () => {
      coalescer.current?.dispose();
    };
  }, [sendInput]);

  useEffect(() => {
    client.onCursorPosition((payload) => {
      setCursor({
        x: payload.viewWidth > 0 ? payload.x / payload.viewWidth : 0,
        y: payload.viewHeight > 0 ? payload.y / payload.viewHeight : 0,
      });
    });
  }, [client]);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    
    // Prevent default touch behaviors like scrolling and zooming
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });
    el.addEventListener('touchend', prevent, { passive: false });
    el.addEventListener('touchcancel', prevent, { passive: false });
    
    return () => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('touchmove', prevent);
      el.removeEventListener('touchend', prevent);
      el.removeEventListener('touchcancel', prevent);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const isTwo = e.touches.length >= 2;
    const [cx, cy] = isTwo
      ? [
          (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2,
          (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2,
        ]
      : [e.touches[0]!.clientX, e.touches[0]!.clientY];
    touchState.current = {
      startX: cx,
      startY: cy,
      lastX: cx,
      lastY: cy,
      startTime: Date.now(),
      isTwoFinger: isTwo,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 0 || !coalescer.current) return;

    if (e.touches.length >= 2) {
      touchState.current.isTwoFinger = true;
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      const centerX = (t0.clientX + t1.clientX) / 2;
      const centerY = (t0.clientY + t1.clientY) / 2;
      const dx = centerX - touchState.current.lastX;
      const dy = centerY - touchState.current.lastY;
      touchState.current.lastX = centerX;
      touchState.current.lastY = centerY;
      coalescer.current.scroll(dx, dy);
      return;
    }

    const touch = e.touches[0]!;
    const dx = touch.clientX - touchState.current.lastX;
    const dy = touch.clientY - touchState.current.lastY;
    touchState.current.lastX = touch.clientX;
    touchState.current.lastY = touch.clientY;
    if (scrollMode) {
      coalescer.current.scroll(dx, dy);
    } else {
      coalescer.current.move(dx, dy);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const { startX, startY, startTime, isTwoFinger } = touchState.current;
    if (isTwoFinger) return;
    
    if (e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0]!;
    
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const time = Date.now() - startTime;
    
    if (dist <= TRACKPAD_TAP_SLOP && time <= TRACKPAD_TAP_MAX_MS) {
      sendInput({ type: 'pointer-click', button: 'left' }, true);
    }
  };

  return (
    <div
      ref={surfaceRef}
      className="trackpad-surface"
      style={{
        flex: 1,
        width: '100%',
        backgroundColor: 'var(--muted)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={e => e.preventDefault()}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={() => setScrollMode(false)}
          style={{
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '4px 10px',
            background: !scrollMode ? 'rgba(255,255,255,0.14)' : 'transparent',
            color: 'var(--fg)',
          }}
        >
          Move
        </button>
        <button
          type="button"
          onClick={() => setScrollMode(true)}
          style={{
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '4px 10px',
            background: scrollMode ? 'rgba(255,255,255,0.14)' : 'transparent',
            color: 'var(--fg)',
          }}
        >
          Scroll
        </button>
      </div>
      <span style={{ color: 'var(--fg)', fontSize: '1.2rem', fontWeight: 500, opacity: 0.5 }}>
        Trackpad
      </span>
      <span style={{ color: 'var(--fg)', fontSize: '0.85rem', opacity: 0.4, marginTop: '8px' }}>
        Slide to move pointer &middot; Tap to click
      </span>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: `${Math.min(Math.max(cursor.x, 0), 1) * 100}%`,
          top: `${Math.min(Math.max(cursor.y, 0), 1) * 100}%`,
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.9)',
          boxShadow: '0 0 0 2px rgba(0,0,0,0.2)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button type="button" onClick={() => sendInput({ type: 'pointer-scroll', dx: -80, dy: 0 }, false)}>
          ◀
        </button>
        <button type="button" onClick={() => sendInput({ type: 'pointer-scroll', dx: 80, dy: 0 }, false)}>
          ▶
        </button>
      </div>
    </div>
  );
}
