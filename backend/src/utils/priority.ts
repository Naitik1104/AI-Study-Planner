import { Difficulty } from "@prisma/client";

const WEIGHTS = {
  URGENCY: 0.4,
  DIFFICULTY: 0.3,
  WEAKNESS: 0.3,
};

export function calculateExamUrgency(examDate: Date, currentDate: Date = new Date()): number {
  const diffTime = examDate.getTime() - currentDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 1.0; 
  return Math.max(0.1, 1 / (1 + Math.max(0, diffDays) * 0.1));
}

export function calculateTopicDifficulty(difficulty: Difficulty): number {
  switch (difficulty) {
    case Difficulty.EASY: return 0.33;
    case Difficulty.MEDIUM: return 0.66;
    case Difficulty.HARD: return 1.0;
    default: return 0.5;
  }
}

export function calculateStudentWeakness(attempts: { percentage: number }[]): number {
  if (!attempts || attempts.length === 0) {
    return 0.5;
  }
  
  const totalPercentage = attempts.reduce((sum, attempt) => sum + attempt.percentage, 0);
  const averagePercentage = totalPercentage / attempts.length;
  
  return Math.max(0.0, 1.0 - (averagePercentage / 100));
}

export function calculatePriorityScore(
  examDate: Date,
  difficulty: Difficulty,
  attempts: { percentage: number }[],
  currentDate: Date = new Date()
): number {
  const urgency = calculateExamUrgency(examDate, currentDate);
  const diff = calculateTopicDifficulty(difficulty);
  const weakness = calculateStudentWeakness(attempts);
  
  return (WEIGHTS.URGENCY * urgency) + 
         (WEIGHTS.DIFFICULTY * diff) + 
         (WEIGHTS.WEAKNESS * weakness);
}

