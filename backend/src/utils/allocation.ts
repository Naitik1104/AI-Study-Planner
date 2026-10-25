import { SessionType } from "@prisma/client";

export interface AllocationTopic {
  id: string;
  subjectId: string;
  name?: string;
  subjectName?: string;
  priorityScore: number;
  remainingMinutes: number;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  weaknessScore?: number;
  examDate?: Date;
}

export interface PlannedSession {
  topicId: string;
  date: Date;
  startTime: string;
  durationMinutes: number;
  sessionType: SessionType;
}

/**
 * Intelligent AI Scheduling Engine.
 * Features:
 * - Chunking (Pomodoro Principle): 30 to 60 minutes per session block to maximize retention.
 * - Cognitive Interleaving: Alternates subjects when priority is comparable to reduce mental fatigue.
 * - Multiplier Support: Dynamic weighting from Gemini / Algorithmic NLP user prompts.
 * - Spaced Revision & Active Recall: Automatically schedules revision and quiz practice blocks
 *   for difficult or weak topics leading up to exams.
 */
export function generateSchedule(
  topics: AllocationTopic[],
  dailyCapacityMinutes: number,
  startDate: Date,
  daysToPlan: number = 30,
  topicMultipliers?: Record<string, number>
): PlannedSession[] {
  const planned: PlannedSession[] = [];
  const MIN_SESSION_MINUTES = 30;
  const MAX_SESSION_MINUTES = 60;
  const BREAK_MINUTES = 15;

  if (!topics || topics.length === 0 || dailyCapacityMinutes < MIN_SESSION_MINUTES) {
    return planned;
  }

  // Clone and apply AI prompt multipliers
  let activeTopics = topics.map((t) => ({
    ...t,
    originalMinutes: t.remainingMinutes,
    priorityScore: t.priorityScore * (topicMultipliers?.[t.id] ?? 1.0),
    studiedDays: new Set<number>(),
  })).filter((t) => t.remainingMinutes > 0);

  // Topics that qualify for spaced revision (Hard difficulty or weakness > 0.4)
  const revisionQueue: {
    topicId: string;
    subjectId: string;
    priorityScore: number;
    eligibleFromDay: number;
    revisionMinutes: number;
    type: SessionType;
  }[] = [];

  for (let dayOffset = 0; dayOffset < daysToPlan; dayOffset++) {
    if (activeTopics.length === 0 && revisionQueue.length === 0) break;

    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + dayOffset);

    let remainingDailyCapacity = dailyCapacityMinutes;
    let currentHour = 9;
    let currentMinute = 0;
    let lastSubjectScheduled = "";

    while (remainingDailyCapacity >= MIN_SESSION_MINUTES) {
      let chosenSession: {
        topicId: string;
        subjectId: string;
        duration: number;
        sessionType: SessionType;
      } | null = null;

      // 1. Check if an active study topic is available
      if (activeTopics.length > 0) {
        // Sort active topics by current priority descending
        activeTopics.sort((a, b) => b.priorityScore - a.priorityScore);

        let selectedIndex = 0;
        const topCandidate = activeTopics[0]!;

        // Cognitive Interleaving: if top topic matches previous subject, try to find another subject within 70% priority
        if (lastSubjectScheduled === topCandidate.subjectId && activeTopics.length > 1) {
          for (let i = 1; i < activeTopics.length; i++) {
            const candidate = activeTopics[i]!;
            if (candidate.subjectId !== lastSubjectScheduled) {
              if (candidate.priorityScore >= topCandidate.priorityScore * 0.7) {
                selectedIndex = i;
                break;
              }
            }
          }
        }

        const selected = activeTopics[selectedIndex]!;
        let duration = Math.min(MAX_SESSION_MINUTES, remainingDailyCapacity, selected.remainingMinutes);

        // Avoid leaving an awkward sliver under 30 mins
        if (
          selected.remainingMinutes > MAX_SESSION_MINUTES &&
          selected.remainingMinutes < MAX_SESSION_MINUTES + MIN_SESSION_MINUTES
        ) {
          duration = Math.floor(selected.remainingMinutes / 2);
        }

        if (duration >= MIN_SESSION_MINUTES) {
          chosenSession = {
            topicId: selected.id,
            subjectId: selected.subjectId,
            duration,
            sessionType: SessionType.STUDY,
          };

          selected.remainingMinutes -= duration;
          selected.studiedDays.add(dayOffset);

          // If topic has finished its primary study time and is HARD or has weakness, queue spaced revision
          if (selected.remainingMinutes <= 0) {
            const isChallenging = selected.difficulty === "HARD" || (selected.weaknessScore ?? 0) >= 0.4;
            if (isChallenging) {
              revisionQueue.push({
                topicId: selected.id,
                subjectId: selected.subjectId,
                priorityScore: selected.priorityScore * 0.85,
                eligibleFromDay: dayOffset + 2, // 2 days after finishing
                revisionMinutes: 30,
                type: SessionType.REVISION,
              });
              revisionQueue.push({
                topicId: selected.id,
                subjectId: selected.subjectId,
                priorityScore: selected.priorityScore * 0.75,
                eligibleFromDay: dayOffset + 4, // 4 days later active recall quiz
                revisionMinutes: 30,
                type: SessionType.QUIZ,
              });
            }
          }

          // Clean up finished topics
          activeTopics = activeTopics.filter((t) => t.remainingMinutes > 0);
        }
      }

      // 2. If no study topic fit or activeTopics is empty, check spaced revision queue
      if (!chosenSession && revisionQueue.length > 0) {
        const eligibleIndex = revisionQueue.findIndex(
          (rev) => rev.eligibleFromDay <= dayOffset && rev.revisionMinutes <= remainingDailyCapacity
        );

        if (eligibleIndex !== -1) {
          const rev = revisionQueue[eligibleIndex]!;
          chosenSession = {
            topicId: rev.topicId,
            subjectId: rev.subjectId,
            duration: rev.revisionMinutes,
            sessionType: rev.type,
          };
          revisionQueue.splice(eligibleIndex, 1);
        }
      }

      // If nothing could be scheduled, advance to next day
      if (!chosenSession) {
        break;
      }

      // Record planned session
      const startTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
      planned.push({
        topicId: chosenSession.topicId,
        date,
        startTime: startTimeStr,
        durationMinutes: chosenSession.duration,
        sessionType: chosenSession.sessionType,
      });

      remainingDailyCapacity -= chosenSession.duration;
      lastSubjectScheduled = chosenSession.subjectId;

      // Advance clock + Break
      currentMinute += chosenSession.duration + BREAK_MINUTES;
      while (currentMinute >= 60) {
        currentHour += 1;
        currentMinute -= 60;
      }
    }
  }

  return planned;
}
