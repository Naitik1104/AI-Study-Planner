import { describe, expect, it } from "@jest/globals";
import { Difficulty } from "@prisma/client";
import { calculateExamUrgency, calculateTopicDifficulty, calculateStudentWeakness, calculatePriorityScore } from "./priority";

describe("Priority Utilities", () => {
  const now = new Date("2026-10-01T12:00:00Z");

  describe("calculateExamUrgency", () => {
    it("should return 1.0 for dates in the past or exactly now", () => {
      expect(calculateExamUrgency(now, now)).toBe(1.0);
      expect(calculateExamUrgency(new Date("2026-09-01T12:00:00Z"), now)).toBe(1.0);
    });

    it("should return a decay value for future dates", () => {
      const tomorrow = new Date("2026-10-02T12:00:00Z");
      expect(calculateExamUrgency(tomorrow, now)).toBeCloseTo(0.909, 3); // 1 / (1 + 0.1)

      const nextWeek = new Date("2026-10-08T12:00:00Z");
      expect(calculateExamUrgency(nextWeek, now)).toBeCloseTo(0.588, 3); // 1 / (1 + 0.7)
    });
  });

  describe("calculateTopicDifficulty", () => {
    it("should correctly map difficulty enum to numbers", () => {
      expect(calculateTopicDifficulty(Difficulty.EASY)).toBe(0.33);
      expect(calculateTopicDifficulty(Difficulty.MEDIUM)).toBe(0.66);
      expect(calculateTopicDifficulty(Difficulty.HARD)).toBe(1.0);
    });
  });

  describe("calculateStudentWeakness", () => {
    it("should return 0.5 when no attempts are provided", () => {
      expect(calculateStudentWeakness([])).toBe(0.5);
    });

    it("should calculate inverse percentage for attempts", () => {
      expect(calculateStudentWeakness([{ percentage: 100 }])).toBe(0.0); // 100% means 0 weakness
      expect(calculateStudentWeakness([{ percentage: 50 }, { percentage: 100 }])).toBe(0.25); // 75% average means 0.25 weakness
      expect(calculateStudentWeakness([{ percentage: 0 }])).toBe(1.0); // 0% means 1.0 weakness
    });
  });

  describe("calculatePriorityScore", () => {
    it("should aggregate all factors with correct weights", () => {
      const examDate = new Date("2026-10-02T12:00:00Z"); // Urgency: ~0.909
      const difficulty = Difficulty.HARD; // Difficulty: 1.0
      const attempts = [{ percentage: 0 }]; // Weakness: 1.0
      
      const score = calculatePriorityScore(examDate, difficulty, attempts, now);
      // (0.4 * 0.909) + (0.3 * 1.0) + (0.3 * 1.0) = 0.3636 + 0.3 + 0.3 = 0.9636
      expect(score).toBeCloseTo(0.963, 2);
    });
  });
});

