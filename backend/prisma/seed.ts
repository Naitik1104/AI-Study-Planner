import { PrismaClient, Difficulty, TopicStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.STUDY_PLANNER_USER_EMAIL ?? "student@local.studywell";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: process.env.STUDY_PLANNER_USER_NAME ?? "Student",
      email,
      dailyStudyHours: 3,
    },
  });

  console.log(`Seeding sample data for user: ${user.name} (${user.email})`);

  // Future exam dates relative to today
  const today = new Date();
  const datePlusDays = (days: number) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + days);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };

  const dsaExam = datePlusDays(14); // 2 weeks
  const dbmsExam = datePlusDays(21); // 3 weeks

  // 1. Data Structures & Algorithms
  const dsa = await prisma.subject.create({
    data: {
      userId: user.id,
      name: "Data Structures & Algorithms",
      examDate: dsaExam,
      topics: {
        create: [
          {
            name: "Linked Lists & Pointers",
            difficulty: Difficulty.MEDIUM,
            estimatedHours: 4,
            status: TopicStatus.ACTIVE,
            quizQuestions: {
              create: [
                {
                  question: "What is the time complexity to insert a node at the beginning of a singly linked list?",
                  options: ["O(1)", "O(n)", "O(log n)", "O(n^2)"],
                  correctAnswer: "A",
                  explanation: "Inserting at the head requires only updating head pointer and next reference, taking constant O(1) time.",
                },
                {
                  question: "Which technique detects a cycle in a linked list with O(1) auxiliary space?",
                  options: ["Floyd's Tortoise and Hare algorithm", "Breadth-First Search", "Dijkstra's Algorithm", "Binary Search"],
                  correctAnswer: "A",
                  explanation: "Floyd's cycle-finding algorithm uses slow and fast pointers to detect cycles without additional memory.",
                },
              ],
            },
          },
          {
            name: "Binary Search Trees & AVL Trees",
            difficulty: Difficulty.HARD,
            estimatedHours: 6,
            status: TopicStatus.ACTIVE,
            quizQuestions: {
              create: [
                {
                  question: "What is the worst-case lookup time complexity in an unbalanced Binary Search Tree?",
                  options: ["O(n)", "O(log n)", "O(1)", "O(n log n)"],
                  correctAnswer: "A",
                  explanation: "When elements are inserted in sorted order, a standard BST degenerates into a linear linked list with O(n) lookup.",
                },
              ],
            },
          },
        ],
      },
    },
  });

  // 2. Database Management Systems
  await prisma.subject.create({
    data: {
      userId: user.id,
      name: "Database Management Systems",
      examDate: dbmsExam,
      topics: {
        create: [
          {
            name: "ACID Transactions & Concurrency",
            difficulty: Difficulty.HARD,
            estimatedHours: 5,
            status: TopicStatus.ACTIVE,
            quizQuestions: {
              create: [
                {
                  question: "Which ACID property guarantees that all operations within a transaction are completed or none are?",
                  options: ["Atomicity", "Consistency", "Isolation", "Durability"],
                  correctAnswer: "A",
                  explanation: "Atomicity ensures an 'all-or-nothing' execution guarantee for all database statements in a transaction.",
                },
              ],
            },
          },
          {
            name: "Normalization & BCNF",
            difficulty: Difficulty.MEDIUM,
            estimatedHours: 4,
            status: TopicStatus.ACTIVE,
          },
        ],
      },
    },
  });

  console.log("Database seeded successfully with subjects, topics, and initial quiz questions!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

