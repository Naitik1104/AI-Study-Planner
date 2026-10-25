import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { getLocalUser } from "./profile.controller";
import { TopicStatus } from "@prisma/client";

const topicSchema = z.object({
  name: z.string().trim().min(1).max(150),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  hours: z.number().positive().max(100),
});

const completedSchema = z.object({ completed: z.boolean() });

export const createTopic = async (request: Request, response: Response) => {
  const parsed = topicSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid topic", issues: parsed.error.issues });
    return;
  }

  const user = await getLocalUser();
  const subject = await prisma.subject.findFirst({
    where: { id: request.params.subjectId as string, userId: user.id },
  });
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
};

export const updateTopicStatus = async (request: Request, response: Response) => {
  const parsed = completedSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid topic update", issues: parsed.error.issues });
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

  const updated = await prisma.topic.update({
    where: { id: topic.id },
    data: { status: parsed.data.completed ? TopicStatus.COMPLETED : TopicStatus.ACTIVE },
  });
  response.json({ id: updated.id, completed: updated.status === TopicStatus.COMPLETED });
};
