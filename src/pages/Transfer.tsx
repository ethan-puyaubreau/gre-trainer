import { useEffect, useMemo, useRef, useState } from 'react';
import { encode } from 'uqr';
import { go, href } from '../router';
import { exportProgress, isProgressData, useProgress, type ProgressData } from '../store/progress';
import { Collector, decodeProfile, encodeProfile, parseFrame, QUICK_HISTORY, toFrames } from '../transfer/codec';
import '../fx-transfer.css';

const SPEEDS: [number, string][] = [
  [2, 'Slow'],
  [4, 'Normal'],
  [7, 'Fast'],
];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** #/transfer, #/transfer/send, #/transfer/receive, and #/receive/<frame> (a frame opened by a phone's camera app). */
export function Transfer({ route }: { route: string[] }) {
  if (route[0] === 'receive') return <Receive initial={route[1]} />;
  if (route[1] === 'send') return <Send />;
  if (route[1] === 'receive') return <Receive />;
  return (
    <div className="transfer">
      <h1>Move your progress</h1>
      <p className="muted">Copy everything you have done here to another device with QR codes. Nothing goes through a server.</p>
      <div className="grid grid-3">
        <a className="card transfer-pick" href={href('transfer', 'send')}>
          <h3>Send from this device</h3>
          <p className="muted small">Shows a short animation of QR codes for the other device to scan.</p>
        </a>
        <a className="card transfer-pick" href={href('transfer', 'receive')}>
          <h3>Receive on this device</h3>
          <p className="muted small">Uses this device's camera to read the codes shown on the other one.</p>
        </a>
      </div>
    </div>
  );
}

/** One QR code as an SVG path (one path is far lighter to redraw than a rect per module). */
function QrCode({ text }: { text: string }) {
  const { path, size } = useMemo(() => {
    const qr = encode(text, { ecc: 'M', border: 3 });
    let d = '';
    qr.data.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        if (!row[x]) {
          x++;
          continue;
        }
        const start = x;
        while (x < row.length && row[x]) x++;
        d += `M${start} ${y}h${x - start}v1h${start - x}z`;
      }
    });
    return { path: d, size: qr.size };
  }, [text]);
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label="QR code">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

function Send() {
  const history = useProgress((s) => s.history.length);
  const [full, setFull] = useState(true);
  const [payloads, setPayloads] = useState<{ full: string; quick: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(4);
  const [paused, setPaused] = useState(false);
  const [idx, setIdx] = useState(0);
  const base = window.location.origin + window.location.pathname;

  useEffect(() => {
    let live = true;
    const data = JSON.parse(exportProgress()) as ProgressData;
    Promise.all([encodeProfile(data), encodeProfile({ ...data, history: data.history.slice(-QUICK_HISTORY) })])
      .then(([f, q]) => live && setPayloads({ full: f, quick: q }))
      .catch((e: Error) => live && setError(e.message || 'This browser cannot compress the data.'));
    return () => {
      live = false;
    };
  }, []);

  const frames = useMemo(() => (payloads ? { full: toFrames(payloads.full, base), quick: toFrames(payloads.quick, base) } : null), [payloads, base]);
  const shown = frames ? (full || history <= QUICK_HISTORY ? frames.full : frames.quick) : [];

  useEffect(() => setIdx(0), [full]);
  useEffect(() => {
    if (paused || shown.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % shown.length), 1000 / fps);
    return () => clearInterval(t);
  }, [paused, fps, shown.length]);

  if (error) return <p className="card">Could not prepare the codes: {error}</p>;
  if (!frames) return <p className="muted">Preparing the codes…</p>;
  const i = Math.min(idx, shown.length - 1);
  const seconds = Math.ceil(shown.length / fps);

  return (
    <div className="transfer">
      <h1>Send your progress</h1>
      <div className="transfer-send">
        <div className="transfer-qr-wrap">
          <QrCode text={shown[i]} />
          <div className="transfer-counter" aria-live="off">
            Code {i + 1} of {shown.length}
          </div>
          <div className="progress" aria-hidden="true">
            <div style={{ width: `${((i + 1) / shown.length) * 100}%` }} />
          </div>
        </div>
        <div className="transfer-side">
          <ol className="transfer-steps small">
            <li>
              On the other device, open <b>{base.replace(/^https?:\/\//, '')}</b>, then <b>Settings → Receive from another device</b>. Or simply point its camera app
              at this code.
            </li>
            <li>Hold it 20–40 cm from this screen until every code is received{shown.length > 1 ? ` (one loop takes about ${seconds} s)` : ''}.</li>
            <li>Confirm on the other device. This device keeps its own copy.</li>
          </ol>

          {history > QUICK_HISTORY && (
            <fieldset className="transfer-field">
              <legend>What to send</legend>
              <label className="transfer-radio">
                <input type="radio" checked={full} onChange={() => setFull(true)} /> Everything ({plural(history, 'answer')}, {plural(frames.full.length, 'code')})
              </label>
              <label className="transfer-radio">
                <input type="radio" checked={!full} onChange={() => setFull(false)} /> Quick: all skill levels and reviews, last {QUICK_HISTORY} answers ({plural(frames.quick.length, 'code')})
              </label>
            </fieldset>
          )}

          {shown.length > 1 && (
            <div className="row">
              <div className="tabs" role="group" aria-label="Speed">
                {SPEEDS.map(([v, label]) => (
                  <button key={v} className={fps === v ? 'on' : ''} aria-pressed={fps === v} onClick={() => setFps(v)}>
                    {label}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => setPaused((p) => !p)}>
                {paused ? 'Play' : 'Pause'}
              </button>
              {paused && (
                <>
                  <button className="btn" onClick={() => setIdx((i - 1 + shown.length) % shown.length)} aria-label="Previous code">
                    ←
                  </button>
                  <button className="btn" onClick={() => setIdx((i + 1) % shown.length)} aria-label="Next code">
                    →
                  </button>
                </>
              )}
            </div>
          )}
          <p className="muted small">
            Codes hard to read? Turn up this screen's brightness, choose Slow, or use <a href={href('settings')}>Export progress</a> to send a file instead.
          </p>
        </div>
      </div>
    </div>
  );
}

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/** The browser's own QR reader when it has one (Chrome, Android), else jsQR on a canvas (Safari, Firefox). */
async function makeDetector(): Promise<(video: HTMLVideoElement) => Promise<string[]>> {
  const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (BD && (await BD.getSupportedFormats().catch((): string[] => [])).includes('qr_code')) {
    const d = new BD({ formats: ['qr_code'] });
    return async (v) => (await d.detect(v)).map((c) => c.rawValue);
  }
  const jsQR = (await import('jsqr')).default;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // Dense codes need pixels: alternate a full-resolution centre square (where the code usually is) and the whole frame scaled down.
  let turn = 0;
  return async (v) => {
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh) return [];
    const centre = turn++ % 2 === 0;
    const side = Math.min(vw, vh);
    const [sx, sy, sw, sh] = centre ? [(vw - side) / 2, (vh - side) / 2, side, side] : [0, 0, vw, vh];
    const k = Math.min(1, (centre ? 900 : 1100) / Math.max(sw, sh));
    canvas.width = Math.round(sw * k);
    canvas.height = Math.round(sh * k);
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    return code ? [code.data] : [];
  };
}

function summary(d: ProgressData) {
  const skills = Object.values(d.skills);
  return {
    answers: d.history.length,
    started: skills.filter((s) => s.attempts > 0).length,
    mastered: skills.filter((s) => s.level === 4).length,
    last: d.history.length ? new Date(d.history[d.history.length - 1].at).toLocaleDateString() : null,
  };
}

function Receive({ initial }: { initial?: string }) {
  const local = useProgress((s) => s.history.length);
  const importData = useProgress((s) => s.importData);
  const collector = useRef(new Collector());
  const [count, setCount] = useState({ got: 0, total: 0 });
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProgressData | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setScanning(false);
  };

  const finish = async () => {
    stop();
    try {
      const data = await decodeProfile(collector.current.payload());
      if (!isProgressData(data)) throw new Error('not a profile');
      setResult(data);
    } catch {
      collector.current = new Collector();
      setCount({ got: 0, total: 0 });
      setError('The codes could not be read as a profile. Start the scan again.');
    }
  };

  const take = (text: string) => {
    const f = parseFrame(text);
    if (!f) return false;
    const c = collector.current;
    if (c.add(f)) {
      setCount({ got: c.parts.size, total: c.total });
      navigator.vibrate?.(8);
    }
    if (c.done) void finish();
    return true;
  };

  // A frame opened from the phone's camera app: keep it and clear it from the address bar.
  useEffect(() => {
    if (initial && take(`#/receive/${initial}`)) {
      history.replaceState(null, '', window.location.pathname + window.location.search + '#/transfer/receive');
      if (!collector.current.done) void start();
    }
    return stop;
    // Mount only.
  }, []);

  const start = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      stream.current = s;
      setScanning(true);
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      const detect = await makeDetector();
      const loop = async () => {
        if (!stream.current || collector.current.done) return;
        try {
          if (v.readyState >= 2) for (const t of await detect(v)) take(t);
        } catch {
          // A frame that fails to decode is just skipped.
        }
        setTimeout(loop, 60);
      };
      void loop();
    } catch (e) {
      stop();
      console.warn('Camera start failed', e);
      const name = (e as Error).name;
      setError(
        name === 'NotAllowedError'
          ? 'Camera access was refused. Allow it in the browser settings, or use Settings → Import progress with an exported file.'
          : 'No camera could be opened on this device. Use Settings → Import progress with an exported file instead.',
      );
    }
  };

  if (result) {
    const r = summary(result);
    return (
      <div className="transfer">
        <h1>Progress received</h1>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            <b>{plural(r.answers, 'answer')}</b>, {plural(r.started, 'skill')} started, {r.mastered} mastered{r.last ? `, last practice on ${r.last}` : ''}.
          </p>
          {local > 0 && (
            <p className="small" style={{ color: 'var(--warn)' }}>
              This replaces the {plural(local, 'answer')} already in this browser.
            </p>
          )}
          <div className="row">
            <button
              className="btn btn-primary btn-big"
              onClick={() => {
                try {
                  importData(result);
                  go();
                } catch (e) {
                  setError((e as Error).message);
                  setResult(null);
                }
              }}
            >
              {local > 0 ? 'Replace my progress' : 'Use this progress'}
            </button>
            <a className="btn btn-ghost" href={href()}>
              Cancel
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { got, total } = count;
  return (
    <div className="transfer">
      <h1>Receive progress</h1>
      <p className="muted">
        On the other device, open <b>Settings → Send to another device</b>, then point this camera at its screen.
      </p>
      <div className="transfer-camera card">
        <video ref={video} playsInline muted className={scanning ? '' : 'is-off'} />
        {!scanning && (
          <button className="btn btn-primary btn-big" onClick={() => void start()}>
            {got ? 'Resume scanning' : 'Start the camera'}
          </button>
        )}
        {total > 0 && (
          <div className="transfer-status" aria-live="polite">
            <b>
              {got} / {total}
            </b>{' '}
            codes received
            <div className="transfer-tiles" aria-hidden="true">
              {Array.from({ length: total }, (_, i) => (
                <i key={i} className={collector.current.parts.has(i + 1) ? 'on' : ''} />
              ))}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="small" style={{ color: 'var(--bad)' }} role="alert">
          {error}
        </p>
      )}
      {scanning && (
        <button className="btn" onClick={stop}>
          Stop the camera
        </button>
      )}
    </div>
  );
}
