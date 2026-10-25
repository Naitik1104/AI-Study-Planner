import { GoogleGenAI, Type } from "@google/genai";

export interface ParserTopic {
  id: string;
  name: string;
  subjectName: string;
}

/**
 * Fallback heuristic logic if Gemini API is missing or fails.
 * Checks for keyword matches in topic names and subject names.
 */
function fallbackParse(prompt: string, topics: ParserTopic[]): Record<string, number> {
  const multipliers: Record<string, number> = {};
  const lowerPrompt = prompt.toLowerCase();

  for (const topic of topics) {
    let multiplier = 1.0;
    const lowerTopic = topic.name.toLowerCase();
    const lowerSubject = topic.subjectName.toLowerCase();

    // Give a 2.5x boost if the specific topic is mentioned
    if (lowerPrompt.includes(lowerTopic)) {
      multiplier = Math.max(multiplier, 2.5);
    }
    // Give a 1.5x boost to all topics in a subject if the subject is mentioned
    else if (lowerPrompt.includes(lowerSubject)) {
      multiplier = Math.max(multiplier, 1.5);
    }
    
    // Also check for explicit deprioritization words near the topic
    // A rudimentary check (Gemini will be much better at this)
    if ((lowerPrompt.includes("less") || lowerPrompt.includes("skip") || lowerPrompt.includes("don't")) && 
        (lowerPrompt.includes(lowerTopic) || lowerPrompt.includes(lowerSubject))) {
      multiplier = 0.5;
    }

    multipliers[topic.id] = multiplier;
  }

  return multipliers;
}

/**
 * Uses Gemini API to semantically understand the user's custom scheduling request,
 * falling back to keyword heuristics if the API key is missing or the request fails.
 */
export async function parseCustomPrompt(prompt: string, topics: ParserTopic[]): Promise<Record<string, number>> {
  if (!prompt || prompt.trim() === "") {
    return {};
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No GEMINI_API_KEY found, using fallback intent parser.");
    return fallbackParse(prompt, topics);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `You are a study planning assistant. The user has provided a custom instruction for their study schedule.
    Given their active topics, your job is to output a priority multiplier for each topic based on their request.
    - Default multiplier is 1.0.
    - If they want to focus on a topic, give it > 1.0 (e.g. 2.0 to 3.0).
    - If they want to avoid or do less of a topic, give it < 1.0 (e.g. 0.5).
    Return an array of modifications.`;

    const promptText = `
    User Prompt: "${prompt}"
    
    Available Topics:
    ${topics.map(t => `- ID: ${t.id}, Topic: ${t.name}, Subject: ${t.subjectName}`).join("\n")}
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
    if (!text) throw new Error("Empty response from Gemini");

    const adjustments: { topicId: string, multiplier: number }[] = JSON.parse(text);
    
    const multipliers: Record<string, number> = {};
    for (const adj of adjustments) {
      multipliers[adj.topicId] = adj.multiplier;
    }
    
    return multipliers;

  } catch (error) {
    console.error("Gemini intent parsing failed, using fallback:", error);
    return fallbackParse(prompt, topics);
  }
}
