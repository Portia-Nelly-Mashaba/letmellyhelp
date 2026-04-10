import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  heuristicScore,
  pickFallbackQuestions,
  templateFeedback,
} from '../data/fallbackQuestions';
import { personaSystemPreamble } from '../personas';
import type {
  AnswerFeedback,
  Difficulty,
  FinalInsightPayload,
  InterviewType,
  PersonalityId,
} from '../types';
import { parseModelJson } from '../utils/parseJson';

const MODEL_CANDIDATES = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];

function getKey(): string | undefined {
  const k = (
    import.meta.env.VITE_GEMINI_API_KEY ??
    import.meta.env.REACT_APP_GOOGLE_API_KEY ??
    ''
  ).trim();
  return k || undefined;
}

function getClient(): GoogleGenerativeAI | null {
  const key = getKey();
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

async function generateText(system: string, user: string): Promise<string> {
  const client = getClient();
  if (!client) throw new Error('NO_API_KEY');

  let lastErr: unknown;
  for (const name of MODEL_CANDIDATES) {
    try {
      const model = client.getGenerativeModel({
        model: name,
        systemInstruction: system,
      });
      const res = await model.generateContent(user);
      return res.response.text();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('GEMINI_FAILED');
}

export async function generateQuestionsGemini(args: {
  role: string;
  type: InterviewType;
  difficulty: Difficulty;
  personality: PersonalityId;
  count: number;
}): Promise<string[]> {
  const system = `${personaSystemPreamble(args.personality)}
Return ONLY valid JSON with shape {"questions": string[]} — exactly ${args.count} distinct interview questions for the specified role. No markdown, no commentary.`;

  const user = JSON.stringify({
    role: args.role,
    interviewType: args.type,
    difficulty: args.difficulty,
  });

  const text = await generateText(system, user);
  const parsed = parseModelJson<{ questions: string[] }>(text);
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('BAD_QUESTIONS_SHAPE');
  }
  return parsed.questions.slice(0, args.count);
}

export async function generateQuestionsWithFallback(args: {
  role: string;
  type: InterviewType;
  difficulty: Difficulty;
  personality: PersonalityId;
  count: number;
}): Promise<string[]> {
  try {
    return await generateQuestionsGemini(args);
  } catch {
    return pickFallbackQuestions(args.type, args.difficulty, args.count);
  }
}

export async function scoreAnswerGemini(args: {
  question: string;
  answer: string;
  role: string;
  type: InterviewType;
  difficulty: Difficulty;
  personality: PersonalityId;
}): Promise<AnswerFeedback> {
  const system = `${personaSystemPreamble(args.personality)}
You score interview answers 1–10. Return ONLY JSON:
{"score":number,"whatWasGood":string,"whatToImprove":string,"suggestedAnswer":string,"redFlags":string[],"recruiterNote":string}
redFlags: phrases that sound risky to employers (vague, negative, unprofessional). recruiterNote: one line how a recruiter might read this.`;

  const user = JSON.stringify({
    role: args.role,
    interviewType: args.type,
    difficulty: args.difficulty,
    question: args.question,
    answer: args.answer,
  });

  try {
    const text = await generateText(system, user);
    const parsed = parseModelJson<AnswerFeedback>(text);
    const score = Math.min(10, Math.max(1, Number(parsed.score) || 5));
    let note = typeof parsed.recruiterNote === 'string' ? parsed.recruiterNote.trim() : '';
    if (/offline heuristic|EXPO_PUBLIC_GEMINI|add .*GEMINI.*api/i.test(note)) note = '';
    return {
      score,
      whatWasGood: parsed.whatWasGood || '—',
      whatToImprove: parsed.whatToImprove || '—',
      suggestedAnswer: parsed.suggestedAnswer || '—',
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      recruiterNote: note || undefined,
    };
  } catch {
    const score = heuristicScore(args.answer);
    const t = templateFeedback(score);
    return {
      score,
      whatWasGood: t.whatWasGood,
      whatToImprove: t.whatToImprove,
      suggestedAnswer: t.suggestedAnswer,
      redFlags: [],
    };
  }
}

function clamp100(n: number): number {
  if (Number.isNaN(n)) return 50;
  return Math.min(100, Math.max(5, Math.round(n)));
}

export async function generateFinalInsights(args: {
  userName: string;
  role: string;
  type: InterviewType;
  difficulty: Difficulty;
  personality: PersonalityId;
  qa: { question: string; answer: string; score: number; feedback: AnswerFeedback }[];
}): Promise<FinalInsightPayload> {
  const system = `${personaSystemPreamble(args.personality)}
You are Melly, an AI interview coach inside LetMellyHelp.
Given the full mock interview, return ONLY JSON with this exact shape:
{
 "summary": string,
 "strengths": string[],
 "improvements": string[],
 "nextSteps": string[],
 "mellyVoiceLine": string,
 "radar": {
   "professionalism": number, "attitude": number, "creativity": number,
   "communication": number, "leadership": number, "teamwork": number, "sociability": number
 },
 "workScores": {
   "presentation": number, "opportunistic": number, "businessAccount": number, "closing": number
 },
 "heatmap": {
   "communication": number, "problemSolving": number, "technicalKnowledge": number,
   "confidence": number, "storytelling": number
 },
 "careerNow": string[],
 "career6mo": string[],
 "career2yr": string[],
 "weeklyPlan": string[],
 "portfolioIdeas": string[],
 "emotionTone": string
}
All numeric scores are 0-100 integers. career* arrays: 3 realistic job titles each. weeklyPlan: 5 short bullet strings for a week. portfolioIdeas: 3 project ideas tied to weaknesses. emotionTone: one line describing answer tone (confidence, hedging, warmth).`;

  const user = JSON.stringify({
    candidateName: args.userName,
    role: args.role,
    interviewType: args.type,
    difficulty: args.difficulty,
    transcript: args.qa,
  });

  const fallback = (): FinalInsightPayload => {
    const avg =
      args.qa.reduce((a, x) => a + x.score, 0) / Math.max(1, args.qa.length);
    const pct = Math.round((avg / 10) * 100);
    return {
      summary: `${args.userName}, you averaged ${avg.toFixed(1)}/10 (${pct}%). Solid baseline — tighten stories and quantify outcomes.`,
      strengths: [
        'You completed every prompt without skipping.',
        'Your answers show willingness to reflect.',
        'You stayed coherent across the full session.',
      ],
      improvements: [
        'Add one metric per story (time saved, revenue, defect rate).',
        'Name your role vs the team’s role explicitly.',
        'Close each answer with what you learned or would do next time.',
      ],
      nextSteps: [
        'Run one more behavioural round focusing on conflict and prioritisation.',
        'Record yourself; trim answers to under 90 seconds.',
      ],
      mellyVoiceLine: `Melly here — you’re closer than you think. Small upgrades to specificity will compound fast.`,
      radar: {
        professionalism: clamp100(pct - 5),
        attitude: clamp100(pct),
        creativity: clamp100(pct - 8),
        communication: clamp100(pct - 3),
        leadership: clamp100(pct - 10),
        teamwork: clamp100(pct - 2),
        sociability: clamp100(pct - 4),
      },
      workScores: {
        presentation: clamp100(pct + 5),
        opportunistic: clamp100(pct - 12),
        businessAccount: clamp100(pct - 6),
        closing: clamp100(pct - 15),
      },
      heatmap: {
        communication: clamp100(pct - 4),
        problemSolving: clamp100(pct - 6),
        technicalKnowledge: clamp100(pct - (args.type === 'technical' ? 3 : 15)),
        confidence: clamp100(pct - 8),
        storytelling: clamp100(pct - 5),
      },
      careerNow: [
        `Junior ${args.role}`,
        'Associate product-facing engineer',
        'Customer-success facing technologist',
      ],
      career6mo: [
        `Mid-level ${args.role}`,
        'Team lead on a focused product surface',
        'Specialist IC with growing scope',
      ],
      career2yr: [
        `Senior ${args.role}`,
        'Staff-level bridge across teams',
        'Technical owner of a revenue-critical workflow',
      ],
      weeklyPlan: [
        'Mon: STAR template cheat sheet + 3 practice bullets.',
        'Tue: Record two answers; rewrite with metrics.',
        'Wed: Behavioural deep dive — conflict story.',
        'Thu: Technical whiteboard outline for one system.',
        'Fri: Mock with Melly again and compare scores.',
      ],
      portfolioIdeas: [
        'Ship a tiny dashboard that proves measurement thinking.',
        'Open-source a CLI that shows your code quality habits.',
        'Write a case study with before/after metrics.',
      ],
      emotionTone: 'Warm but slightly hedged — push confidence with crisp summaries.',
    };
  };

  try {
    const text = await generateText(system, user);
    const p = parseModelJson<FinalInsightPayload>(text);
    const radar = p.radar ?? fallback().radar;
    const heatmap = p.heatmap ?? fallback().heatmap;
    const workScores = p.workScores ?? fallback().workScores;
    return {
      summary: p.summary || fallback().summary,
      strengths: Array.isArray(p.strengths) ? p.strengths : fallback().strengths,
      improvements: Array.isArray(p.improvements) ? p.improvements : fallback().improvements,
      nextSteps: Array.isArray(p.nextSteps) ? p.nextSteps : fallback().nextSteps,
      mellyVoiceLine: p.mellyVoiceLine || fallback().mellyVoiceLine,
      radar: {
        professionalism: clamp100(radar.professionalism),
        attitude: clamp100(radar.attitude),
        creativity: clamp100(radar.creativity),
        communication: clamp100(radar.communication),
        leadership: clamp100(radar.leadership),
        teamwork: clamp100(radar.teamwork),
        sociability: clamp100(radar.sociability),
      },
      workScores: {
        presentation: clamp100(workScores.presentation),
        opportunistic: clamp100(workScores.opportunistic),
        businessAccount: clamp100(workScores.businessAccount),
        closing: clamp100(workScores.closing),
      },
      heatmap: {
        communication: clamp100(heatmap.communication),
        problemSolving: clamp100(heatmap.problemSolving),
        technicalKnowledge: clamp100(heatmap.technicalKnowledge),
        confidence: clamp100(heatmap.confidence),
        storytelling: clamp100(heatmap.storytelling),
      },
      careerNow: Array.isArray(p.careerNow) ? p.careerNow : fallback().careerNow,
      career6mo: Array.isArray(p.career6mo) ? p.career6mo : fallback().career6mo,
      career2yr: Array.isArray(p.career2yr) ? p.career2yr : fallback().career2yr,
      weeklyPlan: Array.isArray(p.weeklyPlan) ? p.weeklyPlan : fallback().weeklyPlan,
      portfolioIdeas: Array.isArray(p.portfolioIdeas)
        ? p.portfolioIdeas
        : fallback().portfolioIdeas,
      emotionTone: p.emotionTone || fallback().emotionTone,
    };
  } catch {
    return fallback();
  }
}
