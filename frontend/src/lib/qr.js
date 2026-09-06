import QRCode from 'qrcode';

/** Permanent deep link for a shop (spec §11.1). Routes to /s/:slug. */
export function shopShareUrl(slug) {
  const base = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  return `${base.replace(/\/+$/, '')}/s/${slug}`;
}

/** QR as a PNG data URL, for <img> and the printable poster. */
export function qrDataUrl(text, { width = 512 } = {}) {
  return QRCode.toDataURL(text, {
    width,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#1c1917', light: '#ffffff' },
  });
}
