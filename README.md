# Studywell Study Planner

A local study planner built with React, Express, Prisma, and MySQL. The frontend and backend run as separate development servers. Planner data is stored in MySQL, not in browser storage.

## Requirements

- Node.js 20.19+ or 22.12+ (npm is included with Node.js)
- MySQL Server 8.x installed and running locally
- A terminal opened in the project folder

No Docker is needed.

## 1. Install MySQL and create the database

Install and start **MySQL Community Server** for your operating system. On Windows, the MySQL Installer can install MySQL Server as a Windows service. MySQL Workbench is optional, but provides a graphical place to run SQL commands.

Connect to the local MySQL server using Workbench or the MySQL command-line client, then run this once:

```sql
CREATE DATABASE ai_study_planner;
```

The app expects MySQL on `localhost:3306` by default. Make sure the MySQL service is running before starting the backend.

## 2. Configure the backend

Open a terminal in the project folder, then:

```sh
cd backend
```

Create the backend environment file. In PowerShell:

```powershell
Copy-Item .env.example .env
```

Or in Command Prompt:

```bat
copy .env.example .env
```

Open `backend/.env` and replace the sample `DATABASE_URL` username and password with the MySQL credentials you created. For example:

```env
PORT=5000
DATABASE_URL="mysql://root:your_mysql_password@localhost:3306/ai_study_planner"
STUDY_PLANNER_USER_EMAIL=student@local.studywell
STUDY_PLANNER_USER_NAME=Student
DAILY_STUDY_HOURS=2
```

Use your actual MySQL password in place of `your_mysql_password`. Keep `STUDY_PLANNER_USER_EMAIL` unchanged between runs; it identifies this local planner profile. `DAILY_STUDY_HOURS` controls the schedule generator and must be between 1 and 6.

Install dependencies and create the Prisma client and database tables:

```sh
npm install
npm run db:generate
npm run db:push
```

`db:push` creates or updates the MySQL tables to match `backend/prisma/schema.prisma`. It does not add sample planner subjects; create your own from the app.

Start the backend:

```sh
npm run dev
```

Keep this terminal open. The API runs at `http://localhost:5000`. Check its database connection at `http://localhost:5000/health`; a healthy response includes `"database":"connected"`.

## 3. Start the frontend

Open a **second terminal** in the project folder:

```sh
cd frontend
npm install
npm run dev
```

Keep this terminal open too. Open the URL printed by Vite, usually `http://localhost:5173`.

The frontend sends `/api` requests through Vite to the backend on port `5000`, so both servers must be running while using the app. Subjects, topics, schedule sessions, quiz questions, and quiz attempts are saved to MySQL and are still there after restarting the app or refreshing the browser.

## Starting it again later

Make sure MySQL is running. Open two terminals in the project folder:

Terminal 1:

```sh
cd backend
npm run dev
```

Terminal 2:

```sh
cd frontend
npm run dev
```

Then open `http://localhost:5173`.

## Troubleshooting

- **`npm` is not recognized:** Install Node.js, close and reopen the terminal, then check `node --version` and `npm --version`.
- **PowerShell says scripts are disabled when running `npm`:** Use a Command Prompt terminal in VS Code, then run the same `npm install` / `npm run ...` commands. You do not need to change the system execution policy.
- **Backend says MySQL is unavailable:** Start the MySQL service, confirm it listens on port `3306`, check the username/password in `backend/.env`, and verify that `ai_study_planner` exists.
- **Prisma reports a missing table or schema:** From the `backend` directory run `npm run db:generate` and `npm run db:push`, then restart `npm run dev`.
- **Port 5000 or 5173 is already in use:** Stop the other process using that port, or choose another backend `PORT` in `backend/.env` and update the Vite proxy in `frontend/vite.config.ts` to match.

## Current scope

The app currently uses a single local profile selected by `STUDY_PLANNER_USER_EMAIL`. It does not yet provide sign-in, multiple accounts, or shared cloud hosting.

AI Study Planner — Complete System & AI Architecture Documentation
1. System Vision & Purpose

The AI Study Planner replaces static, manually drawn revision timetables with an intelligent, adaptive scheduling system. It operates on real, measurable student inputs:

Subjects & Exam Proximity
Topic Difficulty (Easy, Medium, Hard)
Daily Study Capacity (Hours/Day)
Quiz Performance & Demonstrable Topic Mastery
Natural Language Custom Instructions (e.g., "Focus more on Linked Lists", "Prioritize nearest exams")

Whether an external AI API (Gemini) is connected or the system operates offline/locally, the planner provides a sophisticated deterministic algorithmic foundation ensuring mathematically sound, fatigue-reducing, and adaptive schedules.

2. Core Closed-Loop Adaptive Workflow
Student Input: Courses, exam dates, syllabus topics, and daily capacity.
Priority Calculation: Multi-Criteria Decision Analysis (MCDA) calculates a priority score (0–100%) for every topic.
Smart Scheduling: Pomodoro chunking (30–60 min blocks), subject interleaving (preventing burnout), and spaced revision slots (STUDY, REVISION, QUIZ).
Active Recall: The student takes diagnostic quizzes generated on-demand by AI or synthesized algorithmically.
Adaptive Feedback Loop: Quiz scores directly adjust topic weakness 
𝑊
W. If a student scores poorly, weakness increases, priority elevates, and upcoming sessions automatically allocate more study and revision time without manual intervention.
3. Mathematical Foundations & Algorithms
A. Topic Priority Calculation (MCDA)

Every topic is assigned a priority score 
𝑃
∈
[
0
,
1
]
P∈[0,1] based on three factors:
Priority Score
=
𝑤
1
⋅
Exam Urgency
+
𝑤
2
⋅
Topic Difficulty
+
𝑤
3
⋅
Student Weakness
Priority Score=w
1
	​

⋅Exam Urgency+w
2
	​

⋅Topic Difficulty+w
3
	​

⋅Student Weakness

Configured Weights: 
𝑤
1
=
0.40
w
1
	​

=0.40, 
𝑤
2
=
0.30
w
2
	​

=0.30, 
𝑤
3
=
0.30
w
3
	​

=0.30.

1. Exam Urgency (
𝑈
U)

Urgency follows a hyperbolic decay function as the exam date approaches:

𝑈
=
{
1.0
	
if daysRemaining
≤
0


max
⁡
(
0.1
,
1
1
+
0.1
×
daysRemaining
)
	
if daysRemaining
>
0
U={
1.0
max(0.1,
1+0.1×daysRemaining
1
	​

)
	​

if daysRemaining≤0
if daysRemaining>0
	​

2. Topic Difficulty (
𝐷
D)

Directly mapped from student perception:

𝐷
=
{
0.33
	
EASY


0.66
	
MEDIUM


1.00
	
HARD
D=
⎩
⎨
⎧
	​

0.33
0.66
1.00
	​

EASY
MEDIUM
HARD
	​

3. Student Weakness (
𝑊
W)

Derived empirically from quiz attempt history:

𝑊
=
{
0.50
	
if no quiz attempts exist


max
⁡
(
0.0
,
1.0
−
Score
‾
100
)
	
based on average quiz percentage
W={
0.50
max(0.0,1.0−
100
Score
	​

)
	​

if no quiz attempts exist
based on average quiz percentage
	​

B. Cognitive Allocation & Spaced Revision Algorithm

Located in backend/src/utils/allocation.ts:

Chunking (Pomodoro Principle): Limits sessions to a maximum of 60 minutes and a minimum of 30 minutes, separated by 15-minute breaks.
Cognitive Interleaving: If the top candidate subject was just scheduled, the engine checks whether a topic from an alternate subject has a priority score 
≥
70
%
≥70% of the top candidate. If so, it schedules the alternate subject to avoid cognitive exhaustion.
Spaced Revision: For challenging topics (
Difficulty
=
HARD
Difficulty=HARD or 
𝑊
≥
0.4
W≥0.4), the algorithm queues a 30-minute REVISION session 2 days after primary study completion, followed by an active recall QUIZ session 4 days later.
C. Natural Language Custom Prompting & Fallbacks

Located in backend/src/utils/ai_parser.ts:

With Gemini API (GEMINI_API_KEY): Calls Gemini (gemini-2.5-flash) with structured JSON schema output to parse student instructions into topic-specific priority multipliers.
Algorithmic NLP Fallback (Offline / No Key): Uses regex token boundary analysis, keyword extraction ("focus", "more", "skip", "less", "urgent"), and topic name matching to calculate multipliers (e.g., 
2.5
×
2.5× for specifically mentioned topics, 
0.2
×
0.2× for skipped topics).
D. AI Quiz Generation & Active Recall

Located in backend/src/utils/quiz_generator.ts:

With Gemini API: Creates high-yield academic multiple-choice questions with 4 options, the correct answer, and an in-depth pedagogical explanation.
Algorithmic Fallback: Synthesizes structured diagnostic questions tailored to the topic name, subject domain, and difficulty level.
Instant Adaptation: Answering a question records the score and immediately calls the scheduler to re-balance future study sessions.
4. Verification & Testing Status
Component	Status	Verification Detail
Priority Scoring Unit Tests	Pass	Tested urgency decay, difficulty mapping, and weakness weighting
Allocation Engine Unit Tests	Pass	Tested Pomodoro chunking [60, 60, 30] and cognitive interleaving
Backend TypeScript Compiler	Pass	npx tsc --noEmit exited with 0 errors
Frontend Production Build	Pass	npm run build compiled 1,886 modules cleanly
End-to-End API Endpoints	Pass	Verified /api/planner, /api/schedule/generate, /api/topics/:id/generate-quiz, /api/questions/:id/answer
Zero Empty Files	Pass	All empty placeholder files have been eliminated or implemented