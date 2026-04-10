import type { ReactNode } from 'react';
import type { MellyMood } from '../types';
import { colors } from '../theme';

const MOOD_COPY: Record<MellyMood, string> = {
  idle: 'Ready when you are.',
  speaking: 'Asking…',
  listening: 'Listening closely.',
  thinking: 'Reviewing your answer…',
  happy: 'Nice — strong moment!',
  encouraging: 'We can sharpen that together.',
};

type Props = {
  mood: MellyMood;
  compact?: boolean;
};

/** Inline SVG: Melly as a stylised professional woman with headset. */
function MellyLadySvg({ mood }: { mood: MellyMood }) {
  const thinking = mood === 'thinking';
  const happy = mood === 'happy';
  const speaking = mood === 'speaking';
  const encouraging = mood === 'encouraging';

  let mouth: ReactNode;
  if (speaking) {
    mouth = <ellipse cx="50" cy="63" rx="5" ry="6" fill="#1a1528" />;
  } else if (happy) {
    mouth = (
      <path
        d="M 40 62 Q 50 72 60 62"
        fill="none"
        stroke="#1a1528"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    );
  } else if (encouraging) {
    mouth = (
      <path
        d="M 41 63 Q 50 68 59 63"
        fill="none"
        stroke="#1a1528"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    );
  } else {
    mouth = (
      <path
        d="M 42 63 L 58 63"
        stroke="#1a1528"
        strokeWidth="2"
        strokeLinecap="round"
      />
    );
  }

  let leftEye: ReactNode;
  let rightEye: ReactNode;
  if (thinking) {
    leftEye = (
      <path
        d="M 38 46 L 46 46"
        stroke="#1a1528"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    );
    rightEye = (
      <path
        d="M 54 46 L 62 46"
        stroke="#1a1528"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    );
  } else if (happy) {
    leftEye = (
      <path
        d="M 38 46 Q 42 43 46 46"
        fill="none"
        stroke="#1a1528"
        strokeWidth="2"
        strokeLinecap="round"
      />
    );
    rightEye = (
      <path
        d="M 54 46 Q 58 43 62 46"
        fill="none"
        stroke="#1a1528"
        strokeWidth="2"
        strokeLinecap="round"
      />
    );
  } else {
    leftEye = <circle cx="42" cy="47" r="3.2" fill="#1a1528" />;
    rightEye = <circle cx="58" cy="47" r="3.2" fill="#1a1528" />;
  }

  return (
    <svg
      viewBox="0 0 100 118"
      width="100%"
      height="100%"
      aria-hidden
      style={{ display: 'block' }}>
      <defs>
        <linearGradient id="mellyHair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5b3a8c" />
          <stop offset="50%" stopColor="#7c4fce" />
          <stop offset="100%" stopColor="#4a2f7a" />
        </linearGradient>
        <linearGradient id="mellySkin" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f3d4c4" />
          <stop offset="100%" stopColor="#deb9a4" />
        </linearGradient>
        <linearGradient id="mellyBlazer" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#312a4a" />
          <stop offset="100%" stopColor="#1a1628" />
        </linearGradient>
      </defs>

      {/* Shoulders / blazer */}
      <path
        d="M 8 115 L 18 88 Q 22 82 30 80 L 38 78 Q 50 76 62 78 L 70 80 Q 78 82 82 88 L 92 115 Z"
        fill="url(#mellyBlazer)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.5"
      />
      <path
        d="M 38 78 L 46 68 L 54 68 L 62 78"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.8"
      />

      {/* Hair (longer silhouette) */}
      <path
        d="M 14 52 
           C 12 32, 28 8, 50 8 
           C 72 8, 88 32, 86 52 
           C 88 72, 82 88, 76 96 
           C 68 102, 58 98, 50 92 
           C 42 98, 32 102, 24 96 
           C 18 88, 12 72, 14 52 Z"
        fill="url(#mellyHair)"
      />
      <path
        d="M 22 55 Q 28 85 34 98 Q 50 94 66 98 Q 72 85 78 55"
        fill="url(#mellyHair)"
        opacity="0.92"
      />

      {/* Face */}
      <ellipse cx="50" cy="54" rx="24" ry="28" fill="url(#mellySkin)" />
      <ellipse cx="50" cy="58" rx="22" ry="24" fill="url(#mellySkin)" opacity="0.35" />

      {/* Soft blush */}
      <ellipse cx="36" cy="58" rx="5" ry="3" fill="rgba(220,120,120,0.2)" />
      <ellipse cx="64" cy="58" rx="5" ry="3" fill="rgba(220,120,120,0.2)" />

      {/* Eyebrows */}
      <path
        d="M 34 41 Q 42 39 48 41"
        fill="none"
        stroke="rgba(26,21,40,0.55)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M 52 41 Q 58 39 66 41"
        fill="none"
        stroke="rgba(26,21,40,0.55)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      {leftEye}
      {rightEye}

      {mouth}

      {/* Headset band */}
      <path
        d="M 18 38 Q 50 14 82 38"
        fill="none"
        stroke="rgba(30,24,45,0.85)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M 18 38 Q 50 14 82 38"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Ear cups */}
      <rect x="10" y="40" width="11" height="26" rx="4" fill="rgba(30,24,45,0.92)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
      <rect x="79" y="40" width="11" height="26" rx="4" fill="rgba(30,24,45,0.92)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
    </svg>
  );
}

export function MellyAvatar({ mood, compact }: Props) {
  const frameSize = compact ? 96 : 112;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: 'center',
        gap: compact ? 10 : 6,
      }}>
      <div className={compact ? 'melly-avatar-animate-compact' : 'melly-avatar-animate'}>
        <div
          style={{
            width: frameSize,
            height: Math.round(frameSize * 1.12),
            borderRadius: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${colors.glassBorder}`,
            background: 'linear-gradient(160deg, rgba(76,29,149,0.35), rgba(15,12,24,0.92))',
            padding: 6,
            overflow: 'hidden',
          }}>
          <MellyLadySvg mood={mood} />
        </div>
      </div>
      {!compact ? (
        <span style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
          Melly — AI interviewer
        </span>
      ) : null}
      <span
        style={{
          color: colors.textMuted,
          fontSize: 11,
          maxWidth: 200,
          textAlign: compact ? 'left' : 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
        {MOOD_COPY[mood]}
      </span>
    </div>
  );
}
