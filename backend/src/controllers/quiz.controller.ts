import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { getLocalUser } from "./profile.controller";
import { executeScheduleGeneration } from "./schedule.controller";
import { generateQuizQuestions } from "../utils/quiz_generator";
import { mapQuestion } from "../utils/mappers";
import { ScheduleTrigger } from "@prisma/client";

const questionSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(4),
  answer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().trim().max(2000).default(""),
});

const answerSchema = z.object({
  selected: z.enum(["A", "B", "C", "D"]),
});

export const createQuestion = async (request: Request, response: Response) => {
  const parsed = questionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid question", issues: parsed.error.issues });
    return;
  }

  if (
    parsed.data.options.length < 2 ||
    parsed.data.options.length > 4 ||
    String.fromCharCode(64 + parsed.data.options.length) < parsed.data.answer
  ) {
    response.status(400).json({ message: "The correct answer must match one of the supplied choices" });
    return;
  }

  const user = await getLocalUser();
  const topic = await prisma.topic.findFirst({
    where: { id: request.params.topicId as string, subject: { userId: user.id } },
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
};

export const deleteQuestion = async (request: Request, response: Response) => {
  const user = await getLocalUser();
  const result = await prisma.quizQuestion.deleteMany({
    where: { id: request.params.questionId as string, topic: { subject: { userId: user.id } } },
  });
  if (!result.count) {
    response.status(404).json({ message: "Question not found" });
    return;
  }
  response.status(204).end();
};

export const answerQuestion = async (request: Request, response: Response) => {
  const parsed = answerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid answer", issues: parsed.error.issues });
    return;
  }

  const user = await getLocalUser();
  const question = await prisma.quizQuestion.findFirst({
    where: { id: request.params.questionId as string, topic: { subject: { userId: user.id } } },
    include: { topic: { include: { subject: true } } },
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

  // Adaptive Rescheduling: Automatically recalculate study plan based on performance
  try {
    await executeScheduleGeneration(user.id, ScheduleTrigger.QUIZ_RESULT);
  } catch (error) {
    console.warn("Adaptive rescheduling after quiz failed:", error);
  }

  response.json({
    correct,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    attemptId: attempt.id,
  });
};

/**
 * Generate AI quiz questions on-demand for a topic.
 * Uses Gemini API if connected, or the algorithmic knowledge generator if no API key is present.
 */
export const generateAiQuestionsForTopic = async (request: Request, response: Response) => {
  const user = await getLocalUser();
  const topic = await prisma.topic.findFirst({
    where: { id: request.params.topicId as string, subject: { userId: user.id } },
    include: { subject: true },
  });

  if (!topic) {
    response.status(404).json({ message: "Topic not found" });
    return;
  }

  const generatedQuestions = await generateQuizQuestions(
    topic.name,
    topic.subject.name,
    topic.difficulty
  );

  const createdQuestions = [];
  for (const q of generatedQuestions) {
    const created = await prisma.quizQuestion.create({
      data: {
        topicId: topic.id,
        question: q.prompt,
        options: q.options,
        correctAnswer: q.answer,
        explanation: q.explanation,
      },
      include: { topic: { include: { subject: true } } },
    });
    createdQuestions.push(mapQuestion(created));
  }

  response.status(201).json(createdQuestions);
};
