import { useEffect, useMemo, useState } from 'react';
import { HeatmapSkills } from '../components/HeatmapSkills';
import { GlassCard } from '../components/GlassCard';
import { MellyAvatar } from '../components/MellyAvatar';
import { WorkScorePanel } from '../components/WorkScorePanel';
import { speakBrowser, stopBrowserSpeech } from '../utils/speechWeb';
import { colors } from '../theme';
import type { FinalInsightPayload, InterviewSession, MellyMood } from '../types';

type Props = {
  session: InterviewSession;
  insights: FinalInsightPayload;
  voiceOn?: boolean;
  onTryAgain: () => void;
  onNewInterview: () => void;
};

function ringColor(pct: number) {
  if (pct >= 80) return colors.success;
  if (pct >= 60) return colors.warn;
  return colors.danger;
}

export function ResultsScreen({
  session,
  insights,
  voiceOn = true,
  onTryAgain,
  onNewInterview,
}: Props) {
  const [open, setOpen] = useState<number | null>(0);

  const avg = useMemo(() => {
    const xs = session.perAnswerFeedback.map((f) => f.score);
    return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  }, [session.perAnswerFeedback]);

  const pct = Math.round((avg / 10) * 100);
  const mood: MellyMood = pct >= 70 ? 'happy' : 'encouraging';

  useEffect(() => {
    if (!voiceOn) return;
    speakBrowser(insights.mellyVoiceLine);
    return () => stopBrowserSpeech();
  }, [insights.mellyVoiceLine, voiceOn]);

  return (
    <div
      style={{
        minHeight: '100%',
        background: 'linear-gradient(165deg, #07060d, #160b2d, #0b1224)',
        padding: `max(12px, env(safe-area-inset-top)) 16px 40px`,
      }}>
      <div
        style={{
          maxWidth: 900,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
        <header style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ color: colors.text, fontSize: 26, fontWeight: 800, margin: 0 }}>LetMellyHelp</h1>
            <p style={{ color: colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 0 }}>
              Your career intelligence snapshot
            </p>
          </div>
          <MellyAvatar mood={mood} compact />
        </header>

        <GlassCard>
          <div style={{ color: colors.warn, fontWeight: 800, marginBottom: 6 }}>Melly&apos;s debrief</div>
          <p style={{ color: colors.text, fontSize: 15, lineHeight: '22px', margin: 0 }}>
            {insights.summary} {session.userRole ? `— lens: ${session.userRole}.` : ''}
          </p>
          {insights.emotionTone ? (
            <p style={{ color: colors.blue, fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              Text tone read: {insights.emotionTone}
            </p>
          ) : null}
        </GlassCard>

        <div style={{ display: 'flex', flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
              border: `6px solid ${ringColor(pct)}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.04)',
            }}>
            <span style={{ color: colors.text, fontSize: 26, fontWeight: 900 }}>{pct}%</span>
            <span style={{ color: colors.textMuted, fontSize: 11 }}>session</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: colors.success, fontWeight: 800, fontSize: 12 }}>What you did well</div>
            {insights.strengths.map((s) => (
              <p key={s} style={{ color: colors.text, fontSize: 13, lineHeight: '18px', margin: 0 }}>
                ✓ {s}
              </p>
            ))}
          </div>
        </div>

        <HeatmapSkills heatmap={insights.heatmap} />

        <WorkScorePanel scores={insights.workScores} />

        <GlassCard>
          <div style={{ color: colors.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
            Future career simulator
          </div>
          <p style={{ color: colors.textMuted, fontSize: 12, marginTop: 0 }}>
            Titles Melly thinks are realistic if you keep stacking proof.
          </p>
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
            <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: colors.warn, fontWeight: 800, fontSize: 12 }}>Now</div>
              {insights.careerNow.map((x) => (
                <p key={x} style={{ color: colors.text, fontSize: 12, lineHeight: '16px', margin: 0 }}>
                  • {x}
                </p>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: colors.warn, fontWeight: 800, fontSize: 12 }}>6 months</div>
              {insights.career6mo.map((x) => (
                <p key={x} style={{ color: colors.text, fontSize: 12, lineHeight: '16px', margin: 0 }}>
                  • {x}
                </p>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: colors.warn, fontWeight: 800, fontSize: 12 }}>2 years</div>
              {insights.career2yr.map((x) => (
                <p key={x} style={{ color: colors.text, fontSize: 12, lineHeight: '16px', margin: 0 }}>
                  • {x}
                </p>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ color: colors.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
            AI learning path (this week)
          </div>
          {insights.weeklyPlan.map((step) => (
            <p key={step} style={{ color: colors.text, fontSize: 13, margin: '4px 0 0', lineHeight: '18px' }}>
              {step}
            </p>
          ))}
        </GlassCard>

        <GlassCard>
          <div style={{ color: colors.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
            Portfolio micro-wins
          </div>
          {insights.portfolioIdeas.map((p) => (
            <p key={p} style={{ color: colors.text, fontSize: 13, margin: '4px 0 0', lineHeight: '18px' }}>
              • {p}
            </p>
          ))}
        </GlassCard>

        <GlassCard>
          <div style={{ color: colors.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
            Tighten these next
          </div>
          {insights.improvements.map((s) => (
            <p key={s} style={{ color: colors.orange, fontSize: 13, margin: '4px 0 0', lineHeight: '18px' }}>
              → {s}
            </p>
          ))}
          <div style={{ color: colors.success, fontWeight: 800, fontSize: 12, marginTop: 12 }}>
            Coach-approved next steps
          </div>
          {insights.nextSteps.map((s) => (
            <p key={s} style={{ color: colors.blue, fontSize: 13, margin: '4px 0 0', lineHeight: '18px' }}>
              ▸ {s}
            </p>
          ))}
        </GlassCard>

        <GlassCard>
          <div style={{ color: colors.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Interview replay</div>
          {session.questions.map((q, i) => {
            const expanded = open === i;
            const fb = session.perAnswerFeedback[i];
            return (
              <button
                key={i}
                type="button"
                onClick={() => setOpen(expanded ? null : i)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 0',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  background: 'none',
                  cursor: 'pointer',
                }}>
                <div style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>
                  Q{i + 1} · {fb?.score ?? '—'}/10
                </div>
                <p
                  style={{
                    color: colors.text,
                    fontSize: 14,
                    margin: 0,
                    display: expanded ? 'block' : '-webkit-box',
                    WebkitLineClamp: expanded ? undefined : 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: expanded ? 'visible' : 'hidden',
                  }}>
                  {q}
                </p>
                {expanded ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    <p style={{ color: colors.text, fontSize: 13, margin: 0 }}>{session.answers[i]}</p>
                    <p style={{ color: colors.textMuted, fontSize: 12, margin: 0 }}>Strong: {fb?.whatWasGood}</p>
                    <p style={{ color: colors.textMuted, fontSize: 12, margin: 0 }}>Level up: {fb?.whatToImprove}</p>
                    <p style={{ color: colors.teal, fontSize: 13, lineHeight: '18px', margin: 0 }}>
                      Gold answer: {fb?.suggestedAnswer}
                    </p>
                  </div>
                ) : null}
              </button>
            );
          })}
        </GlassCard>

        <GlassCard>
          <div style={{ color: colors.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Free cheat-sheet</div>
          <p style={{ color: colors.text, fontSize: 13, margin: '4px 0 0', lineHeight: '18px' }}>
            • STAR: Situation → Task → Action → Result.
          </p>
          <p style={{ color: colors.text, fontSize: 13, margin: '4px 0 0', lineHeight: '18px' }}>
            • Keep stories under ~90 seconds.
          </p>
          <p style={{ color: colors.text, fontSize: 13, margin: '4px 0 0', lineHeight: '18px' }}>
            • Always land on impact (metrics, users, time, money).
          </p>
        </GlassCard>

        <div style={{ display: 'flex', flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onTryAgain}
            style={{
              flex: '1 1 200px',
              backgroundColor: colors.accent,
              padding: '14px 16px',
              borderRadius: 14,
              border: 'none',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}>
            Try again (same setup)
          </button>
          <button
            type="button"
            onClick={onNewInterview}
            style={{
              flex: '1 1 200px',
              padding: '14px 16px',
              borderRadius: 14,
              border: `1px solid ${colors.glassBorder}`,
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: colors.text,
              fontWeight: 800,
              cursor: 'pointer',
            }}>
            New interview
          </button>
        </div>
      </div>
    </div>
  );
}
