export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type Topic = {
	id: string
	name: string
	difficulty: Difficulty
	hours: number
	completed: boolean
	priorityScore?: number
	weaknessScore?: number
	quizAttemptsCount?: number
}

export type Subject = {
	id: string
	name: string
	examDate: string
	color: string
	topics: Topic[]
}

export type SessionType = 'STUDY' | 'REVISION' | 'QUIZ'

export type StudySession = {
	id: string
	topicId: string
	topicName: string
	subjectName: string
	date: string
	startTime: string
	durationMinutes: number
	sessionType?: SessionType
	completed: boolean
}

export type QuizQuestion = {
	id: string
	topicId: string
	prompt: string
	options: string[]
	explanation?: string
	topicName: string
	subjectName: string
}

export type AiEngineStatus = {
	engine: 'api' | 'fallback'
	provider: 'opencode' | 'gemini' | 'fallback'
	label: string
	details: string
}

export type GenerationResult = {
	sessions: StudySession[]
	aiEngine: 'api' | 'fallback'
	aiProvider: string
	message?: string
}

export type PlannerData = {
	subjects: Subject[]
	sessions: StudySession[]
	questions: QuizQuestion[]
	dailyStudyHours: number
	aiStatus?: AiEngineStatus
}

type PlannerResponse = {
	profile: { dailyStudyHours: number }
	subjects: (Omit<Subject, 'color' | 'topics'> & {
		topics: (Omit<Topic, 'difficulty'> & {
			difficulty: string
		})[]
	})[]
	sessions: StudySession[]
	questions: QuizQuestion[]
	aiStatus?: AiEngineStatus
}

const colors = ['#dce978', '#f2ad8f', '#a9c9f4', '#d0b7ec', '#89c9b4']
const apiBase = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const response = await fetch(`${apiBase}${path}`, {
		...options,
		headers: { 'Content-Type': 'application/json', ...options?.headers },
	})
	if (response.status === 204) return undefined as T
	const body: unknown = await response.json()
	if (!response.ok) {
		const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
			? body.message
			: `Request failed (${response.status})`
		throw new Error(message)
	}
	return body as T
}

function json(method: string, body?: unknown): RequestInit {
	return { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }
}

export const plannerApi = {
	async getPlanner(): Promise<PlannerData> {
		const result = await request<PlannerResponse>('/planner')
		return {
			dailyStudyHours: result.profile.dailyStudyHours,
			subjects: result.subjects.map((subject, index) => ({
				...subject,
				color: colors[index % colors.length] ?? '#a9c9f4',
				topics: subject.topics.map((topic) => ({
					...topic,
					difficulty: `${topic.difficulty[0]}${topic.difficulty.slice(1).toLowerCase()}` as Difficulty,
				})),
			})),
			sessions: result.sessions,
			questions: result.questions,
			aiStatus: result.aiStatus ?? {
				engine: 'fallback',
				provider: 'fallback',
				label: 'Fallback Algo Active',
				details: 'Using deterministic Multi-Criteria Decision Analysis (MCDA) + cognitive interleaving',
			},
		}
	},
	addSubject: (name: string, examDate: string) => request<Subject>('/subjects', json('POST', { name, examDate })),
	removeSubject: (subjectId: string) => request<void>(`/subjects/${encodeURIComponent(subjectId)}`, json('DELETE')),
	addTopic: (subjectId: string, name: string, difficulty: Difficulty, hours: number) =>
		request<Topic>(`/subjects/${encodeURIComponent(subjectId)}/topics`, json('POST', { name, difficulty: difficulty.toUpperCase(), hours })),
	setTopicCompleted: (topicId: string, completed: boolean) =>
		request<Topic>(`/topics/${encodeURIComponent(topicId)}`, json('PATCH', { completed })),
	generateSchedule: (customPrompt?: string) =>
		request<GenerationResult | StudySession[]>('/schedule/generate', json('POST', { customPrompt })),
	setSessionCompleted: (sessionId: string, completed: boolean) =>
		request<StudySession>(`/sessions/${encodeURIComponent(sessionId)}`, json('PATCH', { completed })),
	addQuestion: (topicId: string, prompt: string, options: string[], answer: string, explanation?: string) =>
		request<{ id: string }>(`/topics/${encodeURIComponent(topicId)}/questions`, json('POST', { prompt, options, answer, explanation })),
	generateAiQuiz: (topicId: string) =>
		request<QuizQuestion[]>(`/topics/${encodeURIComponent(topicId)}/generate-quiz`, json('POST')),
	removeQuestion: (questionId: string) => request<void>(`/questions/${encodeURIComponent(questionId)}`, json('DELETE')),
	answerQuestion: (questionId: string, selected: string) =>
		request<{ correct: boolean; correctAnswer: string; explanation?: string; attemptId: string }>(
			`/questions/${encodeURIComponent(questionId)}/answer`,
			json('POST', { selected })
		),
}
