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
