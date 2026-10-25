import { Request, Response } from "express";
import { PrismaClient, TopicStatus } from "@prisma/client";
import { prisma } from "../config/db";
import { mapSubject, mapSession, mapQuestion } from "../utils/mappers";
import { calculatePriorityScore, calculateStudentWeakness } from "../utils/priority";

export async function getLocalUser(database: PrismaClient = prisma) {
  const email = process.env.STUDY_PLANNER_USER_EMAIL ?? "student@local.studywell";
  const configuredHours = Number(process.env.DAILY_STUDY_HOURS ?? 2);
  const dailyStudyHours = Number.isInteger(configuredHours) && configuredHours >= 1 && configuredHours <= 12
    ? configuredHours
    : 2;
  return database.user.upsert({
    where: { email },
    update: {},
    create: {
      name: process.env.STUDY_PLANNER_USER_NAME ?? "Student",
      email,
      dailyStudyHours,
    },
  });
}

export const getPlannerData = async (_request: Request, response: Response) => {
  const user = await getLocalUser();
  const currentDate = new Date();

  const [subjects, schedule, questions] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id },
      include: {
        topics: {
          include: {
            quizAttempts: { select: { percentage: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { examDate: "asc" },
    }),
    prisma.scheduleVersion.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        studySessions: {
          include: { topic: { include: { subject: true } } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        },
      },
    }),
    prisma.quizQuestion.findMany({
      where: { topic: { subject: { userId: user.id } } },
      include: { topic: { include: { subject: true } } },
      orderBy: { id: "asc" },
    }),
  ]);

  // Compute explainable AI insights for each topic
  const enhancedSubjects = subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    examDate: subject.examDate.toISOString().slice(0, 10),
    topics: subject.topics.map((topic) => {
      const priorityScore = calculatePriorityScore(
        subject.examDate,
        topic.difficulty,
        topic.quizAttempts,
        currentDate
      );
      const weaknessScore = calculateStudentWeakness(topic.quizAttempts);
      return {
        id: topic.id,
        name: topic.name,
        difficulty: topic.difficulty,
        hours: topic.estimatedHours,
        completed: topic.status === TopicStatus.COMPLETED,
        priorityScore: Math.round(priorityScore * 100),
        weaknessScore: Math.round(weaknessScore * 100),
        quizAttemptsCount: topic.quizAttempts.length,
      };
    }),
  }));

  response.json({
    profile: { dailyStudyHours: user.dailyStudyHours },
    subjects: enhancedSubjects,
    sessions: schedule?.studySessions.map(mapSession) ?? [],
    questions: questions.map(mapQuestion),
  });
};

