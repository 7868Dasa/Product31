import { useState, useEffect } from 'react';
import { qrDataUrl } from '../lib/qr.js';

/** Renders a QR code for `text` as an <img>. `qrcode` is async, so resolve it in an effect. */
export function QrImage({ text, size = 512, className = '', alt = 'QR code' }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let alive = true;
    qrDataUrl(text, { width: size })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [text, size]);

  return src ? (
    <img src={src} alt={alt} className={className} />
  ) : (
    <div className={`animate-pulse bg-sand ${className}`} aria-hidden="true" />
  );
}
