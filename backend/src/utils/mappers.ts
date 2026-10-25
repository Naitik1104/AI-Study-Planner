import { Difficulty, Prisma, TopicStatus, SessionStatus, SessionType } from "@prisma/client";

export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function mapSubject(subject: {
  id: string;
  name: string;
  examDate: Date;
  topics: {
    id: string;
    name: string;
    difficulty: Difficulty;
    estimatedHours: number;
    status: TopicStatus;
    quizAttempts?: { percentage: number }[];
  }[];
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

export function mapSession(session: {
  id: string;
  topicId: string;
  date: Date;
  startTime: string;
  durationMinutes: number;
  sessionType?: SessionType;
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
    sessionType: session.sessionType ?? SessionType.STUDY,
    completed: session.status === SessionStatus.COMPLETED,
    status: session.status,
  };
}

export function mapQuestion(question: {
  id: string;
  topicId: string;
  question: string;
  options: Prisma.JsonValue;
  correctAnswer?: string;
  explanation?: string | null;
  topic: { name: string; subject: { name: string } };
}) {
  return {
    id: question.id,
    topicId: question.topicId,
    prompt: question.question,
    options: Array.isArray(question.options)
      ? question.options.filter((option): option is string => typeof option === "string")
      : [],
    explanation: question.explanation ?? "",
    topicName: question.topic.name,
    subjectName: question.topic.subject.name,
  };
}

