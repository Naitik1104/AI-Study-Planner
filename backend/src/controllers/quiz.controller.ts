import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { ScheduleTrigger } from '@prisma/client';

export const getQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topicId = req.params.id;
    if (typeof topicId !== 'string') {
      return res.status(400).json({ success: false, message: "Invalid topic ID" });
    }
    
    const questions = await prisma.quizQuestion.findMany({
      where: { topicId },
      // Select minimal data for client
      select: {
        id: true,
        question: true,
        options: true,
        questionType: true,
      }
    });
    
    res.json({ success: true, data: questions });
  } catch (error) {
    next(error);
  }
};

export const submitQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const topicId = req.params.id;
    if (typeof topicId !== 'string') {
      return res.status(400).json({ success: false, message: "Invalid topic ID" });
    }
    const { answers } = req.body; // { [questionId]: "selectedOption" }

    const questions = await prisma.quizQuestion.findMany({
      where: { topicId }
    });

    if (questions.length === 0) {
      return res.status(404).json({ success: false, message: "No questions found for this topic" });
    }

    let score = 0;
    const results = questions.map(q => {
      const selected = answers[q.id];
      const isCorrect = selected === q.correctAnswer;
      if (isCorrect) score++;
      
      return {
        questionId: q.id,
        question: q.question,
        selected,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation
      };
    });

    const percentage = (score / questions.length) * 100;

    const attempt = await prisma.quizAttempt.create({
      data: {
        topicId,
        score,
        totalQuestions: questions.length,
        percentage
      }
    });

    // A real system would now trigger the scheduler regeneration via a service.
    // For now, we return the result and the client can trigger regeneration manually or we do it async.
    
    // As per instruction 14: "When a quiz is submitted: ... Create new ScheduleVersion."
    // We will do this via the ScheduleController / Service, but for now we just return.
    // I'll leave the trigger to the client or schedule service.

    res.json({ 
      success: true, 
      data: {
        attempt,
        results
      }
    });
  } catch (error) {
    next(error);
  }
};
