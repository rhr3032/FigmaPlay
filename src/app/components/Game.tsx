import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import svgPaths from '../../imports/svg-w09yvkuc83';
import lpSvgPaths from '../../imports/svg-my6guobuh2';
import imgScreenshot from '../../assets/093a4ebddcd379072e8f7fe63f6e7e990abe8896.png';
import figBodyPaths from '../../imports/svg-kptws7npje';
import imgImage2 from '../../assets/8a984b9e6abca0bb15173f5e519b58e71cdee2bf.png';
import imgRectangle65 from '../../assets/d8801f18148756b4eed0730652f8ddb0c500ae5b.png';
import imgRectangle66 from '../../assets/57ec10000f4bad2c74b1f5dc307f797ebb6e3eef.png';
import { Timer, Skull, Wrench, Puzzle, Flame, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import eyeSvgPaths from '../../imports/svg-s97xndcc4m';
import stageSvg from '../../imports/svg-951i6mgg1u';
import enemySvg from '../../imports/svg-xhzc5pp43b';

// ========== CONSTANTS ==========
const GRAVITY = 0.5;
const JUMP_FORCE = -11;
const MOVE_SPEED = 4.5;
const PW = 44;
const PH = 58;
const DEATH_Y = 1800;
const OBJ_LIFETIME = 60000;
const MAX_OBJS = 30;

// ========== TYPES ==========
interface Rect { x: number; y: number; w: number; h: number; }
interface BodyPart { id: string; x: number; y: number; color: string; ability: string; key: string; hint: string; collected: boolean; }
interface CreatedObj extends Rect { id: number; type: string; createdAt: number; label?: string; }
interface DragState { sx: number; sy: number; cx: number; cy: number; }
interface TextState { targetId: string; text: string; }
interface Slope { x1: number; y1: number; x2: number; y2: number; }
interface PenRail { id: number; samples: { x: number; y: number }[]; createdAt: number; }
type ToolMode = 'none' | 'rectangle' | 'frame' | 'pen' | 'text';
type Pt = { x: number; y: number };
interface ScatterPiece { x: number; y: number; vx: number; vy: number; rot: number; vr: number; partIndex: number; opacity: number; }
// Figma body part scatter definitions: center offsets in viewBox 0 0 129 192, plus viewBox region
const SCATTER_PARTS = [
  { cx: 33, cy: 33, vb: '0 0 65 65' },       // p1d534800 frame (red) - top-left
  { cx: 96, cy: 33, vb: '64 0 65 65' },       // p1e8a7f00 orange - top-right
  { cx: 33, cy: 96, vb: '0 64 65 65' },       // p31b4900 pen (purple) - mid-left
  { cx: 96, cy: 96, vb: '64 64 65 65' },      // rect text (blue) - mid-right
  { cx: 33, cy: 159, vb: '0 127 65 65' },     // p1bc24180 rectangle (green) - bottom-left
];

// ========== SPLINE HELPERS ==========
function sampleCR(pts: Pt[], n = 30): Pt[] {
  if (pts.length < 2) return [...pts];
  const r: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i];
    const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j <= n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      r.push({
        x: .5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: .5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return r;
}
function ptsToD(pts: Pt[]): string {
  if (!pts.length) return '';
  return `M${pts[0].x},${pts[0].y}` + pts.slice(1).map(p => `L${p.x},${p.y}`).join('');
}

// ========== SLOPE HELPERS ==========
function computeTopEdge(g: { x: number; y: number; w: number; h: number; rot: number }): Slope {
  const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
  const r = g.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const hw = g.w / 2, hh = g.h / 2;
  return {
    x1: cx + (-hw) * c - (-hh) * s, y1: cy + (-hw) * s + (-hh) * c,
    x2: cx + hw * c - (-hh) * s, y2: cy + hw * s + (-hh) * c,
  };
}
function slopeYAt(sl: Slope, px: number): number | null {
  const minX = Math.min(sl.x1, sl.x2) + 5, maxX = Math.max(sl.x1, sl.x2) - 5;
  if (px < minX || px > maxX) return null;
  const t = (px - sl.x1) / (sl.x2 - sl.x1);
  return sl.y1 + t * (sl.y2 - sl.y1);
}

// ========== LEVEL DATA ==========


const BODY_PARTS_INIT: BodyPart[] = [
  { id: 'green', x: 1450, y: 960, color: '#24CB71', ability: 'rectangle', key: 'R', hint: 'Green = SHAPE! Press R, then click & drag to create a Rectangle bridge!', collected: false },
  { id: 'red', x: 2500, y: 1040, color: '#FF3737', ability: 'frame', key: 'F', hint: 'Red = FRAME! Press F, drag to create a Frame — walk through fire inside it!', collected: false },
  { id: 'purple', x: 3650, y: 1190, color: '#874FFF', ability: 'pen', key: 'P', hint: 'Purple = PEN! Press P, click to draw, Enter to confirm, touch endpoint to ride!', collected: false },
  { id: 'blue', x: 5120, y: 500, color: '#00B6FF', ability: 'text', key: 'T', hint: 'Blue = TEXT! Press T near text to edit it directly!', collected: false },
];
// FIRES auto-generated from STAGE_WITH_FIRE after its definition (see below)

// Figma fire group path variants (from imported Figma stage design)
const FIRE_A = [stageSvg.p23fc4f00, stageSvg.p2d863880, stageSvg.p35452b80, stageSvg.p15f27200, stageSvg.p35e52a00, stageSvg.p17a23680];
const FIRE_B = [stageSvg.peb51c00, stageSvg.p2d863880, stageSvg.p35452b80, stageSvg.p11172880, stageSvg.p35e52a00, stageSvg.p20b74800];
const FIRE_C = [stageSvg.p23fc4f00, stageSvg.p32891380, stageSvg.p35452b80, stageSvg.p15f27200, stageSvg.p35e52a00, stageSvg.p17a23680];

// Combined StageWithFire: fire group SVG on top + white paper bg extending below
// Matches 7 StageWithFire from Figma, placed relative to game platforms
interface SWF { fx: number; fy: number; fw: number; fh: number; fRot: number; paths: string[];
  bx: number; by: number; bw: number; bh: number; bRot: number; }
const STAGE_WITH_FIRE: SWF[] = [
  // StageWithFire3 (flat) — on platform 2 (x=2200, y=1100)
  { fx: 2550, fy: 860, fw: 350, fh: 380, fRot: 0, paths: FIRE_A,
    bx: 2180, by: 1100, bw: 600, bh: 1500, bRot: 0 },
  // StageWithFire2 (rot 15) — fire zone gap between platforms 2-3
  { fx: 2780, fy: 740, fw: 350, fh: 380, fRot: 15, paths: FIRE_A,
    bx: 2650, by: 960, bw: 600, bh: 1500, bRot: 15 },
  // StageWithFire4 (flat, variant B) — on platform 3 (x=3300, y=1250)
  { fx: 3350, fy: 1000, fw: 350, fh: 380, fRot: 0, paths: FIRE_B,
    bx: 3300, by: 1250, bw: 600, bh: 1500, bRot: 0 },
  // StageWithFire5 (flat, variant B) — on platform 4 (x=4150, y=1020)
  { fx: 4200, fy: 770, fw: 350, fh: 380, fRot: 0, paths: FIRE_B,
    bx: 4150, by: 1020, bw: 600, bh: 1500, bRot: 0 },
  // StageWithFire6 (rot -15, variant C) — between platforms 4-5
  { fx: 4580, fy: 420, fw: 350, fh: 380, fRot: -15, paths: FIRE_C,
    bx: 4520, by: 640, bw: 600, bh: 1500, bRot: -15 },
  // StageWithFire (rot 15) — on platform 5 (x=5050, y=560)
  { fx: 5000, fy: 280, fw: 350, fh: 380, fRot: 15, paths: FIRE_A,
    bx: 4920, by: 520, bw: 600, bh: 1500, bRot: 15 },
  // StageWithFire1 (flat) — near goal (platforms 5-6)
  { fx: 5350, fy: 220, fw: 350, fh: 380, fRot: 0, paths: FIRE_A,
    bx: 5300, by: 460, bw: 600, bh: 1500, bRot: 0 },
];

// Collision = small core centered on flame (SVG xMidYMax meet, flame at bottom-center)
const FIRES: Rect[] = STAGE_WITH_FIRE.map(s => {
  const cw = s.fw * 0.35;
  const ch = s.fh * 0.4;
  return { x: s.fx + (s.fw - cw) / 2, y: s.fy + s.fh * 0.45, w: cw, h: ch };
});

// Standalone background papers (no fire) — visual + collision
// Rotated ones are visual decoration only; flat ones also serve as collision surfaces
const STANDALONE_BG = [
  // Start area tilted decorative bg (visual only, rot 15)
  { x: -250, y: 800, w: 600, h: 1900, rot: 15 },
  // Start area overlapping decorative bg (visual only, rot -21.7)
  { x: 120, y: 700, w: 600, h: 1650, rot: -21.7 },
  // Start area flat ground (collision + visual, gap ends at x=950, 190px gap to platform 2)
  { x: -100, y: 900, w: 1050, h: 800, rot: 0 },
  // Platform 2 flat ground (collision + visual)
  { x: 1140, y: 1020, w: 700, h: 1200, rot: 0 },
  // High platform area (collision + visual)
  { x: 5050, y: 560, w: 280, h: 1200, rot: 0 },
  // Goal area (collision + visual)
  { x: 5550, y: 490, w: 400, h: 640, rot: 0 },
];

// ===== COLLISION FROM NEW VISUAL ELEMENTS =====
// Flat STAGE_WITH_FIRE backgrounds - additional collision platforms
const SWF_FLAT_PLATFORMS: Rect[] = STAGE_WITH_FIRE
  .filter(s => s.bRot === 0)
  .map(s => ({ x: s.bx, y: s.by, w: s.bw, h: s.bh }));
// Rotated STAGE_WITH_FIRE backgrounds - additional slopes
const SWF_SLOPES: Slope[] = STAGE_WITH_FIRE
  .filter(s => s.bRot !== 0)
  .map(s => computeTopEdge({ x: s.bx, y: s.by, w: s.bw, h: s.bh, rot: s.bRot }));
// Flat STANDALONE_BG - collision platforms (rotated ones are visual-only, too tall for collision)
const SBG_FLAT_PLATFORMS: Rect[] = STANDALONE_BG
  .filter(bg => bg.rot === 0)
  .map(bg => ({ x: bg.x, y: bg.y, w: bg.w, h: bg.h }));
// Combined collision surfaces (no old PLATFORMS — all from visual elements)
const ALL_PLATFORMS: Rect[] = [...SWF_FLAT_PLATFORMS, ...SBG_FLAT_PLATFORMS];
const ALL_SLOPES: Slope[] = [...SWF_SLOPES];

const GOAL = { x: 5550, y: 350, w: 250, h: 200 };
// 404 Enemies — patrol near the goal
const ENEMIES_404 = [
  { patrolL: 5070, patrolR: 5270, groundY: 560, speed: 1.2, w: 70, h: 50 },
  { patrolL: 5320, patrolR: 5520, groundY: 460, speed: 1.6, w: 70, h: 50 },
  { patrolL: 5560, patrolR: 5760, groundY: 490, speed: 2.0, w: 70, h: 50 },
];
const CHECKPOINTS = [200, 1300, 2350, 3300, 4150, 5050, 5600];
const CHECKPOINT_Y = [842, 962, 1042, 1192, 962, 502, 432];
const SIGNS = [
  { x: 1850, y: 920, text: 'Press R and drag to build a bridge!', ability: 'rectangle' },
  { x: 2830, y: 910, text: 'Press F to create a Frame and block the fire!', icon: 'flame' as const, ability: 'frame' },
  { x: 4050, y: 920, text: 'Press P to draw, Enter, touch an endpoint to zipline!', ability: 'pen' },
  { x: 5300, y: 370, text: 'Press T near the flag, then TYPE "GOAL" TO FINISH!', ability: 'text' },
];
const TOOL_INSTRUCTIONS: Record<string, string> = {
  rectangle: 'Click and drag to create a Rectangle — it becomes a platform',
  frame: 'Click and drag to create a Frame — fire can\'t hurt you inside!',
  pen: 'Click to place points, Enter to draw, touch endpoint to ride!',
  text: 'Type "GOAL" then press Enter to finish!',
};

// ========== EYE EMOTION TYPES ==========
type EyeEmotion = 'normal' | 'happy' | 'sad';

// Googly eye component with physics-based pupil wobble
function GooglyEyes({ emotion, vx, vy, facingRight }: { emotion: EyeEmotion; vx: number; vy: number; facingRight: boolean }) {
  const pupilRef = React.useRef({ lx: 0, ly: 0, rx: 0, ry: 0, lvx: 0, lvy: 0, rvx: 0, rvy: 0 });
  const [pupils, setPupils] = React.useState({ lx: 0, ly: 0, rx: 0, ry: 0 });

  React.useEffect(() => {
    if (emotion !== 'normal') return;
    let raf: number;
    const tick = () => {
      const p = pupilRef.current;
      // Target position based on velocity
      const dir = facingRight ? 1 : -1;
      const tx = Math.max(-6, Math.min(6, vx * 0.8 * dir));
      const ty = Math.max(-4, Math.min(4, vy * 0.3));
      // Spring physics for each eye (slightly different params for wobble)
      const spring = 0.12, damp = 0.7, jitter = 0.3;
      p.lvx = (p.lvx + (tx - p.lx) * spring) * damp + (Math.random() - 0.5) * jitter;
      p.lvy = (p.lvy + (ty - p.ly) * spring + 0.15) * damp + (Math.random() - 0.5) * jitter;
      p.rvx = (p.rvx + (tx - p.rx) * spring * 1.1) * damp + (Math.random() - 0.5) * jitter;
      p.rvy = (p.rvy + (ty - p.ry) * spring * 0.9 + 0.15) * damp + (Math.random() - 0.5) * jitter;
      p.lx += p.lvx; p.ly += p.lvy;
      p.rx += p.rvx; p.ry += p.rvy;
      // Clamp to eye bounds
      const maxR = 8;
      const clamp = (x: number, y: number) => {
        const d = Math.sqrt(x * x + y * y);
        if (d > maxR) { const s = maxR / d; return [x * s, y * s]; }
        return [x, y];
      };
      [p.lx, p.ly] = clamp(p.lx, p.ly);
      [p.rx, p.ry] = clamp(p.rx, p.ry);
      setPupils({ lx: p.lx, ly: p.ly, rx: p.rx, ry: p.ry });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [emotion, vx, vy, facingRight]);

  const eyeW = PW * 0.7;
  const eyeH = PH * 0.28;

  // Happy eyes (^^ shape)
  if (emotion === 'happy') {
    return (
      <svg viewBox="0 0 60.845 36.907" fill="none" preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', width: eyeW, height: eyeH, top: 0, left: PW * 0.3, zIndex: 2 }}>
        <circle cx="42.39" cy="18.45" fill="white" r="16.95" stroke="#D8D8D8" strokeWidth="3" />
        <circle cx="18.45" cy="18.45" fill="white" r="16.95" stroke="#D8D8D8" strokeWidth="3" />
        <path d={eyeSvgPaths.p6c3000} stroke="black" strokeLinecap="round" strokeWidth="3" />
        <path d={eyeSvgPaths.pe8c5980} stroke="black" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }

  // Sad eyes (>< shape)
  if (emotion === 'sad') {
    return (
      <svg viewBox="0 0 60.845 36.907" fill="none" preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', width: eyeW, height: eyeH, top: 0, left: PW * 0.3, zIndex: 2 }}>
        <circle cx="42.39" cy="18.45" fill="white" r="16.95" stroke="#D8D8D8" strokeWidth="3" />
        <circle cx="18.45" cy="18.45" fill="white" r="16.95" stroke="#D8D8D8" strokeWidth="3" />
        <path d={eyeSvgPaths.p21cedd80} stroke="black" strokeLinecap="round" strokeWidth="3" />
        <path d={eyeSvgPaths.pdfcd800} stroke="black" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }

  // Normal: googly eyes with bouncy pupils
  return (
    <svg viewBox="0 0 60.845 36.907" fill="none" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', width: eyeW, height: eyeH, top: 0, left: PW * 0.3, zIndex: 2 }}>
      <circle cx="42.39" cy="18.45" fill="white" r="16.95" stroke="#D8D8D8" strokeWidth="3" />
      <circle cx={42.39 + pupils.rx} cy={18.95 + pupils.ry} fill="black" r="6.48" stroke="black" strokeWidth="3" />
      <circle cx="18.45" cy="18.45" fill="white" r="16.95" stroke="#D8D8D8" strokeWidth="3" />
      <circle cx={18.45 + pupils.lx} cy={14.96 + pupils.ly} fill="black" r="6.48" stroke="black" strokeWidth="3" />
    </svg>
  );
}

// ========== COMPONENTS ==========
function PlayerChar({ abilities, facingRight, dead, eyeEmotion, vx, vy, onGround }: { abilities: string[]; facingRight: boolean; dead: boolean; eyeEmotion: EyeEmotion; vx: number; vy: number; onGround: boolean }) {
  const has = (a: string) => abilities.includes(a);
  const walking = !dead && onGround && Math.abs(vx) > 0.5;
  return (
    <div style={{ width: PW, height: PH, animation: walking ? 'figmanWalk 0.28s ease-in-out infinite alternate' : 'none' }}>
    <div style={{ width: PW, height: PH, position: 'relative', transform: facingRight ? 'none' : 'scaleX(-1)', opacity: dead ? 0.4 : 1, filter: dead ? 'saturate(0)' : 'none', transition: 'opacity 0.2s' }}>
      {/* Eyes */}
      <GooglyEyes emotion={eyeEmotion} vx={vx} vy={vy} facingRight={facingRight} />
      {/* Body */}
      <svg viewBox="0 0 129 192" fill="none" preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', width: PW * 0.92, height: PH * 0.78, bottom: 0, left: PW * 0.01, zIndex: 1 }}>
        <path d={figBodyPaths.p1d534800} fill={has('frame') ? '#FF3737' : 'none'} stroke={has('frame') ? '#FF3737' : 'black'} strokeWidth="3" strokeDasharray={has('frame') ? 'none' : '8 8'} />
        <path d={figBodyPaths.p1e8a7f00} fill="#FF7237" stroke="black" strokeWidth="3" strokeDasharray="8 8" />
        <path d={figBodyPaths.p31b4900} fill={has('pen') ? '#874FFF' : 'none'} stroke={has('pen') ? '#874FFF' : 'black'} strokeWidth="3" strokeDasharray={has('pen') ? 'none' : '8 8'} />
        <rect x="64.5" y="64.5" width="63" height="63" rx="31.5" fill={has('text') ? '#00B6FF' : 'none'} stroke={has('text') ? '#00B6FF' : 'black'} strokeWidth="3" strokeDasharray={has('text') ? 'none' : '8 8'} />
        <path d={figBodyPaths.p1bc24180} fill={has('rectangle') ? '#24CB71' : 'none'} stroke={has('rectangle') ? '#24CB71' : 'black'} strokeWidth="3" strokeDasharray={has('rectangle') ? 'none' : '8 8'} />
      </svg>
    </div>
    </div>
  );
}
function ToolBtn({ label, name, active, enabled, color, onActivate }: { label: string; name: string; active: boolean; enabled: boolean; color: string; onActivate: () => void; }) {
  return (
    <button data-toolbar="true" onClick={(e) => { e.stopPropagation(); if (enabled) onActivate(); }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 14px', borderRadius: 8, border: 'none', background: active ? `${color}18` : 'transparent', outline: active ? `2px solid ${color}` : '2px solid transparent', cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.35, transition: 'all 0.15s' }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: active ? color : '#555', lineHeight: 1.2 }}>{label}</span>
      <span style={{ fontSize: 9, color: active ? color : '#999', lineHeight: 1.2 }}>{name}</span>
    </button>
  );
}
function FigmaFireGroup({ paths, w, h, rot = 0, style }: { paths: string[]; w: number; h: number; rot?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ ...style, width: w, height: h, transform: rot ? `rotate(${rot}deg)` : undefined }}>
      <svg width={w} height={h} viewBox="0 0 1772.88 1913.45" fill="none" preserveAspectRatio="xMidYMax meet"
        style={{ animation: 'flameFlicker 2s ease-in-out infinite alternate' }}>
        {paths.map((d, i) => <path key={i} d={d} fill="#FF3737" stroke="#FF7237" strokeWidth="27" />)}
      </svg>
    </div>
  );
}

// ===== LP COMPONENTS (matching Figma design) =====
function FigDashed({ scale = 1, emotion = 'normal' as EyeEmotion }: { scale?: number; emotion?: EyeEmotion }) {
  return (
    <div style={{ width: 61 * scale, height: 100 * scale, position: 'relative' }}>
      <svg width={61 * scale} height={92 * scale} viewBox="0 0 61.7441 92.1163" fill="none" style={{ position: 'absolute', left: 0, top: 8 * scale }} preserveAspectRatio="xMidYMid meet">
        <path d={lpSvgPaths.p14162a80} stroke="black" strokeDasharray="3.86 3.86" fill="none" />
        <path d={lpSvgPaths.pa7b4400} fill="#FF7237" stroke="black" strokeDasharray="3.86 3.86" />
        <path d={lpSvgPaths.p209bd8a0} stroke="black" strokeDasharray="3.86 3.86" fill="none" />
        <path d={lpSvgPaths.p1b085900} stroke="black" strokeDasharray="3.86 3.86" fill="none" />
        <rect height="30.3722" rx="15.1861" stroke="black" strokeDasharray="3.86 3.86" width="30.3722" x="30.8719" y="30.8725" fill="none" />
      </svg>
      {emotion === 'sad' ? (
        <svg width={30 * scale} height={18 * scale} viewBox="0 0 60.845 36.907" fill="none" style={{ position: 'absolute', left: 26 * scale, top: 0 }} preserveAspectRatio="xMidYMid meet">
          <circle cx="42.39" cy="18.45" fill="white" r="16.95" stroke="#D8D8D8" strokeWidth="3" />
          <circle cx="18.45" cy="18.45" fill="white" r="16.95" stroke="#D8D8D8" strokeWidth="3" />
          <path d={eyeSvgPaths.p21cedd80} stroke="black" strokeLinecap="round" strokeWidth="3" />
          <path d={eyeSvgPaths.pdfcd800} stroke="black" strokeLinecap="round" strokeWidth="3" />
        </svg>
      ) : (
        <svg width={30 * scale} height={18 * scale} viewBox="0 0 29.408 17.8377" fill="none" style={{ position: 'absolute', left: 26 * scale, top: 0 }} preserveAspectRatio="xMidYMid meet">
          <circle cx="20.4892" cy="8.91885" fill="white" r="8.41881" stroke="#D8D8D8" />
          <circle cx="24.589" cy="9.15975" fill="black" r="3.61573" stroke="black" strokeWidth="0.482098" />
          <circle cx="8.91901" cy="8.91892" fill="white" r="8.41881" stroke="#D8D8D8" />
          <circle cx="11.5707" cy="7.2315" fill="black" r="3.61573" stroke="black" strokeWidth="0.482098" />
        </svg>
      )}
    </div>
  );
}

function FigComplete({ scale = 1 }: { scale?: number }) {
  return (
    <div style={{ width: 61 * scale, height: 100 * scale, position: 'relative' }}>
      <svg width={61 * scale} height={92 * scale} viewBox="0 0 61.7441 92.1163" fill="none" style={{ position: 'absolute', left: 0, top: 8 * scale }} preserveAspectRatio="xMidYMid meet">
        <path d={lpSvgPaths.p14162a80} fill="#F24E1E" stroke="none" />
        <path d={lpSvgPaths.pa7b4400} fill="#FF7262" stroke="none" />
        <path d={lpSvgPaths.p209bd8a0} fill="#A259FF" stroke="none" />
        <path d={lpSvgPaths.p1b085900} fill="#0ACF83" stroke="none" />
        <rect height="30.3722" rx="15.1861" fill="#1ABCFE" width="30.3722" x="30.8719" y="30.8725" />
      </svg>
      <svg width={30 * scale} height={18 * scale} viewBox="0 0 29.408 17.8377" fill="none" style={{ position: 'absolute', left: 26 * scale, top: 0 }} preserveAspectRatio="xMidYMid meet">
        <circle cx="20.4892" cy="8.91885" fill="white" r="8.41881" stroke="#D8D8D8" />
        <circle cx="24.589" cy="9.15975" fill="black" r="3.61573" stroke="black" strokeWidth="0.482098" />
        <circle cx="8.91901" cy="8.91892" fill="white" r="8.41881" stroke="#D8D8D8" />
        <circle cx="11.5707" cy="7.2315" fill="black" r="3.61573" stroke="black" strokeWidth="0.482098" />
      </svg>
    </div>
  );
}

interface ScoreData { time: number; deaths: number; objsCreated: number; partsCollected: number; }
function calcScore(s: ScoreData) {
  const timeBonus = Math.max(0, Math.floor((150 - s.time) * 60));
  const survivalBonus = Math.max(0, (5 - Math.min(s.deaths, 5)) * 600);
  const partBonus = s.partsCollected * 500;
  const score = timeBonus + survivalBonus + partBonus;
  const stars = score >= 9000 ? 3 : score >= 6000 ? 2 : score >= 3000 ? 1 : 0;
  return { score, stars, timeBonus, survivalBonus, partBonus };
}
function formatTime(s: number) { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; }

// ========== MAIN GAME ==========
export default function Game() {
  const [gameMode, setGameMode] = useState<'title' | 'playing' | 'won'>('title');
  const pRef = useRef({ x: 200, y: 842, vx: 0, vy: 0, onGround: false, facingRight: true });
  const camRef = useRef({ x: 0, y: 400 });
  const keysRef = useRef(new Set<string>());
  const abRef = useRef(new Set<string>());
  const bpRef = useRef(BODY_PARTS_INIT.map(b => ({ ...b })));
  const objRef = useRef<CreatedObj[]>([]);
  const oidRef = useRef(0);
  const toolRef = useRef<ToolMode>('none');
  const dragRef = useRef<DragState | null>(null);
  const penPtsRef = useRef<Pt[]>([]);
  const textRef = useRef<TextState | null>(null);
  const mouseRef = useRef<Pt>({ x: 0, y: 0 });
  const railRef = useRef<PenRail[]>([]);
  const zipRef = useRef<{ railId: number; t: number } | null>(null);
  const hintRef = useRef<{ text: string; timer: number } | null>(null);
  const cpRef = useRef(0);
  const deadRef = useRef(false);
  const dtRef = useRef(0);
  const msgRef = useRef<{ text: string; timer: number } | null>(null);
  const startTimeRef = useRef(0);
  const deathCountRef = useRef(0);
  const objCountRef = useRef(0);
  const [finalScore, setFinalScore] = useState<ScoreData | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingPage, setOnboardingPage] = useState(0);
  const [lpBlink, setLpBlink] = useState(false);
  const speechRef = useRef<{ text: string; timer: number; emotion?: EyeEmotion } | null>(null);
  const triggeredRef = useRef(new Set<string>());
  const flagActivatedRef = useRef(false);
  const scatterRef = useRef<ScatterPiece[]>([]);
  const tickRef = useRef(0);
  const enemyRef = useRef(ENEMIES_404.map(e => ({ x: e.patrolL, dir: 1 })));

  const [rs, setRs] = useState({
    px: 200, py: 842, cx: 0, cy: 400, fr: true,
    ab: [] as string[], cp: [] as string[], objs: [] as CreatedObj[],
    rails: [] as PenRail[], zip: null as { railId: number; t: number } | null,
    hint: null as string | null, dead: false, msg: null as string | null,
    tool: 'none' as ToolMode, drag: null as DragState | null,
    penPts: [] as Pt[], mw: { x: 0, y: 0 } as Pt, textInput: null as TextState | null,
    insideFrame: false, elapsed: 0, deaths: 0,
    vx: 0, vy: 0, eyeEmotion: 'normal' as EyeEmotion,
    speech: null as string | null,
    flagActivated: false,
    scatter: [] as ScatterPiece[],
    enemies: ENEMIES_404.map(e => ({ x: e.patrolL, dir: 1 })),
  });

  const s2w = (sx: number, sy: number): Pt => ({ x: sx + camRef.current.x, y: sy + camRef.current.y });
  const addObj = (type: string, x: number, y: number, w: number, h: number, label?: string) => {
    if (objRef.current.length >= MAX_OBJS) objRef.current.shift();
    objRef.current.push({ id: ++oidRef.current, type, createdAt: Date.now(), x, y, w, h, label });
    objCountRef.current++;
    // GOAL activation is now handled by in-place text editing (T tool)
  };
  const exitTool = () => { toolRef.current = 'none'; dragRef.current = null; penPtsRef.current = []; textRef.current = null; };

  const resetGame = useCallback(() => {
    pRef.current = { x: 200, y: 842, vx: 0, vy: 0, onGround: false, facingRight: true };
    camRef.current = { x: 0, y: 400 }; abRef.current = new Set();
    bpRef.current = BODY_PARTS_INIT.map(b => ({ ...b }));
    objRef.current = []; oidRef.current = 0; railRef.current = []; zipRef.current = null;
    exitTool(); keysRef.current.clear();
    hintRef.current = null; cpRef.current = 0; deadRef.current = false; dtRef.current = 0; msgRef.current = null;
    speechRef.current = null; triggeredRef.current = new Set(); flagActivatedRef.current = false; scatterRef.current = [];
    tickRef.current = 0;
    startTimeRef.current = Date.now(); deathCountRef.current = 0; objCountRef.current = 0;
    setFinalScore(null);
  }, []);

  // ===== TEXT TOOL: auto-edit nearby text =====
  const tryEditText = useCallback(() => {
    if (flagActivatedRef.current) { msgRef.current = { text: 'Flag already activated!', timer: 60 }; return; }
    const p = pRef.current;
    const dx = Math.abs(p.x + PW / 2 - GOAL.x);
    const dy = Math.abs(p.y + PH / 2 - (GOAL.y - 150));
    if (dx < 250 && dy < 300) {
      toolRef.current = 'text';
      textRef.current = { targetId: 'flag', text: '' };
      keysRef.current.clear();
    } else {
      msgRef.current = { text: 'Get closer to the flag to edit its text!', timer: 80 };
      speechRef.current = { text: 'I need to find some text to edit...', timer: 80 };
    }
  }, []);

  // ===== KEYBOARD =====
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (gameMode === 'title') { resetGame(); setOnboardingPage(0); setShowOnboarding(true); setGameMode('playing'); return; }
      if (showOnboarding) {
        if (onboardingPage < 3) { setOnboardingPage(p => p + 1); return; }
        setShowOnboarding(false); startTimeRef.current = Date.now(); return;
      }
      if (gameMode === 'won' && (k === ' ' || k === 'enter')) { resetGame(); setGameMode('title'); return; }
      if (gameMode !== 'playing') return;

      if (toolRef.current !== 'none') {
        e.preventDefault();
        // Text editing (in-place on flag)
        if (toolRef.current === 'text' && textRef.current) {
          if (k === 'enter') {
            const txt = textRef.current.text.trim();
            if (textRef.current.targetId === 'flag' && txt.toUpperCase() === 'GOAL' && !flagActivatedRef.current) {
              flagActivatedRef.current = true;
              msgRef.current = { text: 'Flag activated! GOAL unlocked!', timer: 120 };
              speechRef.current = { text: 'The flag says GOAL now!', timer: 100 };
            } else if (txt.length === 0) {
              msgRef.current = { text: 'Type something first!', timer: 60 };
              return;
            } else if (textRef.current.targetId === 'flag' && txt.toUpperCase() !== 'GOAL') {
              msgRef.current = { text: `"${txt}"... That doesn't seem right`, timer: 80 };
            }
            exitTool(); return;
          }
          if (k === 'backspace') { textRef.current.text = textRef.current.text.slice(0, -1); return; }
          if (k === 'escape') { exitTool(); return; }
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && textRef.current.text.length < 12) { textRef.current.text += e.key.toUpperCase(); return; }
          return;
        }
        // Pen - spline + zipline
        if (toolRef.current === 'pen') {
          if (k === 'enter' && penPtsRef.current.length >= 2) {
            const samples = sampleCR(penPtsRef.current, 30);
            const id = ++oidRef.current;
            railRef.current.push({ id, samples, createdAt: Date.now() });
            objCountRef.current++;
            msgRef.current = { text: 'Touch an endpoint to zipline!', timer: 90 }; exitTool(); return;
          }
          if (k === 'escape') { exitTool(); return; }
          if (k === 'z' && (e.ctrlKey || e.metaKey) && penPtsRef.current.length > 0) { penPtsRef.current.pop(); return; }
          return;
        }
        if (k === 'v' || k === 'escape') { exitTool(); return; }
        if (k === 'r' && abRef.current.has('rectangle')) { exitTool(); toolRef.current = 'rectangle'; return; }
        if (k === 'f' && abRef.current.has('frame')) { exitTool(); toolRef.current = 'frame'; return; }
        if (k === 'p' && abRef.current.has('pen')) { exitTool(); toolRef.current = 'pen'; return; }
        if (k === 't' && abRef.current.has('text')) { exitTool(); tryEditText(); return; }
        return;
      }
      if (deadRef.current) return;
      if (k === ' ') e.preventDefault();
      keysRef.current.add(k);
      if (k === 'r' && abRef.current.has('rectangle')) { toolRef.current = 'rectangle'; keysRef.current.clear(); }
      if (k === 'f' && abRef.current.has('frame')) { toolRef.current = 'frame'; keysRef.current.clear(); }
      if (k === 'p' && abRef.current.has('pen')) { toolRef.current = 'pen'; keysRef.current.clear(); }
      if (k === 't' && abRef.current.has('text')) { tryEditText(); keysRef.current.clear(); }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [gameMode, resetGame, showOnboarding, onboardingPage]);

  // ===== MOUSE =====
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const onMove = (e: MouseEvent) => { const w = s2w(e.clientX, e.clientY); mouseRef.current = w; if (dragRef.current) { dragRef.current.cx = w.x; dragRef.current.cy = w.y; } };
    const onDown = (e: MouseEvent) => {
      if (toolRef.current === 'none') return;
      if ((e.target as HTMLElement).closest('[data-toolbar]')) return;
      const w = s2w(e.clientX, e.clientY);
      if (toolRef.current === 'rectangle' || toolRef.current === 'frame') dragRef.current = { sx: w.x, sy: w.y, cx: w.x, cy: w.y };
      if (toolRef.current === 'pen') penPtsRef.current = [...penPtsRef.current, { x: w.x, y: w.y }];
      // Text tool no longer uses click-to-place; it edits in-place on stage text
    };
    const onUp = () => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      const x = Math.min(d.sx, d.cx), y = Math.min(d.sy, d.cy);
      const w = Math.abs(d.cx - d.sx), h = Math.abs(d.cy - d.sy);
      if (w > 12 && h > 12) {
        if (toolRef.current === 'rectangle') { addObj('rectangle', x, y, w, h); msgRef.current = { text: 'Rectangle!', timer: 70 }; }
        if (toolRef.current === 'frame') { addObj('frame', x, y, w, h); msgRef.current = { text: 'Frame created!', timer: 70 }; }
      }
      dragRef.current = null; exitTool();
    };
    window.addEventListener('mousemove', onMove); window.addEventListener('mousedown', onDown); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mousedown', onDown); window.removeEventListener('mouseup', onUp); };
  }, [gameMode]);

  // ===== GAME LOOP =====
  useEffect(() => {
    if (gameMode !== 'playing' || showOnboarding) return;
    let raf: number;
    const loop = () => {
      const p = pRef.current; const keys = keysRef.current; const now = Date.now();
      tickRef.current++;
      const inTool = toolRef.current !== 'none';

      if (!inTool) {
        if (deadRef.current) {
          dtRef.current--;
          if (dtRef.current <= 0) { deadRef.current = false; zipRef.current = null; p.x = CHECKPOINTS[cpRef.current]; p.y = CHECKPOINT_Y[cpRef.current]; p.vx = 0; p.vy = 0; }
        } else if (zipRef.current) {
          // ====== ZIPLINE MOVEMENT (smooth lerp, one-way) ======
          const rail = railRef.current.find(r => r.id === zipRef.current!.railId);
          if (rail && zipRef.current.t < rail.samples.length - 1) {
            const idx = Math.floor(zipRef.current.t);
            const nxt = Math.min(idx + 1, rail.samples.length - 1);
            const frac = zipRef.current.t - idx;
            // Lerp position between samples for smooth movement
            const lx = rail.samples[idx].x + (rail.samples[nxt].x - rail.samples[idx].x) * frac;
            const ly = rail.samples[idx].y + (rail.samples[nxt].y - rail.samples[idx].y) * frac;
            const dy = rail.samples[nxt].y - rail.samples[idx].y;
            const speed = Math.max(0.4, 0.8 + dy * 0.01);
            zipRef.current.t += speed;
            if (zipRef.current.t >= rail.samples.length - 1) {
              const last = rail.samples[rail.samples.length - 1];
              p.x = last.x - PW / 2; p.y = last.y - PH; p.vy = 1;
              // Remove the rail after completing the ride (one-way)
              railRef.current = railRef.current.filter(r => r.id !== zipRef.current!.railId);
              zipRef.current = null;
            } else {
              p.x = lx - PW / 2; p.y = ly - PH / 2; p.vy = 0; p.vx = 0;
              if (nxt < rail.samples.length) p.facingRight = rail.samples[nxt].x >= rail.samples[idx].x;
            }
            if (keys.has('w') || keys.has(' ') || keys.has('arrowup')) {
              p.vy = JUMP_FORCE * 0.7; p.onGround = false; zipRef.current = null;
            }
          } else { zipRef.current = null; }
        } else {
          // ====== NORMAL MOVEMENT ======
          p.vx = 0;
          if (keys.has('a') || keys.has('arrowleft')) { p.vx = -MOVE_SPEED; p.facingRight = false; }
          if (keys.has('d') || keys.has('arrowright')) { p.vx = MOVE_SPEED; p.facingRight = true; }
          if ((keys.has('w') || keys.has(' ') || keys.has('arrowup')) && p.onGround) { p.vy = JUMP_FORCE; p.onGround = false; }

          p.x += p.vx;
          if (p.x < 0) p.x = 0;
          const all = [...ALL_PLATFORMS, ...objRef.current];
          const pcx = p.x + PW / 2;

          if (p.onGround) {
            // Ground following — stay on surface, reset gravity, update checkpoint
            p.vy = 0;
            let bestY: number | null = null; let bestD = 25;
            for (const pl of all) {
              if (p.x + PW > pl.x + 2 && p.x < pl.x + pl.w - 2) {
                const d = Math.abs(p.y + PH - pl.y);
                if (d < bestD) { bestD = d; bestY = pl.y; }
              }
            }
            for (const sl of ALL_SLOPES) {
              const gY = slopeYAt(sl, pcx);
              if (gY !== null) { const d = Math.abs(p.y + PH - gY); if (d < bestD) { bestD = d; bestY = gY; } }
            }
            if (bestY !== null) {
              p.y = bestY - PH;
              for (let i = CHECKPOINTS.length - 1; i >= 0; i--) { if (p.x >= CHECKPOINTS[i] - 60) { cpRef.current = Math.max(cpRef.current, i); break; } }
            } else {
              p.onGround = false;
            }
          }

          if (!p.onGround) {
            // Airborne — gravity + landing
            p.vy += GRAVITY;
            const prevY = p.y;
            p.y += p.vy;
            if (p.vy >= 0) {
              let landY = Infinity;
              for (const pl of all) {
                if (p.x + PW > pl.x + 2 && p.x < pl.x + pl.w - 2) {
                  if (prevY + PH <= pl.y + 8 && p.y + PH >= pl.y && pl.y < landY) landY = pl.y;
                }
              }
              for (const sl of ALL_SLOPES) {
                const gY = slopeYAt(sl, pcx);
                if (gY !== null && prevY + PH <= gY + 12 && p.y + PH >= gY - 4 && gY < landY) landY = gY;
              }
              if (landY < Infinity) {
                p.y = landY - PH; p.vy = 0; p.onGround = true;
                for (let i = CHECKPOINTS.length - 1; i >= 0; i--) { if (p.x >= CHECKPOINTS[i] - 60) { cpRef.current = Math.max(cpRef.current, i); break; } }
              }
            }
          }

          // Death scatter spawn helper
          const triggerDeath = () => {
            if (deadRef.current) return;
            deadRef.current = true; dtRef.current = 50; deathCountRef.current++;
            // Spawn actual body part pieces as scatter
            const bodyW = PW * 0.92, bodyH = PH * 0.78;
            const bodyLeft = p.x + PW * 0.01, bodyTop = p.y + PH - bodyH;
            scatterRef.current = SCATTER_PARTS.map((sp, i) => ({
              x: bodyLeft + (sp.cx / 129) * bodyW,
              y: bodyTop + (sp.cy / 192) * bodyH,
              vx: (sp.cx < 65 ? -1 : 1) * (Math.random() * 4 + 3) + (Math.random() - 0.5) * 3,
              vy: -(Math.random() * 7 + 5),
              rot: 0, vr: (Math.random() - 0.5) * 20,
              partIndex: i, opacity: 1,
            }));
          };
          // Death
          if (p.y > DEATH_Y && !deadRef.current) { triggerDeath(); }
          // Fire (immune inside frames)
          const insideFrame = objRef.current.some(o => o.type === 'frame' && p.x + PW / 2 > o.x && p.x + PW / 2 < o.x + o.w && p.y + PH > o.y && p.y < o.y + o.h);
          if (!insideFrame && !deadRef.current) {
            for (const f of FIRES) { if (p.x + PW > f.x + 10 && p.x < f.x + f.w - 10 && p.y + PH > f.y + 10 && p.y < f.y + f.h) { triggerDeath(); } }
          }
          // 404 Enemies patrol + collision
          for (let ei = 0; ei < ENEMIES_404.length; ei++) {
            const def = ENEMIES_404[ei], e = enemyRef.current[ei];
            e.x += def.speed * e.dir;
            if (e.x <= def.patrolL) { e.x = def.patrolL; e.dir = 1; }
            if (e.x >= def.patrolR) { e.x = def.patrolR; e.dir = -1; }
            const eY = def.groundY - def.h;
            if (!deadRef.current && !insideFrame && p.x + PW > e.x + 8 && p.x < e.x + def.w - 8 && p.y + PH > eY + 8 && p.y < eY + def.h) {
              triggerDeath();
            }
          }
          // Collect body parts
          for (const bp of bpRef.current) {
            if (bp.collected) continue;
            if (Math.hypot((p.x + PW / 2) - (bp.x + 25), (p.y + PH / 2) - (bp.y + 25)) < 45) {
              bp.collected = true; abRef.current.add(bp.ability);
              const ct = bpRef.current.filter(b => b.collected).length;
              const partLines = [
                "Wait... that is one of MY body parts!",
                "Another piece! I can feel it!",
                "Almost there... one more to go!",
                "YES! I am WHOLE again!!"
              ];
              speechRef.current = { text: partLines[Math.min(ct - 1, 3)], timer: 120 };
            }
          }
          // Rail endpoint proximity - start zipline
          if (!zipRef.current) {
            const pcx = p.x + PW / 2, pcy = p.y + PH / 2;
            for (const rail of railRef.current) {
              if (rail.samples.length < 2) continue;
              const first = rail.samples[0];
              const last = rail.samples[rail.samples.length - 1];
              const TOUCH_R = 30;
              const dFirst = Math.hypot(pcx - first.x, pcy - first.y);
              const dLast = Math.hypot(pcx - last.x, pcy - last.y);
              if (dFirst < TOUCH_R) {
                zipRef.current = { railId: rail.id, t: 0 };
                p.x = first.x - PW / 2; p.y = first.y - PH / 2;
                p.vy = 0; p.vx = 0; p.onGround = false;
                break;
              } else if (dLast < TOUCH_R) {
                // Ride in reverse — swap samples
                rail.samples.reverse();
                zipRef.current = { railId: rail.id, t: 0 };
                p.x = rail.samples[0].x - PW / 2; p.y = rail.samples[0].y - PH / 2;
                p.vy = 0; p.vx = 0; p.onGround = false;
                break;
              }
            }
          }
        }

      }

      // Goal check — always runs regardless of tool/dead/zip state
      if (flagActivatedRef.current && !deadRef.current) {
        const gx = p.x + PW / 2, gy = p.y + PH / 2;
        if (gx >= GOAL.x && gx <= GOAL.x + GOAL.w && gy >= GOAL.y && gy <= GOAL.y + GOAL.h) {
          setFinalScore({ time: (Date.now() - startTimeRef.current) / 1000, deaths: deathCountRef.current, objsCreated: objCountRef.current, partsCollected: bpRef.current.filter(b => b.collected).length });
          setGameMode('won');
        }
      }

      // Figman speech triggers (position / event based)
      {
        const say = (id: string, text: string, dur: number, emotion?: EyeEmotion) => {
          if (!triggeredRef.current.has(id)) { triggeredRef.current.add(id); speechRef.current = { text, timer: dur, emotion }; }
        };
        const px = pRef.current.x;
        if (!deadRef.current) {
          if (px > 60 && px < 300) say('start', 'Where the FIGMAN are my body parts?!', 140, 'sad');
          if (px > 1100 && px < 1250) say('gap1', 'Whoa... that is a big gap!', 100, 'sad');
          if (px > 2700 && px < 2850) say('fire', 'Is that FIRE?! I need protection!', 120, 'sad');
          if (px > 3300 && px < 3500) say('pen_area', 'Maybe I can draw my way across...', 110);
          if (px > 4200 && px < 4400) say('climb', 'That is WAY up there!', 100);
          if (px > 5450 && px < 5580) say('enemy_404', 'A 404?! Page Not Found... or ME Not Found?!', 130, 'sad');

          if (px > 5400 && px < 5550 && !flagActivatedRef.current) say('near_goal', 'The flag says ????... Press T, then TYPE "GOAL" TO FINISH!', 140);
        }
        if (deadRef.current) {
          const dk = 'death_' + deathCountRef.current;
          if (!triggeredRef.current.has(dk)) {
            triggeredRef.current.add(dk);
            const dl = ['Ouch!', 'Not again...', 'Where the FIGMAN did I go?!', 'This is fine...', 'Ctrl+Z me please!', 'Undo! UNDO!!'];
            speechRef.current = { text: dl[deathCountRef.current % dl.length], timer: 60, emotion: 'sad' };
          }
        }
      }

      // Update scatter pieces
      for (const sp of scatterRef.current) {
        sp.x += sp.vx; sp.y += sp.vy; sp.vy += 0.4; sp.rot += sp.vr;
        sp.vx *= 0.98; sp.vr *= 0.97;
        sp.opacity = Math.max(0, sp.opacity - 0.015);
      }
      scatterRef.current = scatterRef.current.filter(sp => sp.opacity > 0);

      // Timers
      if (hintRef.current) { hintRef.current.timer--; if (hintRef.current.timer <= 0) hintRef.current = null; }
      if (msgRef.current) { msgRef.current.timer--; if (msgRef.current.timer <= 0) msgRef.current = null; }
      if (speechRef.current) { speechRef.current.timer--; if (speechRef.current.timer <= 0) speechRef.current = null; }
      objRef.current = objRef.current.filter(o => now - o.createdAt < OBJ_LIFETIME);
      railRef.current = railRef.current.filter(r => now - r.createdAt < OBJ_LIFETIME);

      // Camera
      const vw = window.innerWidth, vh = window.innerHeight;
      const tx = pRef.current.x - vw / 2 + PW / 2, ty = pRef.current.y - vh / 2 + PH / 2 - 50;
      camRef.current.x += (tx - camRef.current.x) * 0.07; camRef.current.y += (ty - camRef.current.y) * 0.05;
      camRef.current.x = Math.max(-100, camRef.current.x); camRef.current.y = Math.max(-50, Math.min(950, camRef.current.y));

      const insideFrame = objRef.current.some(o => o.type === 'frame' && pRef.current.x + PW / 2 > o.x && pRef.current.x + PW / 2 < o.x + o.w && pRef.current.y + PH > o.y && pRef.current.y < o.y + o.h);
      // Determine eye emotion
      let eyeEmotion: EyeEmotion = 'normal';
      if (deadRef.current) eyeEmotion = 'sad';
      else if (speechRef.current) eyeEmotion = speechRef.current.emotion || 'happy';
      else if (msgRef.current && msgRef.current.text) eyeEmotion = 'happy';
      else if (zipRef.current) eyeEmotion = 'happy'; // riding zipline
      setRs({
        px: pRef.current.x, py: pRef.current.y, cx: camRef.current.x, cy: camRef.current.y, fr: pRef.current.facingRight,
        ab: Array.from(abRef.current), cp: bpRef.current.filter(b => b.collected).map(b => b.id),
        objs: [...objRef.current], rails: [...railRef.current],
        zip: zipRef.current ? { ...zipRef.current } : null,
        hint: hintRef.current?.text || null, dead: deadRef.current,
        msg: msgRef.current?.text || null, tool: toolRef.current,
        drag: dragRef.current ? { ...dragRef.current } : null, penPts: [...penPtsRef.current],
        mw: { ...mouseRef.current }, textInput: textRef.current ? { ...textRef.current } : null,
        insideFrame, elapsed: startTimeRef.current ? (now - startTimeRef.current) / 1000 : 0, deaths: deathCountRef.current,
        vx: pRef.current.vx, vy: pRef.current.vy, eyeEmotion, onGround: pRef.current.onGround,
        speech: speechRef.current?.text || null,
        flagActivated: flagActivatedRef.current,
        scatter: scatterRef.current.map(s => ({ ...s })),
        enemies: enemyRef.current.map(e => ({ x: e.x, dir: e.dir })),
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [gameMode, showOnboarding]);

  // ========== TITLE (matching Figma LP design) ==========
  if (gameMode === 'title') {
    return (
    <div className="size-full flex flex-col items-center justify-between overflow-hidden" style={{ fontFamily: "'Inter', sans-serif", background: 'white', padding: '80px 40px 64px', position: 'relative' }}>
      <style>{animCSS}{`
        @keyframes lpGlow { 0%,100% { box-shadow: 0 0 15px rgba(18,218,138,0.3), inset 0 0 15px rgba(18,218,138,0.05); } 50% { box-shadow: 0 0 30px rgba(18,218,138,0.6), inset 0 0 20px rgba(18,218,138,0.1); } }
        @keyframes helpBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      `}</style>

      {/* Header: Let's Play Figma — matching Figma design */}
      <div className="flex flex-col items-center" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'relative', width: 784, height: 216 }}>
          {/* "Let's" */}
          <motion.p
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ position: 'absolute', left: 0, top: 58, fontSize: 64, color: 'black', lineHeight: '116px', fontWeight: 400, fontFamily: "'Inter', sans-serif", margin: 0 }}
          >Let&apos;s</motion.p>
          {/* "Learn" crossed out */}
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 0.2, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
            style={{ position: 'absolute', left: 162, top: 58, fontSize: 64, color: 'black', lineHeight: '116px', fontWeight: 400, fontFamily: "'Inter', sans-serif", textDecoration: 'line-through', margin: 0 }}
          >Learn</motion.p>
          {/* "Play" rotated — bounces in */}
          <motion.div
            initial={{ opacity: 0, scale: 0.3, rotate: 20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.35 }}
            style={{ position: 'absolute', left: 175, top: 0, width: 144, height: 134, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <p style={{ fontSize: 64, color: 'black', lineHeight: '116px', fontWeight: 400, fontFamily: "'Inter', sans-serif", transform: 'rotate(-8.96deg)', margin: 0 }}>Play</p>
          </motion.div>
          {/* Figma logo character (cropped from imgImage2) — hover to blink */}
          <motion.div
            onMouseEnter={() => setLpBlink(true)}
            onMouseLeave={() => setLpBlink(false)}
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.5 }}
            whileHover={{ scale: 1.08, rotate: -2, transition: { duration: 0.25 } }}
            style={{ position: 'absolute', left: 325, top: 16, width: 141, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <div style={{ transform: 'rotate(-6.04deg)' }}>
              <div style={{ width: 122, height: 188, position: 'relative', overflow: 'hidden' }}>
                <img src={imgImage2} alt="" style={{ position: 'absolute', width: '472.03%', height: '172.39%', left: '-0.38%', top: '-36.57%', maxWidth: 'none' }} />
              </div>
            </div>
          </motion.div>
          {/* Eyes on Figma logo — blink on hover */}
          <div style={{ position: 'absolute', left: 365, top: 27, width: 66, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <svg width="61" height="37" viewBox="0 0 60.8455 36.9065" fill="none" style={{ transform: 'rotate(9.3deg)' }}>
              {lpBlink ? (
                <g>
                  <circle cx="42.3922" cy="18.4532" fill="white" r="17.9545" stroke="#D8D8D8" strokeWidth="0.997473" />
                  <line x1="35" y1="18.45" x2="50" y2="18.45" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="18.4532" cy="18.4532" fill="white" r="17.9545" stroke="#D8D8D8" strokeWidth="0.997473" />
                  <line x1="11" y1="18.45" x2="26" y2="18.45" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              ) : (
                <g>
                  <circle cx="42.3922" cy="18.4532" fill="white" r="17.9545" stroke="#D8D8D8" strokeWidth="0.997473" />
                  <circle cx="50.8731" cy="18.9519" fill="black" r="7.48105" stroke="black" strokeWidth="0.997473" />
                  <circle cx="18.4532" cy="18.4532" fill="white" r="17.9545" stroke="#D8D8D8" strokeWidth="0.997473" />
                  <circle cx="23.9372" cy="14.962" fill="black" r="7.48105" stroke="black" strokeWidth="0.997473" />
                </g>
              )}
            </svg>
          </div>
          {/* "Figma" text (cropped from imgImage2) */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
            style={{ position: 'absolute', left: 466, top: 58, width: 318, height: 134, overflow: 'hidden' }}
          >
            <img src={imgImage2} alt="Figma" style={{ position: 'absolute', width: '129.14%', height: '172.39%', left: '-29.04%', top: '-36.57%', maxWidth: 'none' }} />
          </motion.div>
        </div>
      </div>

      {/* Description with colored body part icons */}
      <motion.div
        className="flex flex-col items-center gap-1"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6, ease: 'easeOut' }}
        style={{ maxWidth: 615, position: 'relative', zIndex: 1 }}
      >
        <p style={{ fontSize: 32, color: 'black', textAlign: 'center', lineHeight: '40px', fontWeight: 400 }}>
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.8, stiffness: 300, damping: 15 }} style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}><img src={imgRectangle65} alt="" style={{ width: 29, height: 29 }} /></motion.span>
          Get your way around Figma tools
          {' '}through a <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.95, stiffness: 300, damping: 15 }} style={{ display: 'inline-block', width: 29, height: 29, background: '#24CB71', borderRadius: '15px 0 0 15px', verticalAlign: 'middle', margin: '0 4px' }} />
          {' '}fun <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 1.1, stiffness: 300, damping: 15 }} style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '0 4px' }}><span style={{ width: 29, height: 29, background: '#FF7237', borderRadius: '0 15px 0 0', display: 'inline-block' }} /></motion.span>
          {' '}journey to find the <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 1.25, stiffness: 300, damping: 15 }} style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '0 4px' }}><img src={imgRectangle66} alt="" style={{ width: 29, height: 29 }} /></motion.span>
          {' '}rest of Figman&apos;s missing body parts!
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 1.4, stiffness: 300, damping: 15 }} style={{ display: 'inline-block', width: 29, height: 29, background: '#00B6FF', borderRadius: '50%', verticalAlign: 'middle', marginLeft: 4 }} />
        </p>
      </motion.div>

      {/* Figman character with dashed body + HELP text */}
      <motion.div
        className="flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.6, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.9 }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <div style={{ position: 'relative' }}>
          <motion.div
            animate={{ rotate: [9.3, 7, 11, 9.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <FigDashed scale={1.3} emotion="sad" />
          </motion.div>
          
        </div>
      </motion.div>

      {/* Play button */}
      <motion.button
        onClick={() => { resetGame(); setOnboardingPage(0); setShowOnboarding(true); setGameMode('playing'); }}
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 1.2 }}
        whileHover={{ scale: 1.04, transition: { duration: 0.2 } }}
        whileTap={{ scale: 0.97 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 550, padding: '24px 56px', borderRadius: 40, background: 'black', border: '1px solid #12da8a', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: 32, color: 'white', fontWeight: 400, lineHeight: '20px', animation: 'lpGlow 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}
      >Play</motion.button>
    </div>
  );
  }

  // ========== WON (Results screen with scoring) ==========
  if (gameMode === 'won') {
    const sd = finalScore || { time: 0, deaths: 0, objsCreated: 0, partsCollected: 4 };
    const { score, stars, timeBonus, survivalBonus, partBonus } = calcScore(sd);
    return (
      <div className="size-full flex flex-col items-center justify-between overflow-auto" style={{ fontFamily: "'Inter', sans-serif", background: 'white', padding: '60px 40px 48px' }}>
        <style>{animCSS}</style>

        {/* Header */}
        <div className="flex flex-col items-center animate-[fadeIn_0.6s_ease-out]">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <span style={{ fontSize: 48, color: 'black', lineHeight: 1.2, fontWeight: 400 }}>Figman is</span>
            <span style={{ fontSize: 48, color: 'black', lineHeight: 1.2, fontWeight: 400, transform: 'rotate(-4deg)', display: 'inline-block' }}>whole</span>
            <span style={{ fontSize: 48, color: 'black', lineHeight: 1.2, fontWeight: 400 }}>again!</span>
          </div>
          <p style={{ fontSize: 20, color: 'rgba(0,0,0,0.4)', marginTop: 8, fontWeight: 400 }}>You&apos;ve mastered Figma&apos;s essential shortcuts</p>
        </div>

        {/* Figman complete + stars */}
        <div className="flex flex-col items-center gap-3 animate-[fadeIn_0.8s_ease-out]">
          <div style={{ transform: 'rotate(9.3deg)' }}>
            <FigComplete scale={1.3} />
          </div>
          {/* Stars */}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {[0, 1, 2].map(i => (
              <svg key={i} width="32" height="32" viewBox="0 0 24 24" fill={i < stars ? '#FF7237' : 'none'} stroke={i < stars ? '#FF7237' : '#ccc'} strokeWidth="1.5" style={{ animation: i < stars ? `starPop 0.4s ${0.3 + i * 0.15}s ease-out both` : undefined }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
          </div>
          {/* Score */}
          <div style={{ fontSize: 48, color: 'black', fontWeight: 400, lineHeight: 1 }}>{score.toLocaleString()}</div>
          <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.35)', marginTop: -4, fontWeight: 400 }}>points</p>
        </div>

        {/* Score breakdown */}
        <div className="animate-[fadeIn_1s_ease-out]" style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 420 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Timer size={20} color="rgba(0,0,0,0.5)" strokeWidth={1.8} /></div>
              <div><div style={{ fontSize: 15, color: 'black', fontWeight: 500 }}>Time</div><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>{formatTime(sd.time)}</div></div>
            </div>
            <span style={{ fontSize: 15, color: timeBonus > 0 ? '#24CB71' : 'rgba(0,0,0,0.35)', fontWeight: 500 }}>{timeBonus > 0 ? `+${timeBonus.toLocaleString()}` : '0'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: sd.deaths === 0 ? 'rgba(36,203,113,0.06)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Skull size={20} color={sd.deaths === 0 ? '#24CB71' : 'rgba(0,0,0,0.5)'} strokeWidth={1.8} /></div>
              <div><div style={{ fontSize: 15, color: 'black', fontWeight: 500 }}>Survival</div><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>{sd.deaths === 0 ? 'No deaths!' : `${sd.deaths} death${sd.deaths !== 1 ? 's' : ''}`}</div></div>
            </div>
            <span style={{ fontSize: 15, color: survivalBonus > 0 ? '#24CB71' : 'rgba(0,0,0,0.35)', fontWeight: 500 }}>{survivalBonus > 0 ? `+${survivalBonus.toLocaleString()}` : '0'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wrench size={20} color="rgba(0,0,0,0.5)" strokeWidth={1.8} /></div>
              <div><div style={{ fontSize: 15, color: 'black', fontWeight: 500 }}>Objects Created</div><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>{sd.objsCreated} object{sd.objsCreated !== 1 ? 's' : ''}</div></div>
            </div>
            <span style={{ fontSize: 15, color: 'rgba(0,0,0,0.35)', fontWeight: 500 }}>&mdash;</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(36,203,113,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Puzzle size={20} color="#24CB71" strokeWidth={1.8} /></div>
              <div><div style={{ fontSize: 15, color: 'black', fontWeight: 500 }}>Body Parts</div><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>{sd.partsCollected} / 4 collected</div></div>
            </div>
            <span style={{ fontSize: 15, color: partBonus > 0 ? '#24CB71' : 'rgba(0,0,0,0.35)', fontWeight: 500 }}>{partBonus > 0 ? `+${partBonus.toLocaleString()}` : '0'}</span>
          </div>

          {/* Shortcuts learned */}
          
        </div>

        {/* Back to Start */}
        <button
          onClick={() => { resetGame(); setGameMode('title'); }}
          className="animate-[fadeIn_1.2s_ease-out]"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 550, padding: '24px 56px', borderRadius: 40, background: 'white', border: '1px solid #12da8a', cursor: 'pointer', transition: 'opacity 0.2s', fontFamily: "'Inter', sans-serif", fontSize: 32, color: 'black', fontWeight: 400, lineHeight: '20px' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >Back to Start</button>
      </div>
    );
  }

  // ========== PLAYING ==========
  const now_ = Date.now();
  const { cx, cy, tool } = rs;
  const inTool = tool !== 'none';

  // Background color shifts with stage progress: green - red - purple - blue
  const progress = Math.min(1, Math.max(0, rs.px / GOAL.x));
  const bgStops: [number,number,number][] = [[36,203,113],[255,55,55],[135,79,255],[0,182,255]];
  const bgLerp = (t: number): [number,number,number] => {
    const seg = t * (bgStops.length - 1);
    const i = Math.min(Math.floor(seg), bgStops.length - 2);
    const f = seg - i;
    return bgStops[i].map((v, k) => Math.round(v + (bgStops[i+1][k] - v) * f)) as [number,number,number];
  };
  const [bgR, bgG, bgB] = bgLerp(progress);
  const pastel = (v: number) => Math.round(v + (255 - v) * 0.82);
  const bgColor = `rgb(${pastel(bgR)},${pastel(bgG)},${pastel(bgB)})`;

  return (
    <div className="size-full overflow-hidden relative select-none"
      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: bgColor, transition: 'background-color 0.6s ease', cursor: tool === 'none' ? 'default' : tool === 'text' ? 'text' : 'crosshair' }}
      tabIndex={0}>
      <style>{animCSS}</style>

      {/* Subtle dot grid overlay — pure CSS, zero JS per frame */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.08, backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '32px 32px', color: `rgb(${bgR},${bgG},${bgB})` }} />

      {inTool && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, background: 'rgba(245,245,245,0.2)', backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundPosition: `${-cx % 20}px ${-cy % 20}px` }} />}

      {/* ===== WORLD ===== */}
      <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${-cx}px, ${-cy}px)`, willChange: 'transform' }}>

        {/* ===== STAGE WITH FIRE (Figma: fire group SVG on top + white paper bg below) ===== */}
        {STAGE_WITH_FIRE.map((s, i) => (
          <div key={`swf${i}`} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
            {/* White paper bg (behind, z-index 0) */}
            <div style={{ position: 'absolute', left: s.bx, top: s.by, width: s.bw, height: s.bh,
              background: '#f5f5f5', boxShadow: '0px 10px 17.6px 0px rgba(0,0,0,0.12)',
              transform: s.bRot ? `rotate(${s.bRot}deg)` : undefined, zIndex: 0 }} />
            {/* Fire group SVG (behind paper bg, z-index -1) */}
            <div style={{ position: 'absolute', left: s.fx, top: s.fy, pointerEvents: 'none', zIndex: -1 }}>
              <FigmaFireGroup paths={s.paths} w={s.fw} h={s.fh} rot={s.fRot} />
            </div>
          </div>
        ))}

        {/* Standalone background papers (no fire, z-index 0) */}
        {STANDALONE_BG.map((bg, i) => (
          <div key={`sbg${i}`} style={{ position: 'absolute', left: bg.x, top: bg.y, width: bg.w, height: bg.h,
            background: '#f5f5f5', boxShadow: '0px 10px 17.6px 0px rgba(0,0,0,0.12)',
            transform: bg.rot ? `rotate(${bg.rot}deg)` : undefined, zIndex: 0 }} />
        ))}


        {/* Stage decorations — Figma lines 265-282 */}
        {/* Stage装飾 1 (rot 34.15deg) */}
        <div style={{ position: 'absolute', left: -60, top: 1050, width: 142, height: 556, transform: 'rotate(34.15deg)', overflow: 'hidden', zIndex: 1 }}>
          
        </div>
        {/* Stage装飾 2 (rot -10.5deg) */}
        <div style={{ position: 'absolute', left: 680, top: 1140, width: 142, height: 556, transform: 'rotate(-10.5deg)', overflow: 'hidden', zIndex: 1 }}>
          
        </div>
        {/* Screenshot strip (Figma line 243-247) */}
        <div style={{ position: 'absolute', left: 300, top: 1280, width: 290, height: 30, overflow: 'hidden', zIndex: 1 }}>
          
        </div>
        
        

        {/* Signs */}
        {SIGNS.filter(s => rs.ab.includes(s.ability)).map((s, i) => <div key={`s${i}`} style={{ position: 'absolute', left: s.x, top: s.y, background: 'rgba(255,255,255,0.88)', padding: '8px 14px', borderRadius: 10, fontSize: 12, color: '#555', whiteSpace: 'nowrap', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', pointerEvents: 'none', lineHeight: 1.5, zIndex: 3, display: 'flex', alignItems: 'center', gap: 5 }}>{'icon' in s && s.icon === 'flame' && <Flame size={14} color="#FF3737" />}{s.text}</div>)}

        {/* Body parts */}
        {bpRef.current.filter(bp => !rs.cp.includes(bp.id)).map(bp => (
          <div key={bp.id} style={{ position: 'absolute', left: bp.x, top: bp.y, width: 50, height: 50, animation: 'float 1.2s ease-in-out infinite alternate', zIndex: 4 }}>
            {bp.id === 'green' && <svg width="50" height="50" viewBox="0 0 63 63" fill="none" style={{ filter: `drop-shadow(0 0 12px ${bp.color}55)` }}><path d={stageSvg.pb50f680} fill={bp.color} /></svg>}
            {bp.id === 'red' && <div style={{ width: 50, height: 50, background: bp.color, borderRadius: '41px 0 0 41px', boxShadow: `0 0 20px ${bp.color}55` }} />}
            {bp.id === 'purple' && <svg width="50" height="50" viewBox="0 0 63 63" fill="none" style={{ filter: `drop-shadow(0 0 12px ${bp.color}55)` }}><path d={stageSvg.p39ec9900} fill={bp.color} /></svg>}
            {bp.id === 'blue' && <div style={{ width: 50, height: 50, background: bp.color, borderRadius: 41, boxShadow: `0 0 20px ${bp.color}55` }} />}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18 }}>{bp.key}</div>
            <div style={{ position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: 12, padding: '2px 10px', fontSize: 10, color: '#999', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>Grab me!</div>
          </div>
        ))}

        {/* ===== CREATED OBJECTS ===== */}
        {rs.objs.map(obj => {
          const age = now_ - obj.createdAt; const fadeStart = OBJ_LIFETIME - 8000;
          const opacity = age > fadeStart ? Math.max(0.15, 1 - (age - fadeStart) / 8000) : 1;
          const isFrame = obj.type === 'frame';
          if (isFrame) {
            // Frame = pocket dimension visual
            return (
              <div key={obj.id} style={{ position: 'absolute', left: obj.x, top: obj.y, width: obj.w, height: obj.h, opacity, zIndex: 3, border: '2.5px solid #333', borderRadius: 2, background: 'rgba(100,100,200,0.06)', backgroundImage: 'radial-gradient(circle, rgba(100,100,200,0.06) 1px, transparent 1px)', backgroundSize: '12px 12px' }}>
                <div style={{ position: 'absolute', top: -18, left: 0, fontSize: 10, color: '#333', fontWeight: 600, background: 'rgba(255,255,255,0.8)', padding: '0 4px', borderRadius: 2 }}>Frame</div>
                {rs.insideFrame && <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(100,100,255,0.3)', borderRadius: 2, animation: 'pulse 1.5s ease-in-out infinite' }} />}
              </div>
            );
          }
          const st: Record<string, { bg: string; border: string }> = {
            rectangle: { bg: 'rgba(36,203,113,0.18)', border: '#24CB71' },
            text: { bg: 'rgba(255,255,255,0.92)', border: '#00B6FF' },
          };
          const c = st[obj.type] || { bg: 'rgba(200,200,200,0.3)', border: '#999' };
          return (
            <div key={obj.id} style={{ position: 'absolute', left: obj.x, top: obj.y, width: obj.w, height: obj.h, background: c.bg, border: `2px solid ${c.border}`, borderRadius: 4, opacity, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: obj.type === 'text' ? 14 : 10, color: c.border, fontWeight: obj.type === 'text' ? 600 : 400, boxShadow: `0 0 8px ${c.border}22`, zIndex: 3 }}>
              {obj.label || ''}
            </div>
          );
        })}

        {/* ===== PEN RAILS (spline ziplines) ===== */}
        {rs.rails.map(rail => {
          const age = now_ - rail.createdAt; const fadeStart = OBJ_LIFETIME - 8000;
          const opacity = age > fadeStart ? Math.max(0.15, 1 - (age - fadeStart) / 8000) : 1;
          const first = rail.samples[0]; const last = rail.samples[rail.samples.length - 1];
          return (
            <svg key={rail.id} style={{ position: 'absolute', top: 0, left: 0, width: 9999, height: 3000, pointerEvents: 'none', zIndex: 3, opacity }}>
              {/* Glow */}
              <path d={ptsToD(rail.samples)} stroke="rgba(135,79,255,0.2)" strokeWidth="10" fill="none" strokeLinecap="round" />
              {/* Main line */}
              <path d={ptsToD(rail.samples)} stroke="#874FFF" strokeWidth="4" fill="none" strokeLinecap="round" />
              {/* Dashes for rail effect */}
              <path d={ptsToD(rail.samples)} stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" strokeDasharray="8,12" strokeLinecap="round" />
              {/* Endpoints — glowing circles to indicate touchable */}
              {!rs.zip && <g>
                <circle cx={first.x} cy={first.y} r="12" fill="rgba(135,79,255,0.15)" stroke="#874FFF" strokeWidth="2" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
                <circle cx={first.x} cy={first.y} r="5" fill="#874FFF" />
                <circle cx={last.x} cy={last.y} r="12" fill="rgba(135,79,255,0.15)" stroke="#874FFF" strokeWidth="2" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
                <circle cx={last.x} cy={last.y} r="5" fill="#874FFF" />
              </g>}
            </svg>
          );
        })}

        {/* Zipline rider indicator */}
        {rs.zip && (() => {
          const rail = rs.rails.find(r => r.id === rs.zip!.railId);
          if (!rail) return null;
          const idx = Math.min(Math.floor(rs.zip.t), rail.samples.length - 1);
          const nxt = Math.min(idx + 1, rail.samples.length - 1);
          const frac = rs.zip.t - idx;
          const ptX = rail.samples[idx].x + (rail.samples[nxt].x - rail.samples[idx].x) * frac;
          const ptY = rail.samples[idx].y + (rail.samples[nxt].y - rail.samples[idx].y) * frac;
          return (
            <div style={{ position: 'absolute', left: ptX - 8, top: ptY - 8, width: 16, height: 16, borderRadius: '50%', background: 'rgba(135,79,255,0.4)', border: '2px solid #874FFF', zIndex: 11, animation: 'pulse 0.5s ease-in-out infinite' }} />
          );
        })()}

        {/* 404 Enemies */}
        {rs.enemies.map((en, ei) => {
          const def = ENEMIES_404[ei];
          return (
            <div key={`e404_${ei}`} style={{
              position: 'absolute',
              left: en.x,
              top: def.groundY - def.h,
              width: def.w,
              height: def.h,
              zIndex: 6,
              transform: en.dir < 0 ? 'scaleX(-1)' : 'none',
            }}>
              <div style={{
                position: 'relative',
                width: '100%', height: '100%',
                userSelect: 'none',
                animation: 'enemyBob 0.4s ease-in-out infinite alternate',
              }}>
                {/* 404 text */}
                <p style={{ position: 'absolute', fontFamily: "'Inter', sans-serif", fontWeight: 400, lineHeight: 1, left: 0, top: 6, fontSize: 34, color: '#FF1F1F', margin: 0, letterSpacing: -1 }}>404</p>
                {/* Eyes on the 0 */}
                <svg style={{ position: 'absolute', left: 24, top: 2, width: 24, height: 17 }} fill="none" viewBox="0 0 66.804 47.9095">
                  <circle cx="43" cy="23.6451" fill="white" r="18.5" stroke="#D8D8D8" />
                  <circle cx="51.5" cy="24.1451" fill="black" r="8" stroke="black" />
                  <path d={enemySvg.p1b9dec00} fill="#FF1F1F" />
                  <circle cx="19" cy="23.6451" fill="white" r="18.5" stroke="#D8D8D8" />
                  <circle cx="23.5" cy="29.1451" fill="black" r="8" stroke="black" />
                </svg>
                {/* Beret hat */}
                <svg style={{ position: 'absolute', left: 24, top: -4, width: 18, height: 14 }} fill="none" viewBox="0 0 38.2837 19.5">
                  <path d={enemySvg.p25ee9f80} fill="#FF1F1F" transform="rotate(30 19.14 9.75)" />
                </svg>
              </div>

            </div>
          );
        })}

        {/* Goal flag — matches Figma Goal component exactly */}
        {(() => {
          const isEditing = tool === 'text' && rs.textInput?.targetId === 'flag';
          const flagText = rs.flagActivated ? 'GOAL' : isEditing ? (rs.textInput!.text || '') : '????';
          const flagColor = rs.flagActivated ? '#24CB71' : isEditing ? '#0D99FF' : 'white';
          return (
            <div style={{ position: 'absolute', left: GOAL.x + 95, top: GOAL.y - 280, zIndex: 4 }}>
              {/* White pole — Figma: stroke white, strokeWidth 26, strokeLinecap round */}
              <svg width="26" height="400" viewBox="0 0 26 400" style={{ position: 'absolute', left: 0, top: 0 }}>
                <path d="M13 387V13" stroke="white" strokeLinecap="round" strokeWidth="2" />
              </svg>
              {/* Triangle flag — Figma: p13718100 rotated 90deg */}
              <div style={{ position: 'absolute', left: 13, top: -5, width: 200, height: 70, overflow: 'visible' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 200, height: 70 }}>
                  <div style={{ transform: 'rotate(90deg)', transformOrigin: 'center center' }}>
                    <svg width="70" height="200" viewBox="0 0 184.463 1092" fill="none" preserveAspectRatio="none">
                      <path d={stageSvg.p13718100} fill={flagColor} style={{ transition: 'fill 0.3s' }} />
                    </svg>
                  </div>
                </div>
              </div>
              {/* Flag text */}
              <p style={{ position: 'absolute', left: rs.flagActivated ? 55 : 40, top: 15, fontSize: 20, fontWeight: 400, color: 'black', transition: 'color 0.3s', whiteSpace: 'nowrap', fontFamily: "'Inter', sans-serif" }}>
                {flagText}
                {isEditing && <span style={{ display: 'inline-block', width: 2, height: 18, background: 'black', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-start infinite' }} />}
              </p>

            </div>
          );
        })()}

        {/* ===== TOOL PREVIEWS ===== */}
        {rs.drag && (tool === 'rectangle' || tool === 'frame') && (() => {
          const x = Math.min(rs.drag.sx, rs.drag.cx), y = Math.min(rs.drag.sy, rs.drag.cy);
          const w = Math.abs(rs.drag.cx - rs.drag.sx), h = Math.abs(rs.drag.cy - rs.drag.sy);
          const isFrame = tool === 'frame';
          return (
            <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, border: isFrame ? '2.5px solid #333' : '2px dashed #0D99FF', background: isFrame ? 'rgba(100,100,200,0.06)' : 'rgba(13,153,255,0.06)', pointerEvents: 'none', zIndex: 8 }}>
              {isFrame && <div style={{ position: 'absolute', top: -18, left: 0, fontSize: 10, color: '#333', fontWeight: 600 }}>Frame</div>}
              {w > 20 && h > 20 && <div style={{ position: 'absolute', bottom: -22, right: 0, background: isFrame ? '#333' : '#0D99FF', color: 'white', padding: '1px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{Math.round(w)} × {Math.round(h)}</div>}
            </div>
          );
        })()}

        {/* Pen spline preview */}
        {tool === 'pen' && rs.penPts.length >= 1 && (() => {
          const allPts = [...rs.penPts, rs.mw];
          const previewSamples = allPts.length >= 2 ? sampleCR(allPts, 15) : [];
          const confirmedSamples = rs.penPts.length >= 2 ? sampleCR(rs.penPts, 15) : [];
          return (
            <svg style={{ position: 'absolute', top: 0, left: 0, width: 9999, height: 3000, pointerEvents: 'none', zIndex: 8 }}>
              {confirmedSamples.length > 0 && <path d={ptsToD(confirmedSamples)} stroke="#874FFF" strokeWidth="3" fill="none" strokeLinecap="round" />}
              {previewSamples.length > confirmedSamples.length && <path d={ptsToD(previewSamples.slice(Math.max(0, confirmedSamples.length - 1)))} stroke="#874FFF" strokeWidth="2" fill="none" strokeDasharray="6,4" opacity="0.5" strokeLinecap="round" />}
              {rs.penPts.map((p, i) => <circle key={`pt${i}`} cx={p.x} cy={p.y} r="5" fill="white" stroke="#874FFF" strokeWidth="2" />)}
            </svg>
          );
        })()}

        {/* Text editing is now rendered inline on the flag */}

        {/* Player */}
        <div style={{ position: 'absolute', left: rs.px, top: rs.py, width: PW, height: PH, zIndex: 10 }}>
          <PlayerChar abilities={rs.ab} facingRight={rs.fr} dead={rs.dead} eyeEmotion={rs.eyeEmotion} vx={rs.vx} vy={rs.vy} onGround={rs.onGround} />
        </div>

        {/* Death scatter pieces - actual Figma body parts */}
        {rs.scatter.map((sp, i) => {
          const sz = 24;
          const partColors = ['#FF3737', '#FF7237', '#874FFF', '#00B6FF', '#24CB71'];
          const c = partColors[sp.partIndex] || '#999';
          const vb = SCATTER_PARTS[sp.partIndex]?.vb || '0 0 65 65';
          return (
            <div key={`scatter-${i}`} style={{
              position: 'absolute', left: sp.x - sz / 2, top: sp.y - sz / 2,
              width: sz, height: sz, opacity: sp.opacity, zIndex: 11,
              transform: `rotate(${sp.rot}deg)`, pointerEvents: 'none',
            }}>
              <svg width={sz} height={sz} viewBox={vb} fill="none">
                {sp.partIndex === 0 && <path d={figBodyPaths.p1d534800} fill={c} />}
                {sp.partIndex === 1 && <path d={figBodyPaths.p1e8a7f00} fill={c} />}
                {sp.partIndex === 2 && <path d={figBodyPaths.p31b4900} fill={c} />}
                {sp.partIndex === 3 && <rect x="64.5" y="64.5" width="63" height="63" rx="31.5" fill={c} />}
                {sp.partIndex === 4 && <path d={figBodyPaths.p1bc24180} fill={c} />}
              </svg>
            </div>
          );
        })}

        {/* Figman speech bubble */}
        {rs.speech && (
          <div style={{ position: 'absolute', left: rs.px + PW / 2, top: rs.py - 48, transform: 'translateX(-50%)', zIndex: 12, pointerEvents: 'none', animation: 'speechBubble 0.3s ease-out' }}>
            <div style={{ background: 'white', borderRadius: 16, padding: '6px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', fontSize: 13, fontWeight: 500, color: '#333', whiteSpace: 'nowrap', fontFamily: "'Inter', sans-serif", position: 'relative' }}>
              {rs.speech}
              <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 10, height: 10, background: 'white', boxShadow: '2px 2px 4px rgba(0,0,0,0.08)' }} />
            </div>
          </div>
        )}
      </div>

      {/* ===== UNIFIED HUD ===== */}
      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 30 }}>
        {/* Main HUD bar */}
        <div data-toolbar="true" style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'white', borderRadius: 14, padding: '4px 6px', boxShadow: '0 2px 16px rgba(0,0,0,0.12)' }}>
          {/* Body parts section */}
          <div style={{ display: 'flex', gap: 3, padding: '0 6px', alignItems: 'center' }}>
            {BODY_PARTS_INIT.map(bp => {
              const u = rs.ab.includes(bp.ability);
              return <div key={bp.id} style={{ width: 30, height: 30, borderRadius: 7, background: u ? `${bp.color}20` : 'rgba(0,0,0,0.03)', border: u ? `2px solid ${bp.color}` : '2px dashed rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: u ? 1 : 0.35, boxShadow: u ? `0 0 8px ${bp.color}33` : 'none', transition: 'all 0.3s' }}>
                <div style={{ width: 14, height: 14, background: u ? bp.color : '#ccc', borderRadius: bp.id === 'blue' ? '50%' : bp.id === 'red' ? '4px 0 0 4px' : bp.id === 'green' ? '0 50% 50% 0' : '2px 0 2px 0' }} />
              </div>;
            })}
          </div>

          <div style={{ width: 1, height: 24, background: '#eee', margin: '0 4px' }} />

          {/* Toolbar section */}
          {rs.ab.length > 0 ? (
            <div style={{ display: 'contents' }}>
              <ToolBtn label="V" name="Move" active={tool === 'none'} enabled color="#333" onActivate={exitTool} />
              <div style={{ width: 1, height: 24, background: '#eee', margin: '0 2px' }} />
              <ToolBtn label="R" name="Rectangle" active={tool === 'rectangle'} enabled={rs.ab.includes('rectangle')} color="#24CB71" onActivate={() => { exitTool(); toolRef.current = 'rectangle'; }} />
              <ToolBtn label="F" name="Frame" active={tool === 'frame'} enabled={rs.ab.includes('frame')} color="#FF3737" onActivate={() => { exitTool(); toolRef.current = 'frame'; }} />
              <ToolBtn label="P" name="Pen" active={tool === 'pen'} enabled={rs.ab.includes('pen')} color="#874FFF" onActivate={() => { exitTool(); toolRef.current = 'pen'; }} />
              <ToolBtn label="T" name="Text" active={tool === 'text'} enabled={rs.ab.includes('text')} color="#00B6FF" onActivate={() => { exitTool(); tryEditText(); }} />
              <div style={{ width: 1, height: 24, background: '#eee', margin: '0 4px' }} />
            </div>
          ) : (
            <div style={{ display: 'contents' }}>
              <div style={{ padding: '0 8px', fontSize: 11, color: 'rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>Collect parts to unlock tools</div>
              <div style={{ width: 1, height: 24, background: '#eee', margin: '0 4px' }} />
            </div>
          )}

          {/* Timer + Deaths section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'rgba(0,0,0,0.45)', fontWeight: 500 }}>
              <Timer size={14} strokeWidth={2} /> {formatTime(rs.elapsed)}
            </div>
            {rs.deaths > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#FF3737', fontWeight: 500 }}>
                <Skull size={14} strokeWidth={2} /> {rs.deaths}
              </div>
            )}
          </div>
        </div>

        {/* Contextual messages below the bar */}
        {inTool && TOOL_INSTRUCTIONS[tool] && (
          <div style={{ background: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: 20, padding: '5px 16px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', animation: 'fadeIn 0.2s' }}>
            {TOOL_INSTRUCTIONS[tool]}<span style={{ marginLeft: 10, opacity: 0.5, fontSize: 11 }}>V / Esc to cancel</span>
          </div>
        )}
        {rs.zip && (
          <div style={{ background: 'rgba(135,79,255,0.9)', color: 'white', borderRadius: 20, padding: '5px 16px', fontSize: 12, fontWeight: 600, animation: 'fadeIn 0.2s' }}>
            Riding zipline! <kbd style={{ ...kbd, background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)' }}>Space</kbd> to jump off
          </div>
        )}
        {rs.insideFrame && !inTool && (
          <div style={{ background: 'rgba(51,51,51,0.85)', color: 'white', borderRadius: 20, padding: '5px 16px', fontSize: 12, fontWeight: 600, animation: 'fadeIn 0.2s' }}>Inside Frame — fire can't hurt you!</div>
        )}
        {rs.hint && <div style={{ background: 'white', borderRadius: 50, padding: '10px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', fontSize: 14, fontWeight: 600, color: '#333', maxWidth: 500, textAlign: 'center', animation: 'slideDown 0.3s ease-out' }}>{rs.hint}</div>}
      </div>

      {rs.msg && <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 28, fontWeight: 800, color: 'white', textShadow: '0 2px 12px rgba(0,0,0,0.3)', animation: 'abilityMsg 0.8s ease-out forwards', pointerEvents: 'none', zIndex: 25 }}>{rs.msg}</div>}
      {rs.dead && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,0,0,0.15)', pointerEvents: 'none', zIndex: 20, animation: 'fadeIn 0.2s' }}><div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', fontSize: 32, fontWeight: 800, textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>Oops!</div></div>}
      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.5)', borderRadius: 12, padding: '6px 16px', fontSize: 12, color: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 25 }}>
        {inTool ? (
          <span>
            {tool === 'rectangle' && <span><kbd style={kbd}>Click</kbd> + <kbd style={kbd}>Drag</kbd> to draw rectangle</span>}
            {tool === 'frame' && <span><kbd style={kbd}>Click</kbd> + <kbd style={kbd}>Drag</kbd> to draw frame (fire shield!)</span>}
            {tool === 'pen' && <span><kbd style={kbd}>Click</kbd> add point &nbsp; <kbd style={kbd}>Enter</kbd> draw line &nbsp; <kbd style={kbd}>Ctrl+Z</kbd> undo</span>}
            {tool === 'text' && <span><kbd style={kbd}>Click</kbd> place &nbsp; Type text &nbsp; <kbd style={kbd}>Enter</kbd> confirm</span>}
          </span>
        ) : (
          <span>
            <kbd style={kbd}>A</kbd><kbd style={{ ...kbd, marginLeft: 2 }}>D</kbd> Move &nbsp; <kbd style={kbd}>Space</kbd> Jump
            {rs.ab.length > 0 && <span style={{ marginLeft: 10, borderLeft: '1px solid rgba(0,0,0,0.15)', paddingLeft: 10 }}>
              {rs.ab.includes('rectangle') && <span style={{ color: '#24CB71', marginRight: 6 }}><kbd style={{ ...kbd, borderColor: '#24CB7133' }}>R</kbd></span>}
              {rs.ab.includes('frame') && <span style={{ color: '#FF3737', marginRight: 6 }}><kbd style={{ ...kbd, borderColor: '#FF373733' }}>F</kbd></span>}
              {rs.ab.includes('pen') && <span style={{ color: '#874FFF', marginRight: 6 }}><kbd style={{ ...kbd, borderColor: '#874FFF33' }}>P</kbd></span>}
              {rs.ab.includes('text') && <span style={{ color: '#00B6FF' }}><kbd style={{ ...kbd, borderColor: '#00B6FF33' }}>T</kbd></span>}
            </span>}
          </span>
        )}
      </div>

      {/* Onboarding overlay */}
      {showOnboarding && (
        <div
          onClick={() => {
            if (onboardingPage < 3) { setOnboardingPage(p => p + 1); }
            else { setShowOnboarding(false); startTimeRef.current = Date.now(); }
          }}
          style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
        >
          {/* Page content with key-based animation */}
          <div key={onboardingPage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 500, textAlign: 'center', animation: 'fadeIn 0.4s ease-out' }}>

            {/* PAGE 0: Meet Figman */}
            {onboardingPage === 0 && (<div style={{ display: 'contents' }}>
              <div style={{ animation: 'float 2s ease-in-out infinite alternate' }}>
                <FigComplete scale={2} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 28, color: 'white', fontWeight: 600, lineHeight: 1.3 }}>Meet Figman!</p>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                  He lives inside every Figma file,<br />
                  made of <span style={{ color: '#12da8a' }}>5 powerful tool pieces</span> that designers use every day.
                </p>
              </div>
              {/* Body part legend */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[
                  { color: '#FF3737', name: 'Frame' },
                  { color: '#FF7237', name: 'Core' },
                  { color: '#874FFF', name: 'Pen' },
                  { color: '#00B6FF', name: 'Text' },
                  { color: '#24CB71', name: 'Rectangle' },
                ].map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: '4px 12px 4px 6px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>)}

            {/* PAGE 1: The disaster */}
            {onboardingPage === 1 && (<div style={{ display: 'contents' }}>
              <div style={{ position: 'relative', animation: 'float 2s ease-in-out infinite alternate' }}>
                <FigDashed scale={2} emotion="sad" />
                <div style={{ position: 'absolute', right: -40, top: 0, fontSize: 20, animation: 'pulse 1.5s ease-in-out infinite' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>?!</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 28, color: 'white', fontWeight: 600, lineHeight: 1.3 }}>But then...</p>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                  Someone hit <span style={{ color: '#FF6B35', fontWeight: 600 }}>Ctrl+Z</span> one too many times<br />
                  and accidentally <span style={{ color: 'white' }}>undid Figman himself</span>.
                </p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, marginTop: 4 }}>
                  His body parts scattered across the canvas.<br />
                  Now he{"'"}s just an outline, barely holding together...
                </p>
              </div>
            </div>)}

            {/* PAGE 2: The mission */}
            {onboardingPage === 2 && (<div style={{ display: 'contents' }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ opacity: 0.4 }}><FigDashed scale={1.4} emotion="sad" /></div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <svg width="40" height="20" viewBox="0 0 40 20" fill="none"><path d="M2 10h30m0 0l-6-6m6 6l-6 6" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <FigComplete scale={1.4} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 28, color: 'white', fontWeight: 600, lineHeight: 1.3 }}>Help Figman get whole again!</p>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                  Find each missing body part in the world.<br />
                  Every piece you collect unlocks a <span style={{ color: '#12da8a' }}>Figma shortcut</span> tool.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 4 }}>
                  {[
                    { key: 'R', color: '#24CB71', name: 'Rectangle' },
                    { key: 'F', color: '#FF3737', name: 'Frame' },
                    { key: 'P', color: '#874FFF', name: 'Pen' },
                    { key: 'T', color: '#00B6FF', name: 'Text' },
                  ].map(t => (
                    <div key={t.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${t.color}20`, border: `2px solid ${t.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: t.color }}>{t.key}</div>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>)}

            {/* PAGE 3: Controls */}
            {onboardingPage === 3 && (<div style={{ display: 'contents' }}>
              <p style={{ fontSize: 24, color: 'white', fontWeight: 600, lineHeight: 1.3 }}>Controls</p>
              <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 28px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={obKey}>W</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <div style={obKey}>A</div>
                      <div style={obKey}>S</div>
                      <div style={obKey}>D</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Move</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', paddingTop: 16 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500, transform: 'translateY(-6px)', display: 'inline-block' }}>or</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={obKey}><ArrowUp size={16} strokeWidth={2.5} /></div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <div style={obKey}><ArrowLeft size={16} strokeWidth={2.5} /></div>
                      <div style={obKey}><ArrowDown size={16} strokeWidth={2.5} /></div>
                      <div style={obKey}><ArrowRight size={16} strokeWidth={2.5} /></div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Move</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 28 }}>
                  <div style={{ ...obKey, width: 100, fontSize: 12 }}>Space</div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Jump</span>
                </div>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                Collect body parts. Learn shortcuts. Save Figman!
              </p>
            </div>)}
          </div>

          {/* Page dots + prompt */}
          <div style={{ position: 'absolute', bottom: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ width: i === onboardingPage ? 20 : 8, height: 8, borderRadius: 4, background: i === onboardingPage ? 'white' : 'rgba(255,255,255,0.25)', transition: 'all 0.3s' }} />
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 400, animation: 'pulse 2s ease-in-out infinite' }}>
              {onboardingPage < 3 ? 'Click or press any key to continue' : 'Click or press any key to start!'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const obKey: React.CSSProperties = { width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 15, fontWeight: 600 };
const kbd: React.CSSProperties = { background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)' };
const animCSS = `
  @keyframes flameFlicker { 0%, 100% { transform: scaleY(1) scaleX(1); } 50% { transform: scaleY(1.04) scaleX(0.97); } }
  @keyframes float { 0% { transform: translateY(0px); } 100% { transform: translateY(-10px); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  @keyframes abilityMsg { 0% { opacity:1; transform: translate(-50%,-50%) scale(0.8); } 50% { opacity:1; transform: translate(-50%,-50%) scale(1.1); } 100% { opacity:0; transform: translate(-50%,-60%) scale(1); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  @keyframes blink { 50% { opacity:0; } }
  @keyframes starPop { 0% { transform: scale(0) rotate(-30deg); opacity:0; } 60% { transform: scale(1.3) rotate(5deg); opacity:1; } 100% { transform: scale(1) rotate(0deg); opacity:1; } }
  @keyframes speechBubble { 0% { opacity:0; transform: translateX(-50%) translateY(8px) scale(0.8); } 100% { opacity:1; transform: translateX(-50%) translateY(0) scale(1); } }
  @keyframes figmanWalk { 0% { transform: translateY(0) rotate(-1.5deg); } 100% { transform: translateY(-2px) rotate(1.5deg); } }
  @keyframes enemyBob { 0% { transform: translateY(0); } 100% { transform: translateY(-3px); } }
  @keyframes enemyLegL { 0% { height: 6px; } 100% { height: 2px; } }
  @keyframes enemyLegR { 0% { height: 2px; } 100% { height: 6px; } }
`;
