// Profile transfer by QR codes: the progress export packed (history in columns), deflated, base64url-encoded and cut into frames.
// Each frame is a URL, so a phone's own camera app can open the receive page from any frame; the in-app scanner collects the rest.
import type { Response } from '../engine/grade';
import type { AttemptRecord, ProgressData } from '../store/progress';

/** Characters of payload per QR frame: about a version 25 code at level M (15% of a code can be blurred or glared), still easy to read off a screen. */
export const CHUNK = 900;
/** The quick transfer keeps this many recent answers (enough for the dashboard's streak, accuracy and today's count). */
export const QUICK_HISTORY = 200;

interface PackedHistory {
  /** Template ids, and the skill of each (records of a template share its skill). */
  tpl: string[];
  sk: string[];
  /** Per record: template index, seed, difficulty, flags (1 correct, 2 hinted, 4 section), time in ms, and `at` as a delta from the previous record. */
  t: number[];
  s: number[];
  d: number[];
  f: number[];
  ms: number[];
  at: number[];
  /** Trap ids, then [record, trap indexes…] for records that hit traps. */
  trap: string[];
  tr: number[][];
  /** Sparse: [record, response] and [record, qid] when the qid does not follow `${templateId}#${seed}#${difficulty}`, [record, skillId] when it differs from its template's. */
  r: [number, Response][];
  q: [number, string][];
  k: [number, string][];
}

interface Packed {
  v: 1;
  p: Omit<ProgressData, 'history'>;
  h: PackedHistory;
}

export function packHistory(history: AttemptRecord[]): PackedHistory {
  const h: PackedHistory = { tpl: [], sk: [], t: [], s: [], d: [], f: [], ms: [], at: [], trap: [], tr: [], r: [], q: [], k: [] };
  const tplIdx = new Map<string, number>();
  const trapIdx = new Map<string, number>();
  let prev = 0;
  history.forEach((rec, i) => {
    let ti = tplIdx.get(rec.templateId);
    if (ti === undefined) {
      ti = h.tpl.length;
      tplIdx.set(rec.templateId, ti);
      h.tpl.push(rec.templateId);
      h.sk.push(rec.skillId);
    }
    if (h.sk[ti] !== rec.skillId) h.k.push([i, rec.skillId]);
    const m = /^(.*)#(\d+)#(\d+)$/.exec(rec.qid);
    if (m && m[1] === rec.templateId && String(Number(m[2])) === m[2] && String(Number(m[3])) === m[3]) {
      h.s.push(Number(m[2]));
      h.d.push(Number(m[3]));
    } else {
      h.s.push(-1);
      h.d.push(0);
      h.q.push([i, rec.qid]);
    }
    h.t.push(ti);
    h.f.push((rec.correct ? 1 : 0) | (rec.hinted ? 2 : 0) | (rec.mode === 'section' ? 4 : 0));
    h.ms.push(rec.timeMs);
    h.at.push(rec.at - prev);
    prev = rec.at;
    if (rec.traps.length) {
      h.tr.push([
        i,
        ...rec.traps.map((id) => {
          let x = trapIdx.get(id);
          if (x === undefined) {
            x = h.trap.length;
            trapIdx.set(id, x);
            h.trap.push(id);
          }
          return x;
        }),
      ]);
    }
    if (rec.response !== undefined) h.r.push([i, rec.response]);
  });
  return h;
}

export function unpackHistory(h: PackedHistory): AttemptRecord[] {
  const traps = new Map(h.tr.map(([i, ...xs]) => [i, xs.map((x) => h.trap[x])]));
  const responses = new Map(h.r);
  const qids = new Map(h.q);
  const skills = new Map(h.k);
  let at = 0;
  return h.t.map((ti, i) => {
    at += h.at[i];
    const templateId = h.tpl[ti];
    const rec: AttemptRecord = {
      qid: qids.get(i) ?? `${templateId}#${h.s[i]}#${h.d[i]}`,
      skillId: skills.get(i) ?? h.sk[ti],
      templateId,
      correct: (h.f[i] & 1) !== 0,
      timeMs: h.ms[i],
      at,
      mode: h.f[i] & 4 ? 'section' : 'practice',
      traps: traps.get(i) ?? [],
      hinted: (h.f[i] & 2) !== 0,
    };
    const r = responses.get(i);
    if (r !== undefined) rec.response = r;
    return rec;
  });
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The progress as one compact text (deflate-raw + base64url). */
export async function encodeProfile(data: ProgressData): Promise<string> {
  const { history, ...rest } = data;
  const packed: Packed = { v: 1, p: rest, h: packHistory(history) };
  return toBase64Url(await pipe(new TextEncoder().encode(JSON.stringify(packed)), new CompressionStream('deflate-raw')));
}

/** Back to a progress export (still to be validated by importData). Throws on anything that is not a packed profile. */
export async function decodeProfile(text: string): Promise<ProgressData> {
  const json = new TextDecoder().decode(await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw')));
  const packed = JSON.parse(json) as Packed;
  if (!packed || packed.v !== 1 || !packed.p || !packed.h) throw new Error('Not a GRE Trainer profile.');
  return { ...packed.p, history: unpackHistory(packed.h) } as ProgressData;
}

export interface Frame {
  id: string;
  index: number;
  total: number;
  chunk: string;
}

const FRAME_RE = /#\/receive\/([a-z0-9]{4})\.(\d+)\.(\d+)\.([A-Za-z0-9_-]+)$/;

/** The texts to show as QR codes, each a link to the receive page of the app at `base` (origin + path). */
export function toFrames(payload: string, base: string, id = Math.random().toString(36).slice(2, 6).padEnd(4, '0')): string[] {
  const total = Math.max(1, Math.ceil(payload.length / CHUNK));
  return Array.from({ length: total }, (_, i) => `${base}#/receive/${id}.${i + 1}.${total}.${payload.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}

export function parseFrame(text: string): Frame | null {
  const m = FRAME_RE.exec(text.trim());
  if (!m) return null;
  const index = Number(m[2]);
  const total = Number(m[3]);
  if (!(index >= 1 && index <= total && total <= 10000)) return null;
  return { id: m[1], index, total, chunk: m[4] };
}

/** Gathers frames of one transfer; a frame of another transfer starts over. */
export class Collector {
  id?: string;
  total = 0;
  parts = new Map<number, string>();

  /** True when the frame was new. */
  add(f: Frame): boolean {
    if (f.id !== this.id || f.total !== this.total) {
      this.id = f.id;
      this.total = f.total;
      this.parts = new Map();
    }
    if (this.parts.has(f.index)) return false;
    this.parts.set(f.index, f.chunk);
    return true;
  }

  get done(): boolean {
    return this.total > 0 && this.parts.size === this.total;
  }

  payload(): string {
    return Array.from({ length: this.total }, (_, i) => this.parts.get(i + 1) ?? '').join('');
  }
}
