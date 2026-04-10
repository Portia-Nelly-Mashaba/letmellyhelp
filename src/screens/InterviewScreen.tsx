import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeatmapSkills } from '../components/HeatmapSkills';
import { GlassCard } from '../components/GlassCard';
import { InterviewDock } from '../components/InterviewDock';
import { MellyAvatar } from '../components/MellyAvatar';
import { QuestionTimeline } from '../components/QuestionTimeline';
import { WorkScorePanel } from '../components/WorkScorePanel';
import { useViewportWidth } from '../hooks/useViewportWidth';
import {
  generateFinalInsights,
  generateQuestionsWithFallback,
  scoreAnswerGemini,
} from '../services/gemini';
import { speakBrowser, stopBrowserSpeech } from '../utils/speechWeb';
import { isWebDictationAvailable, startWebSpeech } from '../utils/webSpeech';
import { colors } from '../theme';
import type {
  AnswerFeedback,
  Difficulty,
  FinalInsightPayload,
  InterviewSession,
  InterviewType,
  MellyMood,
  PersonalityId,
  SkillHeatmap,
  WorkScores,
} from '../types';

const TOTAL = 5;
const TIMER_START = 120;

function moodFromScore(score: number): MellyMood {
  return score >= 7 ? 'happy' : 'encouraging';
}

function avgToWorkScores(avg: number): WorkScores {
  const p = Math.round((avg / 10) * 100);
  return {
    presentation: Math.min(100, p + 6),
    opportunistic: Math.min(100, p - 8),
    businessAccount: Math.min(100, p + 4),
    closing: Math.min(100, p - 14),
  };
}

function avgToHeatmap(avg: number, t: InterviewType): SkillHeatmap {
  const base = Math.round((avg / 10) * 100);
  return {
    communication: Math.max(5, base - 3),
    problemSolving: Math.max(5, base - 6),
    technicalKnowledge: Math.max(5, base - (t === 'technical' ? 2 : 14)),
    confidence: Math.max(5, base - 9),
    storytelling: Math.max(5, base - 5),
  };
}

type Phase = 'answering' | 'feedback';

type Props = {
  userName: string;
  userRole: string;
  interviewType: InterviewType;
  difficulty: Difficulty;
  personality: PersonalityId;
  onFinish: (payload: { session: InterviewSession; insights: FinalInsightPayload }) => void;
  onExitToLanding: () => void;
};

export function InterviewScreen({
  userName,
  userRole,
  interviewType,
  difficulty,
  personality,
  onFinish,
  onExitToLanding,
}: Props) {
  const width = useViewportWidth();
  const compact = width < 900;

  const [questions, setQuestions] = useState<string[]>([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  const [answer, setAnswer] = useState('');
  const [seconds, setSeconds] = useState(TIMER_START);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [scoreTrail, setScoreTrail] = useState<number[]>([]);
  const [mellyMood, setMellyMood] = useState<MellyMood>('idle');
  const [submitting, setSubmitting] = useState(false);

  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [answersAcc, setAnswersAcc] = useState<string[]>([]);
  const [feedbackAcc, setFeedbackAcc] = useState<AnswerFeedback[]>([]);

  const speechRef = useRef<ReturnType<typeof startWebSpeech> | null>(null);
  const answerRef = useRef(answer);
  answerRef.current = answer;
  const ranOutRef = useRef(false);

  const currentQuestion = questions[index] ?? '';

  const completedMask = useMemo(
    () => questions.map((_, i) => i < index || (i === index && phase === 'feedback')),
    [questions, index, phase],
  );

  const avgScore = useMemo(() => {
    if (!scoreTrail.length) return 5;
    return scoreTrail.reduce((a, b) => a + b, 0) / scoreTrail.length;
  }, [scoreTrail]);

  const liveWork = avgToWorkScores(avgScore);
  const liveHeat = avgToHeatmap(avgScore, interviewType);

  const buildSession = (
    finalAnswers: string[],
    finalFeedback: AnswerFeedback[],
    finalQuestions: string[],
  ): InterviewSession => ({
    userName,
    userRole,
    interviewType,
    difficulty,
    personality,
    questions: finalQuestions,
    answers: finalAnswers,
    perAnswerFeedback: finalFeedback,
  });

  const finishWith = async (qs: string[], ans: string[], fb: AnswerFeedback[]) => {
    const session = buildSession(ans, fb, qs);
    const insights = await generateFinalInsights({
      userName,
      role: userRole,
      type: interviewType,
      difficulty,
      personality,
      qa: qs.map((q, i) => ({
        question: q,
        answer: ans[i] ?? '',
        score: fb[i]?.score ?? 1,
        feedback: fb[i]!,
      })),
    });
    onFinish({ session, insights });
  };

  const submitAnswer = useCallback(
    async (autoTime = false) => {
      if (submitting || loadingQ || !currentQuestion) return;
      let body = answerRef.current.trim();
      if (body.length < 10) {
        if (autoTime) {
          body =
            body.length > 0
              ? `Time ran out — here's what I had: ${body}`
              : 'I ran out of time before I could fully answer.';
        } else {
          return;
        }
      }
      setSubmitting(true);
      setMellyMood('thinking');
      stopBrowserSpeech();
      speechRef.current?.stop();
      setListening(false);

      const fb = await scoreAnswerGemini({
        question: currentQuestion,
        answer: body,
        role: userRole,
        type: interviewType,
        difficulty,
        personality,
      });

      setFeedback(fb);
      setScoreTrail((t) => [...t, fb.score]);
      setPhase('feedback');
      setMellyMood(moodFromScore(fb.score));
      setSubmitting(false);
    },
    [
      submitting,
      loadingQ,
      currentQuestion,
      userRole,
      interviewType,
      difficulty,
      personality,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = await generateQuestionsWithFallback({
          role: userRole,
          type: interviewType,
          difficulty,
          personality,
          count: TOTAL,
        });
        if (!cancelled) setQuestions(qs);
      } finally {
        if (!cancelled) setLoadingQ(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [difficulty, interviewType, personality, userRole]);

  useEffect(() => {
    return () => {
      stopBrowserSpeech();
      speechRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (loadingQ || !currentQuestion) return;
    if (phase !== 'answering') return;
    setSeconds(TIMER_START);
  }, [loadingQ, currentQuestion, phase, index]);

  useEffect(() => {
    if (phase !== 'answering' || loadingQ || !currentQuestion) return;
    const id = window.setInterval(() => setSeconds((s) => (s <= 0 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [phase, loadingQ, index, currentQuestion]);

  useEffect(() => {
    ranOutRef.current = false;
  }, [index, phase]);

  useEffect(() => {
    if (phase !== 'answering' || loadingQ || !currentQuestion) return;
    if (seconds !== 0) return;
    if (ranOutRef.current) return;
    if (submitting) return;
    ranOutRef.current = true;
    void submitAnswer(true);
  }, [seconds, phase, loadingQ, currentQuestion, submitting, submitAnswer]);

  useEffect(() => {
    if (loadingQ || !currentQuestion || phase !== 'answering') return;
    setMellyMood('speaking');
    if (!voiceOn) return;
    stopBrowserSpeech();
    speakBrowser(`${userName}, here is your next question. ${currentQuestion}`, () =>
      setMellyMood('listening'),
    );
    return () => stopBrowserSpeech();
  }, [currentQuestion, loadingQ, phase, userName, voiceOn, index]);

  useEffect(() => {
    if (!listening) {
      speechRef.current?.stop();
      speechRef.current = null;
      return;
    }
    const h = startWebSpeech((text) => setAnswer(text));
    speechRef.current = h;
    h?.start();
    setMellyMood('listening');
    return () => {
      h?.stop();
      speechRef.current = null;
    };
  }, [listening]);

  const handleNext = async () => {
    if (!feedback) return;
    const ans = answer.trim();
    const newAnswers = [...answersAcc, ans];
    const newFb = [...feedbackAcc, feedback];
    if (index >= TOTAL - 1) {
      await finishWith(questions, newAnswers, newFb);
      return;
    }
    setAnswersAcc(newAnswers);
    setFeedbackAcc(newFb);
    setAnswer('');
    setFeedback(null);
    ranOutRef.current = false;
    setSeconds(TIMER_START);
    setPhase('answering');
    setIndex((i) => i + 1);
    setMellyMood('idle');
  };

  const confirmEnd = () => {
    if (
      !window.confirm('End session? Melly will generate coaching from what you finished so far.')
    ) {
      return;
    }
    void (async () => {
      let ans = [...answersAcc];
      let fb = [...feedbackAcc];
      if (phase === 'feedback' && feedback) {
        ans = [...ans, answer.trim()];
        fb = [...fb, feedback];
      } else if (phase === 'answering' && answer.trim().length > 0) {
        setMellyMood('thinking');
        const partialFb = await scoreAnswerGemini({
          question: currentQuestion,
          answer: answer.trim(),
          role: userRole,
          type: interviewType,
          difficulty,
          personality,
        });
        ans = [...ans, answer.trim()];
        fb = [...fb, partialFb];
      }
      const count = Math.max(1, fb.length);
      const qs = questions.slice(0, count);
      await finishWith(qs, ans.slice(0, qs.length), fb.slice(0, qs.length));
    })();
  };

  const timerColor =
    seconds <= 10 ? colors.danger : seconds <= 30 ? colors.warn : colors.text;

  if (loadingQ) {
    return (
      <div
        style={{
          minHeight: '100%',
          background: 'linear-gradient(165deg, #07060d, #14102a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
        }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: `3px solid ${colors.accent}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: colors.textMuted, margin: 0 }}>Melly is drafting your question path…</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100%',
        background: 'linear-gradient(165deg, #07060d, #120b22, #0b1224)',
      }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: `max(8px, env(safe-area-inset-top)) ${compact ? 12 : 16}px 28px`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflowY: 'auto',
        }}>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Leave interview? Progress on this run will be lost.')) onExitToLanding();
          }}
          style={{
            alignSelf: 'flex-start',
            marginBottom: 4,
            background: 'none',
            border: 'none',
            color: colors.textMuted,
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
          }}>
          ← Exit to home
        </button>

        <div
          style={{
            display: 'flex',
            flexDirection: compact ? 'column' : 'row',
            gap: 12,
            alignItems: 'stretch',
          }}>
          <div style={{ flex: compact ? undefined : 0.38, width: compact ? '100%' : undefined }}>
            <GlassCard style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                <MellyAvatar mood={mellyMood} compact />
                <button
                  type="button"
                  onClick={() => setListening((v) => !v)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 999,
                    backgroundColor: colors.accentSoft,
                    border: `1px solid ${colors.glassBorder}`,
                    color: colors.text,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                  {listening ? 'Mic on' : 'Mic off'}
                </button>
              </div>
            </GlassCard>
          </div>
          <div style={{ flex: compact ? undefined : 0.62, width: compact ? '100%' : undefined }}>
            <QuestionTimeline
              questions={questions}
              currentIndex={index}
              completedMask={completedMask}
            />
          </div>
        </div>

        <GlassCard>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
              Question {index + 1} of {TOTAL}
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}>
              <div
                style={{
                  height: '100%',
                  width: `${((index + 1) / TOTAL) * 100}%`,
                  backgroundColor: colors.accent,
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: timerColor }}>
              {seconds}s
            </span>
            <span style={{ color: colors.textMuted, fontSize: 12 }}>auto-submit at 0</span>
          </div>

          <div style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Current focus</div>
          <p style={{ color: colors.text, fontSize: 16, lineHeight: '22px', marginTop: 0, marginBottom: 12 }}>
            {currentQuestion}
          </p>

          <div style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>Your answer</div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here — or use the mic (Chrome/Edge)."
            disabled={phase !== 'answering' || submitting}
            rows={5}
            style={{
              width: '100%',
              minHeight: 120,
              borderRadius: 16,
              padding: 12,
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: `1px solid ${colors.glassBorder}`,
              color: colors.text,
              fontSize: 15,
              fontFamily: 'inherit',
              resize: 'vertical',
              marginBottom: 12,
              outline: 'none',
            }}
          />

          {phase === 'answering' ? (
            <button
              type="button"
              disabled={submitting || answer.trim().length < 10}
              onClick={() => void submitAnswer(false)}
              style={{
                width: '100%',
                backgroundColor: colors.accent,
                padding: '12px 16px',
                borderRadius: 14,
                border: 'none',
                color: '#fff',
                fontWeight: 800,
                cursor: submitting || answer.trim().length < 10 ? 'not-allowed' : 'pointer',
                opacity: submitting || answer.trim().length < 10 ? 0.45 : 1,
              }}>
              {submitting ? 'Melly is thinking…' : 'Submit answer'}
            </button>
          ) : feedback ? (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ color: colors.text, fontSize: 16, fontWeight: 700, margin: 0 }}>
                Score <span style={{ color: colors.warn }}>{feedback.score}</span>/10
              </p>
              <p style={{ color: colors.textMuted, fontSize: 13, lineHeight: '18px', margin: 0 }}>
                <strong style={{ color: colors.text }}>Strong: </strong>
                {feedback.whatWasGood}
              </p>
              <p style={{ color: colors.textMuted, fontSize: 13, lineHeight: '18px', margin: 0 }}>
                <strong style={{ color: colors.text }}>Level up: </strong>
                {feedback.whatToImprove}
              </p>
              <p style={{ color: colors.textMuted, fontSize: 13, lineHeight: '18px', margin: 0 }}>
                <strong style={{ color: colors.text }}>Melly rewrite: </strong>
                {feedback.suggestedAnswer}
              </p>
              {feedback.redFlags && feedback.redFlags.length ? (
                <div
                  style={{
                    marginTop: 6,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(248,113,113,0.35)',
                  }}>
                  <div style={{ color: colors.danger, fontWeight: 800, marginBottom: 4 }}>Red-flag phrases</div>
                  {feedback.redFlags.map((r) => (
                    <p key={r} style={{ color: colors.text, fontSize: 12, margin: '2px 0' }}>
                      • {r}
                    </p>
                  ))}
                </div>
              ) : null}
              {feedback.recruiterNote ? (
                <p style={{ color: colors.blue, fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                  Recruiter read: {feedback.recruiterNote}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleNext()}
                style={{
                  marginTop: 10,
                  padding: '12px 16px',
                  borderRadius: 14,
                  border: `1px solid ${colors.glassBorder}`,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: colors.text,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}>
                {index >= TOTAL - 1 ? 'See my results' : 'Next question'}
              </button>
            </div>
          ) : null}
        </GlassCard>

        <div
          style={{
            display: 'flex',
            flexDirection: compact ? 'column' : 'row',
            gap: 12,
            alignItems: 'flex-start',
          }}>
          <WorkScorePanel scores={liveWork} />
          <GlassCard style={{ flex: 1 }}>
            <div style={{ color: colors.text, fontWeight: 800, fontSize: 15 }}>Skill preview</div>
            <div style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
              Heatmap updates as you finish each answer.
            </div>
            <HeatmapSkills heatmap={liveHeat} noWrap />
          </GlassCard>
        </div>

        <InterviewDock
          voiceOn={voiceOn}
          listening={listening}
          onToggleVoice={() => {
            setVoiceOn((v) => !v);
            stopBrowserSpeech();
          }}
          onToggleMic={() => {
            if (!isWebDictationAvailable()) {
              window.alert('Live dictation needs Chrome or Edge.');
              return;
            }
            setListening((v) => !v);
          }}
          onEnd={confirmEnd}
          micHint={
            isWebDictationAvailable()
              ? 'Speech streams into the answer box while Mic on.'
              : 'Use Chrome or Edge for live dictation.'
          }
        />
      </div>
    </div>
  );
}
