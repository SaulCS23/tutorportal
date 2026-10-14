export type TopicScore = { topic: string; correct: number; total: number };
export type StudyRecommendation = {
  topic: string;
  accuracy: number;
  priority: "High" | "Medium" | "Low";
  minutes: number;
  action: string;
};

/** Explainable prioritization; no external AI provider or student data storage. */
export function recommendStudyPlan(scores: TopicScore[], minutesAvailable: number): StudyRecommendation[] {
  if (!Number.isFinite(minutesAvailable) || minutesAvailable < 5 || minutesAvailable > 480) {
    throw new Error("Study time must be between 5 and 480 minutes.");
  }
  if (!scores.length || scores.length > 30) throw new Error("Provide between 1 and 30 topics.");
  const validated = scores.map((score) => {
    if (!score.topic.trim() || score.topic.length > 100 || !Number.isInteger(score.total) ||
      !Number.isInteger(score.correct) || score.total < 1 || score.total > 1000 ||
      score.correct < 0 || score.correct > score.total) {
      throw new Error("Each topic needs a name and a valid number of correct answers.");
    }
    return { ...score, accuracy: score.correct / score.total };
  });
  const sorted = validated.sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
  const count = Math.min(sorted.length, Math.floor(minutesAvailable / 5));
  const base = Math.floor(minutesAvailable / count / 5) * 5;
  let remaining = minutesAvailable - base * count;
  return sorted.slice(0, count).map((score) => {
    const minutes = base + (remaining >= 5 ? 5 : 0);
    remaining -= minutes - base;
    return {
      topic: score.topic,
      accuracy: Math.round(score.accuracy * 100),
      priority: score.accuracy < 0.6 ? "High" as const : score.accuracy < 0.8 ? "Medium" as const : "Low" as const,
      minutes,
      action: score.accuracy < 0.6
        ? "Review the underlying concept, then solve 5 untimed questions and explain each mistake."
        : score.accuracy < 0.8
          ? "Practice 8 targeted questions and log the reason for each error."
          : "Complete a short timed set and check for careless errors.",
    };
  });
}
