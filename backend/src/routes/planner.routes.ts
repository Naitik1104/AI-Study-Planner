import { Difficulty, Prisma, PrismaClient, ScheduleTrigger, SessionStatus, SessionType, TopicStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";

const router = Router();

const subjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  examDate: z.string().date(),
});

const topicSchema = z.object({
  name: z.string().trim().min(1).max(150),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  hours: z.number().positive().max(100),
});

const completedSchema = z.object({ completed: z.boolean() });
const sessionSchema = z.object({ completed: z.boolean() });
const questionSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(4),
  answer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().trim().max(2000).default(""),
});
const answerSchema = z.object({ selected: z.enum(["A", "B", "C", "D"]) });

async function getLocalUser(database: PrismaClient = prisma) {
  const email = process.env.STUDY_PLANNER_USER_EMAIL ?? "student@local.studywell";
  const configuredHours = Number(process.env.DAILY_STUDY_HOURS ?? 2);
  const dailyStudyHours = Number.isInteger(configuredHours) && configuredHours >= 1 && configuredHours <= 6
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

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function mapSubject(subject: {
  id: string;
  name: string;
  examDate: Date;
  topics: { id: string; name: string; difficulty: Difficulty; estimatedHours: number; status: TopicStatus }[];
}) {
  return {
    id: subject.id,
    name: subject.name,
    examDate: dateOnly(subject.examDate),
    topics: subject.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      difficulty: topic.difficulty,
      hours: topic.estimatedHours,
      completed: topic.status === TopicStatus.COMPLETED,
    })),
  };
}

function mapSession(session: {
  id: string;
  topicId: string;
  date: Date;
  startTime: string;
  durationMinutes: number;
  status: SessionStatus;
  topic: { name: string; subject: { name: string } };
}) {
  return {
    id: session.id,
    topicId: session.topicId,
    topicName: session.topic.name,
    subjectName: session.topic.subject.name,
    date: dateOnly(session.date),
    startTime: session.startTime,
    durationMinutes: session.durationMinutes,
    completed: session.status === SessionStatus.COMPLETED,
  };
}

function mapQuestion(question: {
  id: string;
  topicId: string;
  question: string;
  options: Prisma.JsonValue;
  topic: { name: string; subject: { name: string } };
}) {
  return {
    id: question.id,
    topicId: question.topicId,
    prompt: question.question,
    options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string") : [],
    topicName: question.topic.name,
    subjectName: question.topic.subject.name,
  };
}

router.get("/planner", async (_request, response) => {
  const user = await getLocalUser();
  const [subjects, schedule, questions] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id },
      include: { topics: { orderBy: { createdAt: "asc" } } },
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

  response.json({
    profile: { dailyStudyHours: user.dailyStudyHours },
    subjects: subjects.map(mapSubject),
    sessions: schedule?.studySessions.map(mapSession) ?? [],
    questions: questions.map(mapQuestion),
  });
});

router.post("/subjects", async (request, response) => {
  const parsed = subjectSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid subject", issues: parsed.error.issues });
    return;
  }

  const user = await getLocalUser();
  const subject = await prisma.subject.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      examDate: new Date(`${parsed.data.examDate}T00:00:00.000Z`),
    },
    include: { topics: true },
  });
  response.status(201).json(mapSubject(subject));
});

router.delete("/subjects/:subjectId", async (request, response) => {
  const user = await getLocalUser();
  const result = await prisma.subject.deleteMany({
    where: { id: request.params.subjectId, userId: user.id },
  });
  if (!result.count) {
    response.status(404).json({ message: "Subject not found" });
    return;
  }
  response.status(204).end();
});

router.post("/subjects/:subjectId/topics", async (request, response) => {
  const parsed = topicSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid topic", issues: parsed.error.issues });
    return;
  }

  const user = await getLocalUser();
  const subject = await prisma.subject.findFirst({ where: { id: request.params.subjectId, userId: user.id } });
  if (!subject) {
    response.status(404).json({ message: "Subject not found" });
    return;
  }

  const topic = await prisma.topic.create({
    data: {
      subjectId: subject.id,
      name: parsed.data.name,
      difficulty: parsed.data.difficulty,
      estimatedHours: parsed.data.hours,
    },
  });
  response.status(201).json({
    id: topic.id,
    name: topic.name,
    difficulty: topic.difficulty,
    hours: topic.estimatedHours,
    completed: topic.status === TopicStatus.COMPLETED,
  });
});

router.patch("/topics/:topicId", async (request, response) => {
  const parsed = completedSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid topic update", issues: parsed.error.issues });
    return;
  }

  const user = await getLocalUser();
  const topic = await prisma.topic.findFirst({
    where: { id: request.params.topicId, subject: { userId: user.id } },
  });
  if (!topic) {
    response.status(404).json({ message: "Topic not found" });
    return;
  }

  const updated = await prisma.topic.update({
    where: { id: topic.id },
    data: { status: parsed.data.completed ? TopicStatus.COMPLETED : TopicStatus.ACTIVE },
  });
  response.json({ id: updated.id, completed: updated.status === TopicStatus.COMPLETED });
});

router.post("/schedule/generate", async (_request, response) => {
  const user = await getLocalUser();
  const topics = await prisma.topic.findMany({
    where: { subject: { userId: user.id }, status: TopicStatus.ACTIVE },
    include: { subject: true },
    orderBy: [{ subject: { examDate: "asc" } }, { difficulty: "desc" }],
  });
  if (!topics.length) {
    response.status(400).json({ message: "Add an active topic before generating a study plan" });
    return;
  }

  const sessionMinutes = 60;
  const dailyCapacity = Math.max(1, user.dailyStudyHours) * 60;
  const sessionsPerDay = Math.max(1, Math.floor(dailyCapacity / sessionMinutes));
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + 1);

  const planned: { topicId: string; date: Date; startTime: string; durationMinutes: number; sessionType: SessionType }[] = [];
  let dayOffset = 0;
  let slotOnDay = 0;
  for (const topic of topics) {
    let remainingMinutes = Math.max(30, Math.ceil(topic.estimatedHours * 60));
    while (remainingMinutes > 0) {
      if (slotOnDay >= sessionsPerDay) {
        dayOffset += 1;
        slotOnDay = 0;
      }
      const durationMinutes = Math.min(sessionMinutes, remainingMinutes, dailyCapacity);
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + dayOffset);
      planned.push({
        topicId: topic.id,
        date,
        startTime: `${String(9 + slotOnDay * 2).padStart(2, "0")}:00`,
        durationMinutes,
        sessionType: SessionType.STUDY,
      });
      slotOnDay += 1;
      remainingMinutes -= durationMinutes;
    }
  }

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
});

router.patch("/sessions/:sessionId", async (request, response) => {
  const parsed = sessionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid session update", issues: parsed.error.issues });
    return;
  }

  const user = await getLocalUser();
  const session = await prisma.studySession.findFirst({
    where: { id: request.params.sessionId, scheduleVersion: { userId: user.id } },
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
});

router.post("/topics/:topicId/questions", async (request, response) => {
  const parsed = questionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid question", issues: parsed.error.issues });
    return;
  }
  if (parsed.data.options.length < 2 || parsed.data.options.length > 4 ||
      String.fromCharCode(64 + parsed.data.options.length) < parsed.data.answer) {
    response.status(400).json({ message: "The correct answer must match one of the supplied choices" });
    return;
  }

  const user = await getLocalUser();
  const topic = await prisma.topic.findFirst({
    where: { id: request.params.topicId, subject: { userId: user.id } },
  });
  if (!topic) {
    response.status(404).json({ message: "Topic not found" });
    return;
  }

  const created = await prisma.quizQuestion.create({
    data: {
      topicId: topic.id,
      question: parsed.data.prompt,
      options: parsed.data.options,
      correctAnswer: parsed.data.answer,
      explanation: parsed.data.explanation,
    },
    include: { topic: { include: { subject: true } } },
  });
  response.status(201).json(mapQuestion(created));
});

router.delete("/questions/:questionId", async (request, response) => {
  const user = await getLocalUser();
  const result = await prisma.quizQuestion.deleteMany({
    where: { id: request.params.questionId, topic: { subject: { userId: user.id } } },
  });
  if (!result.count) {
    response.status(404).json({ message: "Question not found" });
    return;
  }
  response.status(204).end();
});

router.post("/questions/:questionId/answer", async (request, response) => {
  const parsed = answerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid answer", issues: parsed.error.issues });
    return;
  }

  const user = await getLocalUser();
  const question = await prisma.quizQuestion.findFirst({
    where: { id: request.params.questionId, topic: { subject: { userId: user.id } } },
  });
  if (!question) {
    response.status(404).json({ message: "Question not found" });
    return;
  }

  const optionCount = Array.isArray(question.options) ? question.options.length : 0;
  if (parsed.data.selected.charCodeAt(0) - 65 >= optionCount) {
    response.status(400).json({ message: "Selected answer is not one of this question's choices" });
    return;
  }

  const correct = parsed.data.selected === question.correctAnswer;
  const attempt = await prisma.quizAttempt.create({
    data: {
      topicId: question.topicId,
      score: Number(correct),
      totalQuestions: 1,
      percentage: correct ? 100 : 0,
    },
  });
  response.json({ correct, correctAnswer: question.correctAnswer, attemptId: attempt.id });
});

export { getLocalUser };
export default router;
