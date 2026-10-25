import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { getLocalUser } from "./profile.controller";
import { TopicStatus, SessionStatus, ScheduleTrigger } from "@prisma/client";
import { calculatePriorityScore, calculateStudentWeakness } from "../utils/priority";
import { generateSchedule, AllocationTopic } from "../utils/allocation";
import { parseCustomPrompt } from "../utils/ai_parser";
import { mapSession } from "../utils/mappers";

const sessionSchema = z.object({
  completed: z.boolean().optional(),
  status: z.enum(["PLANNED", "COMPLETED", "MISSED", "SKIPPED"]).optional(),
});
const scheduleSchema = z.object({ customPrompt: z.string().optional() });

/**
 * Core schedule generation logic reusable across manual requests and adaptive triggers.
 */
export async function executeScheduleGeneration(
  userId: string,
  trigger: ScheduleTrigger = ScheduleTrigger.MANUAL_REGENERATION,
  customPrompt: string = ""
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const topics = await prisma.topic.findMany({
    where: { subject: { userId: user.id }, status: TopicStatus.ACTIVE },
    include: {
      subject: true,
      quizAttempts: { select: { percentage: true } },
    },
    orderBy: [{ subject: { examDate: "asc" } }, { difficulty: "desc" }],
  });

  if (!topics.length) {
    return [];
  }

  // Parse prompt intent (Gemini AI API or Algorithmic Fallback)
  const topicMultipliers = await parseCustomPrompt(
    customPrompt,
    topics.map((t) => ({
      id: t.id,
      name: t.name,
      subjectName: t.subject.name,
    }))
  );

  const currentDate = new Date();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + 1);

  const allocationTopics: AllocationTopic[] = topics.map((topic) => {
    const priorityScore = calculatePriorityScore(
      topic.subject.examDate,
      topic.difficulty,
      topic.quizAttempts,
      currentDate
    );
    const weaknessScore = calculateStudentWeakness(topic.quizAttempts);

    return {
      id: topic.id,
      subjectId: topic.subjectId,
      name: topic.name,
      subjectName: topic.subject.name,
      priorityScore,
      weaknessScore,
      difficulty: topic.difficulty,
      examDate: topic.subject.examDate,
      remainingMinutes: Math.max(30, Math.ceil(topic.estimatedHours * 60)),
    };
  });

  const dailyCapacityMinutes = Math.max(1, user.dailyStudyHours) * 60;

  const planned = generateSchedule(
    allocationTopics,
    dailyCapacityMinutes,
    start,
    30, // 30-day projection window
    topicMultipliers
  );

  const schedule = await prisma.$transaction(async (transaction) => {
    const version = await transaction.scheduleVersion.create({
      data: { userId: user.id, trigger },
    });
    await transaction.studySession.createMany({
      data: planned.map((session) => ({ ...session, scheduleVersionId: version.id })),
    });
    return transaction.scheduleVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: {
        studySessions: {
          include: { topic: { include: { subject: true } } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        },
      },
    });
  });

  return schedule.studySessions;
}

export const generateStudySchedule = async (request: Request, response: Response) => {
  const parsed = scheduleSchema.safeParse(request.body);
  const customPrompt = parsed.success && parsed.data.customPrompt ? parsed.data.customPrompt : "";

  const user = await getLocalUser();
  const activeTopicsCount = await prisma.topic.count({
    where: { subject: { userId: user.id }, status: TopicStatus.ACTIVE },
  });

  if (activeTopicsCount === 0) {
    response.status(400).json({ message: "Add an active topic before generating a study plan" });
    return;
  }

  const sessions = await executeScheduleGeneration(
    user.id,
    ScheduleTrigger.MANUAL_REGENERATION,
    customPrompt
  );

  response.status(201).json(sessions.map(mapSession));
};

export const updateSessionStatus = async (request: Request, response: Response) => {
  const parsed = sessionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid session update", issues: parsed.error.issues });
    return;
  }

  const user = await getLocalUser();
  const session = await prisma.studySession.findFirst({
    where: { id: request.params.sessionId as string, scheduleVersion: { userId: user.id } },
  });
  if (!session) {
    response.status(404).json({ message: "Study session not found" });
    return;
  }

  let nextStatus: SessionStatus = SessionStatus.PLANNED;
  if (parsed.data.status) {
    nextStatus = parsed.data.status as SessionStatus;
  } else if (parsed.data.completed !== undefined) {
    nextStatus = parsed.data.completed ? SessionStatus.COMPLETED : SessionStatus.PLANNED;
  }

  const updated = await prisma.studySession.update({
    where: { id: session.id },
    data: { status: nextStatus },
    include: { topic: { include: { subject: true } } },
  });

  response.json(mapSession(updated));
};
