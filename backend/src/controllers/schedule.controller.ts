import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { getLocalUser } from "./profile.controller";
import { TopicStatus, SessionStatus, ScheduleTrigger } from "@prisma/client";
import { calculatePriorityScore } from "../utils/priority";
import { generateSchedule, AllocationTopic } from "../utils/allocation";
import { parseCustomPrompt } from "../utils/ai_parser";
import { mapSession } from "../utils/mappers";

const sessionSchema = z.object({ completed: z.boolean() });
const scheduleSchema = z.object({ customPrompt: z.string().optional() });

export const generateStudySchedule = async (request: Request, response: Response) => {
  const parsed = scheduleSchema.safeParse(request.body);
  const customPrompt = parsed.success ? parsed.data.customPrompt : "";

  const user = await getLocalUser();
  const topics = await prisma.topic.findMany({
    where: { subject: { userId: user.id }, status: TopicStatus.ACTIVE },
    include: { 
      subject: true,
      quizAttempts: {
        select: { percentage: true }
      }
    },
  });
  
  if (!topics.length) {
    response.status(400).json({ message: "Add an active topic before generating a study plan" });
    return;
  }

  // Parse prompt (AI or Fallback)
  const topicMultipliers = await parseCustomPrompt(customPrompt ?? "", topics.map(t => ({
    id: t.id,
    name: t.name,
    subjectName: t.subject.name
  })));

  const currentDate = new Date();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + 1);

  const allocationTopics: AllocationTopic[] = topics.map(topic => {
    const priorityScore = calculatePriorityScore(
      topic.subject.examDate,
      topic.difficulty,
      topic.quizAttempts,
      currentDate
    );
    
    return {
      id: topic.id,
      subjectId: topic.subjectId,
      priorityScore,
      remainingMinutes: Math.max(30, Math.ceil(topic.estimatedHours * 60))
    };
  });

  const dailyCapacityMinutes = Math.max(1, user.dailyStudyHours) * 60;
  
  const planned = generateSchedule(
    allocationTopics, 
    dailyCapacityMinutes, 
    start, 
    30, // Plan for up to 30 days
    topicMultipliers
  );

  const schedule = await prisma.$transaction(async (transaction) => {
    const version = await transaction.scheduleVersion.create({
      data: { userId: user.id, trigger: ScheduleTrigger.MANUAL_REGENERATION },
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
  
  response.status(201).json(schedule.studySessions.map(mapSession));
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

  const updated = await prisma.studySession.update({
    where: { id: session.id },
    data: { status: parsed.data.completed ? SessionStatus.COMPLETED : SessionStatus.PLANNED },
    include: { topic: { include: { subject: true } } },
  });
  
  response.json(mapSession(updated));
};
