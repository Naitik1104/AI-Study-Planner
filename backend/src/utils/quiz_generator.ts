import { GoogleGenAI, Type } from "@google/genai";

export interface GeneratedQuestion {
  prompt: string;
  options: string[];
  answer: "A" | "B" | "C" | "D";
  explanation: string;
}

/**
 * Intelligent algorithmic quiz question generator (runs when no AI API is connected or API fails).
 * Dynamically synthesizes high-yield diagnostic questions tailored to:
 * - Topic name & Subject name
 * - Difficulty (EASY, MEDIUM, HARD)
 * - Custom Prompt / Focus Instruction (e.g. complexity, scenario, vulnerabilities, edge cases)
 */
export function generateAlgorithmicQuestions(
  topicName: string,
  subjectName: string,
  difficulty: string = "MEDIUM",
  customPrompt?: string,
  count: number = 3
): GeneratedQuestion[] {
  const diffLevel = difficulty.toUpperCase();
  const cleanTopic = topicName.trim();
  const cleanSubject = subjectName.trim();
  const promptLower = (customPrompt || "").toLowerCase();

  const questions: GeneratedQuestion[] = [];

  // 1. Check for prompt-specific focus areas
  const isComplexityFocus = promptLower.includes("complexity") || promptLower.includes("time") || promptLower.includes("space") || promptLower.includes("big-o");
  const isSecurityFocus = promptLower.includes("security") || promptLower.includes("attack") || promptLower.includes("vulnerab") || promptLower.includes("exploit") || promptLower.includes("encrypt");
  const isScenarioFocus = promptLower.includes("scenario") || promptLower.includes("real-world") || promptLower.includes("practical") || promptLower.includes("case study");
  const isArchitectureFocus = promptLower.includes("architect") || promptLower.includes("design") || promptLower.includes("pattern") || promptLower.includes("scal");
  const isEdgeCaseFocus = promptLower.includes("edge") || promptLower.includes("fail") || promptLower.includes("error") || promptLower.includes("recovery") || promptLower.includes("corner");

  if (isComplexityFocus) {
    questions.push({
      prompt: `[Complexity Focus] When evaluating the algorithmic complexity of operations in "${cleanTopic}" (${cleanSubject}), which bound accurately represents the worst-case time or auxiliary space constraint?`,
      options: [
        `Optimal implementations achieve logarithmic O(log n) or linear O(n) bounds by leveraging invariants and avoiding redundant recomputation.`,
        `All operations unconditionally degenerate to quadratic O(n^2) regardless of input structure.`,
        `Memory overhead is always strictly zero auxiliary bytes due to in-place kernel optimizations.`,
        `Complexity is non-deterministic and cannot be mathematically bounded by asymptotic analysis.`,
      ],
      answer: "A",
      explanation: `In ${cleanSubject}, mastering "${cleanTopic}" requires identifying asymptotic bounds and ensuring that structural invariants prevent worst-case degeneration.`,
    });
  }

  if (isSecurityFocus) {
    questions.push({
      prompt: `[Security & Robustness] In a production environment involving "${cleanTopic}" (${cleanSubject}), which vulnerability or security threat represents the most critical attack vector?`,
      options: [
        `Insufficient input sanitization, insecure defaults, or missing authentication boundaries allowing unauthorized state manipulation.`,
        `Using standard open-source cryptographic libraries instead of proprietary custom implementations.`,
        `Enforcing strict TLS 1.3 protocol handshakes and certificate pinning.`,
        `Auditing access logs regularly using immutable storage backends.`,
      ],
      answer: "A",
      explanation: `For "${cleanTopic}", lack of validation boundaries or failing to enforce principle of least privilege constitutes the primary exploitation vector.`,
    });
  }

  if (isScenarioFocus || isArchitectureFocus) {
    questions.push({
      prompt: `[Architectural Scenario] A high-throughput distributed system encounters a bottleneck in its "${cleanTopic}" layer. Which design strategy best mitigates the latency spike?`,
      options: [
        `Decoupling stateful operations, introducing asynchronous message buffering, and applying backpressure.`,
        `Converting all asynchronous processes into synchronous blocking loops.`,
        `Eliminating caching and requiring every thread to query the persistent store directly.`,
        `Doubling hardware CPU count without addressing lock contention or algorithmic bottlenecks.`,
      ],
      answer: "A",
      explanation: `Horizontal scaling and decoupled asynchronous event queues isolate surges and prevent cascaded failures in "${cleanTopic}".`,
    });
  }

  if (isEdgeCaseFocus) {
    questions.push({
      prompt: `[Edge Case & Fault Tolerance] When dealing with boundary conditions and unhandled states in "${cleanTopic}", which defensive programming approach is recommended?`,
      options: [
        `Enforcing strict pre-conditions, validating null/boundary values, and handling timeouts gracefully with circuit breakers.`,
        `Swallowing all exceptions silently to prevent process termination.`,
        `Assuming inputs will always conform to the ideal schema.`,
        `Disabling telemetry and logging to conserve execution cycles during error states.`,
      ],
      answer: "A",
      explanation: `Defensive verification of boundary conditions, idempotency, and fail-fast assertions protect against unexpected state corruption in "${cleanTopic}".`,
    });
  }

  // 2. Add difficulty-calibrated questions if more needed to satisfy count
  if (diffLevel === "EASY") {
    questions.push({
      prompt: `What is the fundamental purpose and core objective of "${cleanTopic}" in the context of ${cleanSubject}?`,
      options: [
        `It provides a foundational, standardized methodology to organize logic, data, or processes efficiently.`,
        `It is solely an aesthetic convention with no architectural or operational purpose.`,
        `It serves as an obsolete mechanism replaced universally in modern industry.`,
        `It is restricted exclusively to low-level assembly language environments.`,
      ],
      answer: "A",
      explanation: `In ${cleanSubject}, "${cleanTopic}" provides the baseline conceptual foundation required to solve domain problems systematically.`,
    });
    questions.push({
      prompt: `Which basic prerequisite or concept is most essential before implementing "${cleanTopic}"?`,
      options: [
        `Understanding foundational data representations, control flow, and interface contracts.`,
        `Mastering quantum cryptography algorithms.`,
        `Setting up a multi-region distributed cloud cluster.`,
        `Writing an operating system kernel from scratch.`,
      ],
      answer: "A",
      explanation: `A solid grasp of fundamental data structures and logical specifications is the core prerequisite for "${cleanTopic}".`,
    });
  } else if (diffLevel === "HARD") {
    questions.push({
      prompt: `In an advanced examination problem on "${cleanTopic}" (${cleanSubject}), what subtle trade-off between consistency, performance, and resource usage must be evaluated?`,
      options: [
        `Balancing synchronization overhead and lock contention against data consistency and horizontal throughput.`,
        `Choosing between writing code and writing documentation.`,
        `Determining whether to use modern IDEs or basic text editors.`,
        `Deciding whether to test code in development or directly deploy to production.`,
      ],
      answer: "A",
      explanation: `Advanced engineering questions on "${cleanTopic}" test your ability to balance lock granularity, latency, and consistency guarantees under heavy concurrent load.`,
    });
    questions.push({
      prompt: `What failure mode is most characteristic of poorly optimized or improperly isolated implementations of "${cleanTopic}"?`,
      options: [
        `Cascading failures or memory leaks resulting from unconstrained resource exhaustion and blocking I/O.`,
        `Instant compile-time prevention of all logical flaws.`,
        `Linear speedup proportional to thread count without synchronization limits.`,
        `Complete immunity to hardware faults.`,
      ],
      answer: "A",
      explanation: `Unbounded resource growth, deadlocks, and cascading latency degradation are classic failure modes in complex "${cleanTopic}" subsystems.`,
    });
  } else {
    // MEDIUM (default)
    questions.push({
      prompt: `How does "${cleanTopic}" interact with other core modules within ${cleanSubject} to maintain system integrity?`,
      options: [
        `It encapsulates specific responsibilities and exposes clear abstraction boundaries for surrounding components.`,
        `It tightly couples with every internal variable of adjacent modules.`,
        `It bypasses all network protocols and execution runtimes.`,
        `It replaces the underlying operating system scheduler.`,
      ],
      answer: "A",
      explanation: `Modular separation of concerns and clear interface contracts allow "${cleanTopic}" to integrate cleanly into broader ${cleanSubject} architectures.`,
    });
    questions.push({
      prompt: `When testing the implementation of "${cleanTopic}", which testing tier is most effective for discovering integration defects?`,
      options: [
        `Combining unit tests for isolated invariants with integration tests for end-to-end component contracts.`,
        `Relying exclusively on manual smoke tests in production.`,
        `Skipping automated tests if code compiles without warnings.`,
        `Only verifying happy-path scenarios with hardcoded inputs.`,
      ],
      answer: "A",
      explanation: `Comprehensive verification requires testing both isolated unit invariants and interaction contracts under varying loads.`,
    });
  }

  // Ensure we have at least 'count' questions (up to 4)
  while (questions.length < count && questions.length < 4) {
    questions.push({
      prompt: `What best practice should an engineer adopt when maintaining or refactoring code related to "${cleanTopic}"?`,
      options: [
        `Adhering to single-responsibility principles, documenting non-obvious invariants, and maintaining regression coverage.`,
        `Modifying core interfaces without updating dependent callers or tests.`,
        `Hardcoding configuration parameters directly into source files.`,
        `Eliminating type checks to speed up the interpreter.`,
      ],
      answer: "A",
      explanation: `Maintainability in "${cleanTopic}" requires preserving invariants, decoupling dependencies, and ensuring regression test coverage.`,
    });
  }

  return questions.slice(0, count);
}

/**
 * Generates quiz questions using OpenCode API.
 */
async function generateQuizViaOpenCode(
  topicName: string,
  subjectName: string,
  difficulty: string,
  customPrompt?: string,
  count: number = 3
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPEN_CODE_API_KEY;
  if (!apiKey || apiKey.trim() === "") throw new Error("No OPEN_CODE_API_KEY");

  const model = process.env.OPEN_CODE_MODEL || "gpt-5.4-mini";
  const systemPrompt = `You are a distinguished engineering professor and technical examiner.
Generate exactly ${count} rigorous, multiple-choice diagnostic questions (MCQs) for university engineering students.
Format requirements:
Output ONLY a valid JSON array of objects with fields:
- "prompt": question text (clear, conceptual, or scenario-based)
- "options": array of exactly 4 distinct, plausible choices
- "answer": "A", "B", "C", or "D" (matching the correct choice)
- "explanation": concise educational explanation why that answer is correct and others are not
Output ONLY raw JSON. No markdown code fences, no conversational text.`;

  const userPrompt = `Subject: ${subjectName}
Topic: ${topicName}
Difficulty Level: ${difficulty}
${customPrompt && customPrompt.trim() ? `User Focus / Custom Prompt: "${customPrompt.trim()}"\nEnsure the generated questions specifically test this focus area.` : ""}
Generate exactly ${count} questions.`;

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
      max_tokens: 1200,
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
  difficulty: string,
  customPrompt?: string,
  count: number = 3
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("your-api-key") || apiKey.trim() === "") {
    throw new Error("No GEMINI_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are a distinguished engineering professor and technical examiner.
Generate exactly ${count} rigorous, multiple-choice questions (MCQs) for university engineering students.
Each question must test conceptual understanding, analysis, or architectural trade-offs.`;

  const promptText = `
Subject: ${subjectName}
Topic: ${topicName}
Difficulty: ${difficulty}
${customPrompt && customPrompt.trim() ? `Custom Focus Instruction: "${customPrompt.trim()}"\nPlease ensure the questions test this specific aspect.` : ""}
Questions requested: ${count}
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
  difficulty: string = "MEDIUM",
  customPrompt?: string,
  count: number = 3
): Promise<GeneratedQuestion[]> {
  // 1. Try OpenCode API
  if (process.env.OPEN_CODE_API_KEY && process.env.OPEN_CODE_API_KEY.trim().length > 5) {
    try {
      return await generateQuizViaOpenCode(topicName, subjectName, difficulty, customPrompt, count);
    } catch (e: any) {
      console.warn("OpenCode quiz generation failed, trying alternative/fallback:", e.message);
    }
  }

  // 2. Try Gemini API
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10 && !process.env.GEMINI_API_KEY.includes("your-api-key")) {
    try {
      return await generateQuizViaGemini(topicName, subjectName, difficulty, customPrompt, count);
    } catch (e: any) {
      console.warn("Gemini quiz generation failed, using algorithmic generator:", e.message);
    }
  }

  // 3. Algorithmic Fallback
  return generateAlgorithmicQuestions(topicName, subjectName, difficulty, customPrompt, count);
}
