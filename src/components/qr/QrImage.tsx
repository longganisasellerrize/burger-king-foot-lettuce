import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Alert } from '../ui';

/** Renders `text` as a QR code image (generated locally, no network). */
export function QrImage({ text, label, size = 320 }: { text: string; label: string; size?: number }) {
  const [state, setState] = useState<{ url: string | null; error: string | null }>({ url: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ url: null, error: null });
    QRCode.toDataURL(text, { width: size, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } })
      .then((url) => !cancelled && setState({ url, error: null }))
      .catch(() => !cancelled && setState({ url: null, error: 'Could not generate the QR code.' }));
    return () => {
      cancelled = true;
    };
  }, [text, size]);

  if (state.error) return <Alert kind="error">{state.error}</Alert>;
  if (!state.url)
    return (
      <div style={{ width: size, maxWidth: '100%', aspectRatio: '1', display: 'grid', placeItems: 'center' }} aria-busy="true">
        <div className="spinner" />
        <span className="sr-only">Generating QR code…</span>
      </div>
    );
  return <img src={state.url} alt={label} width={size} height={size} />;
}
