import React, { useLayoutEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

// One figure on one line, at the largest font size between `min` and `max` (px) that fits the
// width it is given. A large amount therefore shrinks instead of running out of its card; if
// it is too long even at the minimum size it wraps, so no digit is ever cut off. The full
// value is also the tooltip.
//
// An invisible copy at the maximum size gives the natural width; the visible copy is scaled
// from it. A ResizeObserver repeats this when the card changes width (window resize, sidebar
// open/closed).
const FitText = ({ children, max = 34, min = 13, sx }) => {
  const boxRef = useRef(null);
  const measureRef = useRef(null);
  const [fontSize, setFontSize] = useState(max);
  const [wrap, setWrap] = useState(false);
  const text = String(children ?? '');

  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return undefined;

    const fit = () => {
      const available = box.clientWidth;
      const natural = measure.offsetWidth;
      if (!available || !natural) return;
      const scaled = Math.floor((available / natural) * max);
      const next = Math.max(min, Math.min(max, scaled));
      setFontSize(next);
      setWrap(scaled < min);
    };

    fit();
    // The first measurement can happen before the web font has loaded.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit).catch(() => {});
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text, max, min]);

  return (
    <Box
      ref={boxRef}
      title={text}
      sx={{ position: 'relative', width: '100%', minWidth: 0, overflow: 'hidden', fontWeight: 700, lineHeight: 1.25, ...sx }}
    >
      <span
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none',
          whiteSpace: 'nowrap', fontSize: max,
        }}
      >
        {text}
      </span>
      <span
        style={{
          display: 'block', fontSize,
          whiteSpace: wrap ? 'normal' : 'nowrap', overflowWrap: 'anywhere',
        }}
      >
        {text}
      </span>
    </Box>
  );
};

export default FitText;
