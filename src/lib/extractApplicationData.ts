import { GoogleGenAI } from "@google/genai";
import { ApplicationStatus } from "@/generated/prisma/enums";

// ─── Types ───────────────────────────────────────────────────────────

export type ExtractedTask = {
  title: string;
  dueDate: string | null; // ISO 8601 string or null if no specific date
};

export type ExtractedApplicationData = {
  companyName: string;
  roleTitle: string;
  newStatus: ApplicationStatus;
  actionItems: string[];
  tasks: ExtractedTask[];
};

export type ExtractionResult =
  | { success: true; data: ExtractedApplicationData }
  | { success: false; error: string };

// ─── Constants ───────────────────────────────────────────────────────

const VALID_STATUSES = Object.values(ApplicationStatus);

/**
 * Build the system prompt dynamically so we can inject today's date.
 * The LLM needs the current date to resolve relative references
 * like "this Friday", "next week", or "in 3 days".
 */
function getSystemPrompt(): string {
  const today = new Date().toISOString().split("T")[0]; // e.g. "2026-05-20"

  return `You are an expert ATS (Applicant Tracking System) email parser for a job-application CRM.

Your task: Read a raw email and extract structured application data from it.

You MUST respond with ONLY a valid JSON object — no markdown, no backticks, no explanation. The JSON must match this exact shape:

{
  "companyName": "string — the hiring company's name",
  "roleTitle": "string — the job title / role being applied for",
  "newStatus": "string — one of: SAVED, APPLIED, ASSESSMENT, INTERVIEW, OFFER, REJECTED",
  "actionItems": ["string — action items or next steps extracted from the email"],
  "tasks": [
    {
      "title": "string — a specific task or deadline the candidate must complete",
      "dueDate": "string | null — ISO 8601 date-time (e.g. 2026-05-25T00:00:00.000Z), or null if no date"
    }
  ]
}

Today's date is ${today}. Use this to resolve relative dates like "this Friday", "next Monday", "in 3 days", etc.

Rules for determining "newStatus":
- APPLIED → confirmation that an application was received / submitted
- ASSESSMENT → coding challenge, take-home test, technical assessment, online test
- INTERVIEW → phone screen, video interview, on-site interview, panel interview, scheduled call
- OFFER → offer letter, compensation details, start date
- REJECTED → rejection, position filled, not moving forward, decided not to proceed
- SAVED → only if none of the above apply (e.g. job alert, saved listing)

Rules for "actionItems":
- Extract any deadlines, dates, links, or tasks the candidate needs to complete.
- If there are no action items, return an empty array [].

Rules for "tasks":
- Extract any specific deadlines, scheduled events, or dated action items from the email.
- Examples: "complete this assessment by Friday", "interview scheduled for May 25th", "respond by June 10, 2026", "schedule a call within the next 5 days".
- For each, provide a short descriptive title and parse the date into ISO 8601 format.
- If a deadline is mentioned but the year is ambiguous, assume the current year (or next year if the date has already passed).
- If no deadlines or scheduled events are found, return an empty array [].

If the email does not appear to be related to a job application at all, return:
{
  "companyName": "Unknown",
  "roleTitle": "Unknown",
  "newStatus": "SAVED",
  "actionItems": [],
  "tasks": []
}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Attempt to parse a date string into an ISO 8601 timestamp.
 * Handles ISO strings, common date formats, and falls back to null.
 */
function parseDateToISO(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "" || dateStr === "null") return null;

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }

  return null;
}

// ─── Regex Fallback Parser ───────────────────────────────────────────

/**
 * When the LLM returns slightly malformed JSON (e.g. trailing commas,
 * unquoted keys, truncated output), attempt to extract fields individually
 * using regex. This is a best-effort fallback — not a full JSON parser.
 */
function tryRegexFallback(text: string): ExtractedApplicationData | null {
  const companyMatch = text.match(/"companyName"\s*:\s*"([^"]+)"/i);
  const roleMatch = text.match(/"roleTitle"\s*:\s*"([^"]+)"/i);
  const statusMatch = text.match(/"newStatus"\s*:\s*"([^"]+)"/i);
  const actionItemsMatch = text.match(/"actionItems"\s*:\s*\[([\s\S]*?)\]/i);
  const tasksMatch = text.match(/"tasks"\s*:\s*\[([\s\S]*?)\]/i);

  const companyName = companyMatch?.[1]?.trim() ?? "Unknown";
  const roleTitle = roleMatch?.[1]?.trim() ?? "Unknown";

  // Both unknown means the text wasn't recognizable at all
  if (companyName === "Unknown" && roleTitle === "Unknown") {
    return null;
  }

  let newStatus: ApplicationStatus = ApplicationStatus.SAVED;
  if (
    statusMatch &&
    VALID_STATUSES.includes(statusMatch[1] as ApplicationStatus)
  ) {
    newStatus = statusMatch[1] as ApplicationStatus;
  }

  let actionItems: string[] = [];
  if (actionItemsMatch?.[1]) {
    actionItems = [...actionItemsMatch[1].matchAll(/"([^"]+)"/g)]
      .map((m) => m[1].trim())
      .filter((s) => s.length > 0);
  }

  // Extract tasks from malformed JSON
  let tasks: ExtractedTask[] = [];
  if (tasksMatch?.[1]) {
    const taskBlocks = tasksMatch[1].match(/\{[^}]+\}/g) ?? [];
    for (const block of taskBlocks) {
      const titleMatch = block.match(/"title"\s*:\s*"([^"]+)"/i);
      const dueDateMatch = block.match(/"dueDate"\s*:\s*"([^"]+)"/i);
      if (titleMatch) {
        tasks.push({
          title: titleMatch[1].trim(),
          dueDate: dueDateMatch ? parseDateToISO(dueDateMatch[1]) : null,
        });
      }
    }
  }

  return { companyName, roleTitle, newStatus, actionItems, tasks };
}

// ─── Main Function ───────────────────────────────────────────────────

/**
 * Sends raw email text to Google Gemini and returns structured application data.
 *
 * @param emailText - The raw plaintext content of the email.
 * @returns An ExtractionResult indicating success with parsed data, or failure with an error message.
 *
 * @example
 * ```ts
 * const result = await extractApplicationData(emailBody);
 * if (result.success) {
 *   console.log(result.data.companyName); // "Google"
 *   console.log(result.data.tasks);       // [{ title: "...", dueDate: "..." }]
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function extractApplicationData(
  emailText: string
): Promise<ExtractionResult> {
  // ── Guard: empty input ──────────────────────────────────────────
  if (!emailText || emailText.trim().length === 0) {
    return { success: false, error: "Email text is empty." };
  }

  // ── Guard: missing API key ──────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error:
        "GEMINI_API_KEY is not set. Add it to your .env file.",
    };
  }

  try {
    // ── Call Gemini ────────────────────────────────────────────────
    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = getSystemPrompt();

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\n---\n\nEMAIL TEXT:\n\n${emailText}`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    });

    const rawText = response.text?.trim();

    if (!rawText) {
      return { success: false, error: "LLM returned an empty response." };
    }

    // ── Parse JSON from response ──────────────────────────────────
    // Strip markdown fences if the model wraps output in ```json ... ```
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // JSON.parse failed — try regex-based field extraction as fallback
      const regexResult = tryRegexFallback(cleaned);
      if (regexResult) {
        return { success: true, data: regexResult };
      }
      return {
        success: false,
        error: `LLM returned invalid JSON and regex fallback failed: ${rawText.slice(0, 200)}`,
      };
    }

    // ── Validate shape ────────────────────────────────────────────
    if (!parsed || typeof parsed !== "object") {
      return { success: false, error: "LLM response is not a JSON object." };
    }

    const obj = parsed as Record<string, unknown>;

    const companyName =
      typeof obj.companyName === "string" ? obj.companyName : "Unknown";
    const roleTitle =
      typeof obj.roleTitle === "string" ? obj.roleTitle : "Unknown";

    // Validate status against our enum
    let newStatus: ApplicationStatus = ApplicationStatus.SAVED;
    if (
      typeof obj.newStatus === "string" &&
      VALID_STATUSES.includes(obj.newStatus as ApplicationStatus)
    ) {
      newStatus = obj.newStatus as ApplicationStatus;
    }

    // Validate action items array
    let actionItems: string[] = [];
    if (Array.isArray(obj.actionItems)) {
      actionItems = obj.actionItems
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }

    // Validate tasks array
    let tasks: ExtractedTask[] = [];
    if (Array.isArray(obj.tasks)) {
      tasks = obj.tasks
        .filter(
          (t): t is Record<string, unknown> =>
            t !== null && typeof t === "object"
        )
        .map((t) => ({
          title:
            typeof t.title === "string" && t.title.trim().length > 0
              ? t.title.trim()
              : "",
          dueDate:
            typeof t.dueDate === "string" ? parseDateToISO(t.dueDate) : null,
        }))
        .filter((t) => t.title.length > 0);
    }

    return {
      success: true,
      data: { companyName, roleTitle, newStatus, actionItems, tasks },
    };
  } catch (error: unknown) {
    // ── Handle SDK / network errors ───────────────────────────────
    const message =
      error instanceof Error ? error.message : "Unknown error occurred.";
    return {
      success: false,
      error: `LLM extraction failed: ${message}`,
    };
  }
}
