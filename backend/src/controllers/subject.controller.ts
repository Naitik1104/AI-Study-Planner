import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { getLocalUser } from "./profile.controller";
import { mapSubject } from "../utils/mappers";

const subjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  examDate: z.string().date(),
});

export const createSubject = async (request: Request, response: Response) => {
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
};

export const deleteSubject = async (request: Request, response: Response) => {
  const user = await getLocalUser();
  const result = await prisma.subject.deleteMany({
    where: { id: request.params.subjectId as string, userId: user.id },
  });
  if (!result.count) {
    response.status(404).json({ message: "Subject not found" });
    return;
  }
  response.status(204).end();
};

