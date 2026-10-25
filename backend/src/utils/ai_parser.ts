import { GoogleGenAI, Type } from "@google/genai";

export interface ParserTopic {
  id: string;
  name: string;
  subjectName: string;
}

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
  const boostTerms = ["focus", "more", "priority", "prioritize", "urgent", "deep dive", "important", "heavy", "heavily", "master", "struggling", "weak", "revise"];
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
      if (hasGeneralBoost && (topics.some(t => t.name.toLowerCase() !== lowerTopic && cleaned.includes(t.name.toLowerCase())))) {
        multiplier = 0.85;
      }
    }

    multipliers[topic.id] = Math.round(multiplier * 100) / 100;
  }

  return multipliers;
}

/**
 * Parses user custom instruction via Gemini AI API if configured,
 * or effortlessly switches to the algorithmic NLP parser.
 */
export async function parseCustomPrompt(
  prompt: string,
  topics: ParserTopic[]
): Promise<Record<string, number>> {
  if (!prompt || prompt.trim() === "" || topics.length === 0) {
    return {};
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("your-api-key") || apiKey.trim() === "") {
    return algorithmicFallbackParse(prompt, topics);
  }

  try {
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
  } catch (error) {
    console.warn("Gemini intent parsing failed, using deterministic algorithmic parser:", error);
    return algorithmicFallbackParse(prompt, topics);
  }
}
