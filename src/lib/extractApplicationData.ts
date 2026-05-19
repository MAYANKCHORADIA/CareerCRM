import { GoogleGenAI } from "@google/genai";
import { ApplicationStatus } from "@/generated/prisma/enums";

// ─── Types ───────────────────────────────────────────────────────────

export type ExtractedApplicationData = {
  companyName: string;
  roleTitle: string;
  newStatus: ApplicationStatus;
  actionItems: string[];
};

export type ExtractionResult =
  | { success: true; data: ExtractedApplicationData }
  | { success: false; error: string };

// ─── Constants ───────────────────────────────────────────────────────

const VALID_STATUSES = Object.values(ApplicationStatus);

const SYSTEM_PROMPT = `You are an expert ATS (Applicant Tracking System) email parser for a job-application CRM.

Your task: Read a raw email and extract structured application data from it.

You MUST respond with ONLY a valid JSON object — no markdown, no backticks, no explanation. The JSON must match this exact shape:

{
  "companyName": "string — the hiring company's name",
  "roleTitle": "string — the job title / role being applied for",
  "newStatus": "string — one of: SAVED, APPLIED, ASSESSMENT, INTERVIEW, OFFER, REJECTED",
  "actionItems": ["string — action items or next steps extracted from the email"]
}

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

If the email does not appear to be related to a job application at all, return:
{
  "companyName": "Unknown",
  "roleTitle": "Unknown",
  "newStatus": "SAVED",
  "actionItems": []
}`;

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

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\n---\n\nEMAIL TEXT:\n\n${emailText}`,
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
      return {
        success: false,
        error: `LLM returned invalid JSON: ${rawText.slice(0, 200)}`,
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

    return {
      success: true,
      data: { companyName, roleTitle, newStatus, actionItems },
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
