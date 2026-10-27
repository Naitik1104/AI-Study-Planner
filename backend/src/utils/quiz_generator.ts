import { GoogleGenAI, Type } from "@google/genai";

export interface GeneratedQuestion {
  prompt: string;
  options: string[];
  answer: "A" | "B" | "C" | "D";
  explanation: string;
}

/**
 * Algorithmic quiz question generator (runs when no AI API is connected or API fails).
 * Synthesizes high-yield diagnostic questions based on topic name, subject, and difficulty.
 */
export function generateAlgorithmicQuestions(
  topicName: string,
  subjectName: string,
  difficulty: string
): GeneratedQuestion[] {
  const diffLevel = difficulty.toUpperCase();
  const cleanTopic = topicName.trim();
  const cleanSubject = subjectName.trim();

  // Curated knowledge-base templates adaptable to any technical or theoretical topic
  const questions: GeneratedQuestion[] = [
    {
      prompt: `Which of the following best characterizes the primary objective or principle of "${cleanTopic}" in ${cleanSubject}?`,
      options: [
        `It provides a structured mechanism to solve core problems efficiently within ${cleanSubject}.`,
        `It serves solely as an optional syntactic decoration with no performance impact.`,
        `It completely replaces all foundational architectures in ${cleanSubject}.`,
        `It is strictly deprecated in modern computing and industry practices.`,
      ],
      answer: "A",
      explanation: `In ${cleanSubject}, "${cleanTopic}" represents a fundamental concept designed to optimize workflows, data handling, or logical structure.`,
    },
    {
      prompt: `When analyzing the complexity or performance impact of "${cleanTopic}", which consideration is most critical?`,
      options: [
        `Ignoring edge cases and focusing exclusively on average-case throughput.`,
        `Evaluating worst-case resource consumption (time and space complexity) and scalability.`,
        `Assuming static memory allocation is always superior regardless of scale.`,
        `Only checking compatibility with legacy hardware configurations.`,
      ],
      answer: "B",
      explanation: `Proper mastery of "${cleanTopic}" requires evaluating scalability and resource trade-offs under varying workloads.`,
    },
    {
      prompt: `What is a common pitfall or misconception when implementing or studying "${cleanTopic}"?`,
      options: [
        `Overcomplicating the implementation without validating simpler alternative patterns.`,
        `Verifying pre-conditions and post-conditions thoroughly.`,
        `Writing modular tests to inspect edge cases.`,
        `Profiling the execution before deploying optimizations.`,
      ],
      answer: "A",
      explanation: `Premature optimization or excessive complexity without addressing core invariants is a frequent mistake in ${cleanTopic}.`,
    },
  ];

  if (diffLevel === "HARD") {
    questions.push({
      prompt: `In an advanced examination scenario on "${cleanTopic}", which optimization strategy is typically recommended?`,
      options: [
        `Relying on brute-force iteration across all inputs.`,
        `Leveraging caching, memoization, or specialized invariant properties to minimize overhead.`,
        `Hardcoding expected outputs for known inputs.`,
        `Removing error boundaries to achieve marginally lower latency.`,
      ],
      answer: "B",
      explanation: `Advanced problems in "${cleanTopic}" test your ability to reduce redundant operations through strategic state management and invariants.`,
    });
  }

  return questions;
}

/**
 * Generates quiz questions using OpenCode API.
 */
async function generateQuizViaOpenCode(
  topicName: string,
  subjectName: string,
  difficulty: string
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPEN_CODE_API_KEY;
  if (!apiKey || apiKey.trim() === "") throw new Error("No OPEN_CODE_API_KEY");

  const model = process.env.OPEN_CODE_MODEL || "gpt-5.4-mini";
  const systemPrompt = `You are an expert academic educator and exam creator.
Generate 3 to 4 high-quality Multiple Choice Questions (MCQs) for a student preparing for exams on the given topic.
Output ONLY a valid JSON array of objects with fields:
- "prompt": question text
- "options": array of 4 distinct choices
- "answer": "A", "B", "C", or "D"
- "explanation": educational explanation why that answer is correct
Output ONLY the raw JSON array. Do not include markdown codeblocks or conversational text.`;

  const userPrompt = `Subject: ${subjectName}\nTopic: ${topicName}\nDifficulty: ${difficulty}`;

  const res = await fetch("https://opencode.ai/inference/v1/chat/completions", {
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
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenCode quiz generation failed with status ${res.status}`);
  }

  const data = (await res.json()) as any;
  const rawText: string = data?.choices?.[0]?.message?.content?.trim() || "";
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  const cleanJson = jsonMatch ? jsonMatch[0] : rawText;
  const parsed = JSON.parse(cleanJson);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Invalid format from OpenCode quiz generation");
  }
  return parsed;
}

/**
 * Generates quiz questions using Gemini API.
 */
async function generateQuizViaGemini(
  topicName: string,
  subjectName: string,
  difficulty: string
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("your-api-key") || apiKey.trim() === "") {
    throw new Error("No GEMINI_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are an expert academic educator and exam creator.
Generate 3 to 4 high-quality Multiple Choice Questions (MCQs) for a student preparing for exams on the given topic.
Each question must have:
- prompt: Clear, conceptual question text.
- options: Exactly 4 distinct answer choices.
- answer: Single letter matching the correct choice: "A", "B", "C", or "D".
- explanation: Clear educational explanation why that answer is correct.`;

  const promptText = `
Subject: ${subjectName}
Topic: ${topicName}
Difficulty: ${difficulty}
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
            prompt: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            answer: {
              type: Type.STRING,
              enum: ["A", "B", "C", "D"],
            },
            explanation: { type: Type.STRING },
          },
          required: ["prompt", "options", "answer", "explanation"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini API");

  const parsed: GeneratedQuestion[] = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Invalid response format from Gemini API");
  }

  return parsed;
}

/**
 * Generates quiz questions using OpenCode API first, Gemini API second, or falls back to algorithmic synthesis.
 */
export async function generateQuizQuestions(
  topicName: string,
  subjectName: string,
  difficulty: string
): Promise<GeneratedQuestion[]> {
  // 1. Try OpenCode API
  if (process.env.OPEN_CODE_API_KEY && process.env.OPEN_CODE_API_KEY.trim().length > 5) {
    try {
      return await generateQuizViaOpenCode(topicName, subjectName, difficulty);
    } catch (e: any) {
      console.warn("OpenCode quiz generation failed, trying fallback:", e.message);
    }
  }

  // 2. Try Gemini API
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10) {
    try {
      return await generateQuizViaGemini(topicName, subjectName, difficulty);
    } catch (e: any) {
      console.warn("Gemini quiz generation failed, using algorithmic generator:", e.message);
    }
  }

  // 3. Algorithmic Fallback
  return generateAlgorithmicQuestions(topicName, subjectName, difficulty);
}
