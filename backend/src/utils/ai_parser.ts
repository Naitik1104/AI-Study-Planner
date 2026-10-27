import { GoogleGenAI, Type } from "@google/genai";

export interface ParserTopic {
  id: string;
  name: string;
  subjectName: string;
}

export interface ParseResult {
  multipliers: Record<string, number>;
  engine: "api" | "fallback";
  provider: "opencode" | "gemini" | "fallback";
  message?: string;
}

export interface AiEngineStatus {
  engine: "api" | "fallback";
  provider: "opencode" | "gemini" | "fallback";
  label: string;
  details: string;
}

let cachedStatus: (AiEngineStatus & { timestamp: number }) | null = null;
let lastPlanningEngine: "api" | "fallback" = "fallback";
let lastPlanningProvider: "opencode" | "gemini" | "fallback" = "fallback";

/**
 * Intelligent Algorithmic Fallback Parser.
 * Operates deterministically without requiring an external AI API key.
 * Analyzes natural language intent, keyword proximity, and sentiment to compute
 * mathematically grounded priority multipliers.
 */
export function algorithmicFallbackParse(prompt: string, topics: ParserTopic[]): Record<string, number> {
  const multipliers: Record<string, number> = {};
  const cleaned = prompt.trim().toLowerCase();
  if (!cleaned) {
    return multipliers;
  }

  // Common boost keywords
  const boostTerms = [
    "focus", "more", "priority", "prioritize", "urgent", "deep dive",
    "important", "heavy", "heavily", "master", "struggling", "weak", "revise"
  ];
  // Deprioritize keywords
  const reduceTerms = ["less", "skip", "ignore", "don't", "dont", "avoid", "easy", "later", "slight"];

  const hasGeneralBoost = boostTerms.some((term) => cleaned.includes(term));
  const hasGeneralReduce = reduceTerms.some((term) => cleaned.includes(term));

  for (const topic of topics) {
    let multiplier = 1.0;
    const lowerTopic = topic.name.trim().toLowerCase();
    const lowerSubject = topic.subjectName.trim().toLowerCase();

    // Regex with word boundaries for accurate token matching
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const topicPattern = new RegExp(`(^|\\b|\\W)${escapeRegex(lowerTopic)}(\\b|\\W|$)`, "i");
    const subjectPattern = new RegExp(`(^|\\b|\\W)${escapeRegex(lowerSubject)}(\\b|\\W|$)`, "i");

    const matchesTopic = topicPattern.test(cleaned) || (lowerTopic.length > 3 && cleaned.includes(lowerTopic));
    const matchesSubject = subjectPattern.test(cleaned) || (lowerSubject.length > 3 && cleaned.includes(lowerSubject));

    if (matchesTopic) {
      if (hasGeneralReduce && cleaned.includes("skip")) {
        multiplier = 0.2;
      } else if (hasGeneralReduce) {
        multiplier = 0.5;
      } else {
        multiplier = 2.5; // Significant focus boost for specifically requested topic
      }
    } else if (matchesSubject) {
      if (hasGeneralReduce) {
        multiplier = 0.6;
      } else {
        multiplier = 1.7; // Moderate boost for entire subject
      }
    } else {
      // If user specified an explicit focus on something else, other topics slightly de-escalate
      if (hasGeneralBoost && (topics.some((t) => t.name.toLowerCase() !== lowerTopic && cleaned.includes(t.name.toLowerCase())))) {
        multiplier = 0.85;
      }
    }

    multipliers[topic.id] = Math.round(multiplier * 100) / 100;
  }

  return multipliers;
}

/**
 * Calls OpenCode inference API using OPEN_CODE_API_KEY.
 */
async function callOpenCodeApi(prompt: string, topics: ParserTopic[]): Promise<Record<string, number>> {
  const apiKey = process.env.OPEN_CODE_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("No OPEN_CODE_API_KEY configured");
  }

  const model = process.env.OPEN_CODE_MODEL || "gpt-5.4-mini";
  const systemPrompt = `You are an AI study planning assistant.
The user provided a custom instruction for their study schedule.
Given active topics, output a JSON array of objects with topicId and multiplier:
- 1.0 is default/normal priority.
- 2.0 to 3.0 represents topics the student wants to focus on or study more.
- 0.2 to 0.5 represents topics the student wants to skip or spend less time on.
Output ONLY a valid JSON array like: [{"topicId":"...","multiplier":2.5}]. Do not include markdown code blocks or conversational text.`;

  const userPrompt = `Student prompt: "${prompt}"

Available Topics:
${topics.map((t) => `- ID: ${t.id} | Topic: "${t.name}" in Subject: "${t.subjectName}"`).join("\n")}`;

  const response = await fetch("https://opencode.ai/inference/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenCode API responded with status ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as any;
  const rawText: string = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!rawText) {
    throw new Error("Empty response from OpenCode API");
  }

  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  const cleanJson = jsonMatch ? jsonMatch[0] : rawText;
  const adjustments: { topicId: string; multiplier: number }[] = JSON.parse(cleanJson);

  const multipliers: Record<string, number> = {};
  for (const adj of adjustments) {
    if (typeof adj.topicId === "string" && typeof adj.multiplier === "number") {
      multipliers[adj.topicId] = Math.max(0.1, Math.min(5.0, adj.multiplier));
    }
  }

  return multipliers;
}

/**
 * Secondary Gemini API call if GEMINI_API_KEY is configured.
 */
async function callGeminiApi(prompt: string, topics: ParserTopic[]): Promise<Record<string, number>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("your-api-key") || apiKey.trim() === "") {
    throw new Error("No GEMINI_API_KEY configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are an AI study planning assistant.
Analyze the student's study request and calculate priority multipliers for their topics.
- Multiplier 1.0 is neutral/normal.
- Multiplier 2.0 to 3.0 represents topics the student wants to focus on or study more.
- Multiplier 0.2 to 0.6 represents topics the student wants to skip or spend less time on.
- Return a JSON array of objects: { topicId: string, multiplier: number }.`;

  const promptText = `
Student prompt: "${prompt}"

Available Topics:
${topics.map((t) => `- ID: ${t.id} | Topic: "${t.name}" in Subject: "${t.subjectName}"`).join("\n")}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: promptText,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topicId: { type: Type.STRING },
            multiplier: { type: Type.NUMBER },
          },
          required: ["topicId", "multiplier"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini API");
  }

  const adjustments: { topicId: string; multiplier: number }[] = JSON.parse(text);
  const multipliers: Record<string, number> = {};
  for (const adj of adjustments) {
    if (typeof adj.topicId === "string" && typeof adj.multiplier === "number") {
      multipliers[adj.topicId] = Math.max(0.1, Math.min(5.0, adj.multiplier));
    }
  }

  return multipliers;
}

/**
 * Parses user custom instruction:
 * 1. Tries OpenCode API first (from OPEN_CODE_API_KEY).
 * 2. Tries Gemini API second (from GEMINI_API_KEY).
 * 3. Falls back to algorithmic parser seamlessly.
 */
export async function parseCustomPrompt(
  prompt: string,
  topics: ParserTopic[]
): Promise<ParseResult> {
  const cleanPrompt = prompt ? prompt.trim() : "";
  if (!cleanPrompt || topics.length === 0) {
    const status = await probeAiEngine();
    return {
      multipliers: {},
      engine: status.engine,
      provider: status.provider,
    };
  }

  // 1. Try OpenCode API
  if (process.env.OPEN_CODE_API_KEY && process.env.OPEN_CODE_API_KEY.trim().length > 5) {
    try {
      const multipliers = await callOpenCodeApi(cleanPrompt, topics);
      lastPlanningEngine = "api";
      lastPlanningProvider = "opencode";
      cachedStatus = {
        engine: "api",
        provider: "opencode",
        label: "AI Engine Active",
        details: "AI model connected for intelligent study planning",
        timestamp: Date.now(),
      };
      return {
        multipliers,
        engine: "api",
        provider: "opencode",
        message: "Successfully parsed custom prompt with AI",
      };
    } catch (err: any) {
      console.warn("OpenCode API error, trying alternative or fallback:", err.message);
    }
  }

  // 2. Try Gemini API as secondary
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10) {
    try {
      const multipliers = await callGeminiApi(cleanPrompt, topics);
      lastPlanningEngine = "api";
      lastPlanningProvider = "gemini";
      cachedStatus = {
        engine: "api",
        provider: "gemini",
        label: "Gemini AI Active",
        details: "Using Gemini API for study planning",
        timestamp: Date.now(),
      };
      return {
        multipliers,
        engine: "api",
        provider: "gemini",
        message: "Successfully parsed custom prompt with Gemini API",
      };
    } catch (err: any) {
      console.warn("Gemini API error, falling back to algorithmic parser:", err.message);
    }
  }

  // 3. Deterministic Algorithmic Fallback
  const multipliers = algorithmicFallbackParse(cleanPrompt, topics);
  lastPlanningEngine = "fallback";
  lastPlanningProvider = "fallback";
  cachedStatus = {
    engine: "fallback",
    provider: "fallback",
    label: "Fallback Algorithm Active",
    details: "Using deterministic MCDA & keyword heuristic scheduler",
    timestamp: Date.now(),
  };

  return {
    multipliers,
    engine: "fallback",
    provider: "fallback",
    message: "Using deterministic algorithmic fallback scheduler",
  };
}

/**
 * Checks the live engine status:
 * Probes OpenCode API / Gemini API to determine if API is usable or fallback should be shown.
 */
export async function probeAiEngine(): Promise<AiEngineStatus> {
  const now = Date.now();
  if (cachedStatus && now - cachedStatus.timestamp < 30000) {
    return cachedStatus;
  }

  const openCodeKey = process.env.OPEN_CODE_API_KEY;
  if (openCodeKey && openCodeKey.trim().length > 5) {
    try {
      const res = await fetch("https://opencode.ai/inference/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openCodeKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPEN_CODE_MODEL || "gpt-5.4-mini",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
      });

      if (res.ok) {
        cachedStatus = {
          engine: "api",
          provider: "opencode",
          label: "AI Engine Active",
          details: "AI engine connected for intelligent study planning",
          timestamp: now,
        };
        lastPlanningEngine = "api";
        lastPlanningProvider = "opencode";
        return cachedStatus;
      }
    } catch {
      // Fall through to fallback
    }
  }

  // If OpenCode returned error or no key, check Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 10 && !geminiKey.includes("your-api-key")) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const resp = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "ping",
      });
      if (resp.text) {
        cachedStatus = {
          engine: "api",
          provider: "gemini",
          label: "Gemini AI Active",
          details: "Connected to Gemini API for study planning",
          timestamp: now,
        };
        lastPlanningEngine = "api";
        lastPlanningProvider = "gemini";
        return cachedStatus;
      }
    } catch {
      // Fall through
    }
  }

  // Fallback engine
  cachedStatus = {
    engine: "fallback",
    provider: "fallback",
    label: "Fallback Algo Active",
    details: "Using deterministic Multi-Criteria Decision Analysis (MCDA) + cognitive interleaving",
    timestamp: now,
  };
  lastPlanningEngine = "fallback";
  lastPlanningProvider = "fallback";
  return cachedStatus;
}

export function getLastPlanningEngine(): { engine: "api" | "fallback"; provider: "opencode" | "gemini" | "fallback" } {
  return {
    engine: lastPlanningEngine,
    provider: lastPlanningProvider,
  };
}
