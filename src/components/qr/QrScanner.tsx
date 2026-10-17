import jsQR from 'jsqr';
import { Camera, CameraOff, ImageUp, Keyboard, RefreshCw, SwitchCamera } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert } from '../ui';

type CamState = 'idle' | 'starting' | 'active' | 'error';

interface Props {
  /** Called with the decoded text of each new QR code. */
  onDetect: (text: string) => void;
  /** Optional ready-made codes for testing without a camera (shown as "simulated scan"). */
  simulateOptions?: { label: string; value: string }[];
}

const SAME_CODE_COOLDOWN_MS = 4000;

function decodeImageData(data: ImageData): string | null {
  return jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
}

/**
 * Camera QR scanner. Uses getUserMedia + jsQR, so it works in any modern
 * browser that allows camera access (HTTPS or localhost is required by
 * browsers). Fallbacks: decode an uploaded photo/screenshot, or a clearly
 * labeled simulated scan for demonstrations.
 */
export function QrScanner({ onDetect, simulateOptions }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const [cam, setCam] = useState<CamState>('idle');
  const [camError, setCamError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [fileError, setFileError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [sim, setSim] = useState('');

  const emit = useCallback((text: string) => {
    const now = Date.now();
    if (text === lastRef.current.text && now - lastRef.current.at < SAME_CODE_COOLDOWN_MS) return;
    lastRef.current = { text, at: now };
    if ('vibrate' in navigator) navigator.vibrate?.(60);
    onDetectRef.current(text);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(
    async (mode: 'environment' | 'user') => {
      stop();
      setCamError(null);
      if (!window.isSecureContext) {
        setCam('error');
        setCamError('Camera access requires a secure connection (HTTPS or localhost). Use “Upload a photo” instead.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCam('error');
        setCamError('This browser does not support camera access. Use “Upload a photo” instead.');
        return;
      }
      setCam('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setCam('active');
        canvasRef.current ??= document.createElement('canvas');
        timerRef.current = window.setInterval(() => {
          const v = videoRef.current;
          const canvas = canvasRef.current;
          if (!v || !canvas || v.readyState < 2 || !v.videoWidth) return;
          const scale = Math.min(1, 720 / v.videoWidth);
          canvas.width = Math.round(v.videoWidth * scale);
          canvas.height = Math.round(v.videoHeight * scale);
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const text = decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
          if (text) emit(text);
        }, 180);
      } catch (e) {
        stop();
        setCam('error');
        const name = (e as DOMException)?.name;
        setCamError(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings, or upload a photo of the QR code.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'No camera was found on this device. Upload a photo of the QR code instead.'
              : name === 'NotReadableError'
                ? 'The camera is being used by another app. Close it and try again.'
                : 'The camera could not be started. Try again or upload a photo of the QR code.',
        );
      }
    },
    [emit, stop],
  );

  useEffect(() => stop, [stop]);

  const onFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) return setFileError('Please choose an image file.');
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const text = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' })?.data;
      if (!text) return setFileError('No QR code was found in that image. Make sure the whole code is visible and in focus.');
      lastRef.current = { text: '', at: 0 };
      emit(text);
    } catch {
      setFileError('That image could not be read.');
    }
  };

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    if (!manual.trim()) return;
    lastRef.current = { text: '', at: 0 };
    emit(manual.trim());
    setManual('');
  };

  return (
    <div className="form">
      <div className="scanner">
        <video ref={videoRef} playsInline muted aria-label="Camera preview" style={{ display: cam === 'active' ? 'block' : 'none' }} />
        {cam === 'active' && (
          <>
            <div className="frame" aria-hidden />
            <div className="scanline" aria-hidden />
          </>
        )}
        {cam !== 'active' && (
          <div className="scanner-placeholder">
            {cam === 'starting' ? (
              <>
                <div className="spinner" />
                <span>Starting camera…</span>
              </>
            ) : cam === 'error' ? (
              <>
                <CameraOff size={36} aria-hidden />
                <span>Camera unavailable</span>
              </>
            ) : (
              <>
                <Camera size={36} aria-hidden />
                <span>Point the camera at the QR code</span>
                <button className="btn btn-primary" onClick={() => start(facing)}>
                  <Camera size={16} aria-hidden /> Start camera
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {camError && (
        <Alert kind="error">
          {camError}{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => start(facing)}>
            <RefreshCw size={14} aria-hidden /> Try again
          </button>
        </Alert>
      )}

      <div className="toolbar">
        {cam === 'active' && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { stop(); setCam('idle'); }}>
              <CameraOff size={14} aria-hidden /> Stop camera
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const next = facing === 'environment' ? 'user' : 'environment';
                setFacing(next);
                start(next);
              }}
            >
              <SwitchCamera size={14} aria-hidden /> Switch camera
            </button>
          </>
        )}
        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
          <ImageUp size={14} aria-hidden /> Upload a photo
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {fileError && <Alert kind="error">{fileError}</Alert>}

      <details>
        <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>
          <Keyboard size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Enter the code manually
        </summary>
        <form className="toolbar" style={{ marginTop: 8 }} onSubmit={submitManual}>
          <input className="input search" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="BSHS-ATT:…" aria-label="QR code text" />
          <button className="btn btn-secondary" type="submit">
            Submit code
          </button>
        </form>
      </details>

      {simulateOptions && simulateOptions.length > 0 && (
        <div className="alert alert-warn" style={{ display: 'grid', gap: 8 }}>
          <div>
            <span className="tag-sim">Simulated</span> <strong className="small">Test without a camera</strong>
            <div className="small">Sends the code below through the same validation as a real scan. For demonstrations only.</div>
          </div>
          <div className="toolbar">
            <select className="select search" value={sim} onChange={(e) => setSim(e.target.value)} aria-label="Code to simulate">
              <option value="">Choose a code…</option>
              {simulateOptions.map((o) => (
                <option key={o.value + o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              className="btn btn-secondary"
              disabled={!sim}
              onClick={() => {
                lastRef.current = { text: '', at: 0 };
                emit(sim);
              }}
            >
              Simulate scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
