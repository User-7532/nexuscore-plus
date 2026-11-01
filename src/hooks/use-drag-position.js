import { useCallback, useRef, useState } from 'react';

// 要素をドラッグ／スワイプで動かすための最小限のフック。
// 返す offset を transform に当て、dragProps を「つかむ部分」に渡す。
export default function useDragPosition(margin = 8) {
  const ref = useRef(null);
  const start = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      start.current = {
        px: e.clientX,
        py: e.clientY,
        ox: offset.x,
        oy: offset.y,
        left: rect.left - offset.x,
        top: rect.top - offset.y,
        width: rect.width,
        height: rect.height,
      };
      setDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [offset.x, offset.y]
  );

  const onPointerMove = useCallback(
    (e) => {
      const s = start.current;
      if (!s) return;
      const minX = margin - s.left;
      const maxX = window.innerWidth - margin - (s.left + s.width);
      const minY = margin - s.top;
      const maxY = window.innerHeight - margin - (s.top + s.height);
      const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
      setOffset({
        x: clamp(s.ox + (e.clientX - s.px), minX, maxX),
        y: clamp(s.oy + (e.clientY - s.py), minY, maxY),
      });
    },
    [margin]
  );

  const onPointerUp = useCallback((e) => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  const reset = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  return {
    ref,
    offset,
    dragging,
    reset,
    dragProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
