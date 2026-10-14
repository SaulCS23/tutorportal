"use client";

import Link from "next/link";
import { useState } from "react";
import { recommendStudyPlan, type StudyRecommendation, type TopicScore } from "@/lib/study-coach";

const starter: TopicScore[] = [
  { topic: "SAT Advanced Math", correct: 5, total: 10 },
  { topic: "SAT Grammar", correct: 8, total: 10 },
  { topic: "SAT Data Analysis", correct: 7, total: 10 },
];

export default function StudyCoachPage() {
  const [scores, setScores] = useState<TopicScore[]>(starter);
  const [minutes, setMinutes] = useState(45);
  const [plan, setPlan] = useState<StudyRecommendation[]>([]);
  const [error, setError] = useState("");

  function update(index: number, patch: Partial<TopicScore>) {
    setScores((old) => old.map((score, i) => i === index ? { ...score, ...patch } : score));
    setPlan([]);
  }

  function generate() {
    try {
      setPlan(recommendStudyPlan(scores, minutes));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate plan.");
      setPlan([]);
    }
  }

  return (
    <main className="min-h-screen bg-page-bg px-4 py-12 text-dark-text">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <Link href="/" className="text-sm text-primary hover:underline">← TutorPortal</Link>
          <h1 className="mt-5 text-3xl font-bold">Adaptive Study Coach</h1>
          <p className="mt-2 text-muted-text">Enter recent practice scores to create a focused study plan. Your scores stay in this browser session.</p>
        </header>
        <section className="rounded-2xl border border-soft-border bg-card-bg p-6 space-y-5">
          <h2 className="text-lg font-semibold">Practice results</h2>
          {scores.map((score, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_90px_90px_40px] sm:items-end">
              <label className="text-sm">Topic
                <input aria-label={`Topic ${index + 1}`} className="mt-1 w-full rounded-lg border border-soft-border bg-white p-2 text-dark-text"
                  value={score.topic} onChange={(e) => update(index, { topic: e.target.value })} />
              </label>
              <label className="text-sm">Correct
                <input aria-label={`Correct ${index + 1}`} type="number" min="0" className="mt-1 w-full rounded-lg border border-soft-border bg-white p-2 text-dark-text"
                  value={score.correct} onChange={(e) => update(index, { correct: Number(e.target.value) })} />
              </label>
              <label className="text-sm">Total
                <input aria-label={`Total ${index + 1}`} type="number" min="1" className="mt-1 w-full rounded-lg border border-soft-border bg-white p-2 text-dark-text"
                  value={score.total} onChange={(e) => update(index, { total: Number(e.target.value) })} />
              </label>
              <button type="button" aria-label={`Remove topic ${index + 1}`} className="rounded-lg border border-soft-border p-2 hover:bg-slate-100"
                onClick={() => { setScores((old) => old.filter((_, i) => i !== index)); setPlan([]); }}>×</button>
            </div>
          ))}
          <button type="button" className="text-sm font-semibold text-primary hover:underline"
            onClick={() => { setScores((old) => [...old, { topic: "", correct: 0, total: 10 }]); setPlan([]); }}>
            + Add topic
          </button>
          <label className="block text-sm">Study time (minutes)
            <input type="number" min="5" max="480" step="5" className="mt-1 block w-36 rounded-lg border border-soft-border bg-white p-2 text-dark-text"
              value={minutes} onChange={(e) => { setMinutes(Number(e.target.value)); setPlan([]); }} />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="button" onClick={generate} className="rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:opacity-90">
            Generate study plan
          </button>
        </section>
        {plan.length > 0 && (
          <section className="space-y-4" aria-live="polite">
            <h2 className="text-xl font-bold">Your recommended plan</h2>
            {plan.map((item) => (
              <article key={item.topic} className="rounded-xl border border-soft-border bg-card-bg p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{item.topic}</h3>
                  <span className="text-sm text-muted-text">{item.minutes} min · {item.priority} priority</span>
                </div>
                <p className="mt-1 text-sm">Practice accuracy: {item.accuracy}%</p>
                <p className="mt-2 text-sm text-muted-text">{item.action}</p>
              </article>
            ))}
            <p className="text-xs text-muted-text">Recommendations use transparent accuracy-based rules, not a trained AI model.</p>
          </section>
        )}
      </div>
    </main>
  );
}
