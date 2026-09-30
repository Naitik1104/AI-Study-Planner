import "dotenv/config";
import cors from "cors";
import express from "express";
import { prisma } from "./config/db";
import plannerRoutes from "./routes/planner.routes";

const app = express();
const port = Number(process.env.PORT ?? 5000);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(",") ?? true }));
app.use(express.json({ limit: "100kb" }));
app.use("/api", plannerRoutes);

app.get("/", (_request, response) => {
	response.json({ name: "ai-study-planner-api", status: "running" });
});

app.get("/health", async (_request, response) => {
	try {
		await prisma.$queryRaw`SELECT 1`;
		response.json({ status: "ok", database: "connected" });
	} catch {
		response.status(503).json({ status: "error", database: "unavailable" });
	}
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
	console.error(error);
	const databaseUnavailable = error instanceof Error && /P1001|P1003|can't reach database server|ECONNREFUSED/i.test(error.message);
	response.status(databaseUnavailable ? 503 : 500).json({
		message: databaseUnavailable
			? "MySQL is unavailable. Start the local database and check DATABASE_URL in backend/.env."
			: "The request could not be completed",
	});
});

app.listen(port, () => {
	console.log(`Backend listening on http://localhost:${port}`);
});
