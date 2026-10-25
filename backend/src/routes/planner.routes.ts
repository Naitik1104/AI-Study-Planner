import { Router } from "express";
import { getPlannerData, getLocalUser } from "../controllers/profile.controller";
import { createSubject, deleteSubject } from "../controllers/subject.controller";
import { createTopic, updateTopicStatus } from "../controllers/topic.controller";
import { generateStudySchedule, updateSessionStatus } from "../controllers/schedule.controller";
import {
  createQuestion,
  deleteQuestion,
  answerQuestion,
  generateAiQuestionsForTopic,
} from "../controllers/quiz.controller";

const router = Router();

// Planner & Profile
router.get("/planner", getPlannerData);

// Subjects
router.post("/subjects", createSubject);
router.delete("/subjects/:subjectId", deleteSubject);

// Topics
router.post("/subjects/:subjectId/topics", createTopic);
router.patch("/topics/:topicId", updateTopicStatus);

// Study Schedule (AI + Algorithmic Engine)
router.post("/schedule/generate", generateStudySchedule);
router.patch("/sessions/:sessionId", updateSessionStatus);

// Quizzes & Active Recall
router.post("/topics/:topicId/questions", createQuestion);
router.delete("/questions/:questionId", deleteQuestion);
router.post("/questions/:questionId/answer", answerQuestion);
router.post("/topics/:topicId/generate-quiz", generateAiQuestionsForTopic);

export { getLocalUser };
export default router;
