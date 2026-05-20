import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  extractApplicationData,
  type ExtractedApplicationData,
  type ExtractedTask,
} from "@/lib/extractApplicationData";
import { ApplicationStatus } from "@/generated/prisma/enums";

/**
 * Google Workspace Gmail Add-on — Sync Action (Alternate Runtime)
 *
 * Flow:
 * 1. Parse the OAuth token & messageId from Google's event object.
 * 2. Fetch the email content from the Gmail API.
 * 3. Extract structured application data via our Gemini LLM utility.
 * 4. Upsert the Application in Postgres and add a TimelineEvent.
 * 5. Return a Google Card Service JSON response showing the result.
 */

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Decode the plain-text body from a Gmail API message response.
 * Gmail returns bodies as URL-safe base64 — we decode to UTF-8.
 */
function extractPlainTextFromGmailMessage(message: any): string | null {
  // Simple single-part message
  if (message.payload?.body?.data) {
    return base64UrlDecode(message.payload.body.data);
  }

  // Multipart — walk parts looking for text/plain
  const parts: any[] = message.payload?.parts ?? [];
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return base64UrlDecode(part.body.data);
    }
    // Nested multipart (e.g. multipart/alternative inside multipart/mixed)
    if (part.parts) {
      for (const nested of part.parts) {
        if (nested.mimeType === "text/plain" && nested.body?.data) {
          return base64UrlDecode(nested.body.data);
        }
      }
    }
  }

  // Fallback: try the snippet (short preview text Google provides)
  if (message.snippet) {
    return message.snippet;
  }

  return null;
}

function base64UrlDecode(encoded: string): string {
  // Gmail uses URL-safe base64 (+ → -, / → _, no padding)
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/** Build a Google Card Service error card. */
function buildErrorCard(title: string, detail: string) {
  return {
    action: {
      navigations: [
        {
          pushCard: {
            header: { title: "Sync Failed", subtitle: title },
            sections: [
              {
                widgets: [
                  {
                    decoratedText: {
                      topLabel: "ERROR",
                      text: detail,
                      wrapText: true,
                      startIcon: { knownIcon: "NONE" },
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  };
}

// ─── Status Progression ──────────────────────────────────────────────

/**
 * Rank each status in the hiring pipeline.
 * Higher rank = further along.  REJECTED is special (-1).
 */
const STATUS_RANK: Record<ApplicationStatus, number> = {
  SAVED: 0,
  APPLIED: 1,
  ASSESSMENT: 2,
  INTERVIEW: 3,
  OFFER: 4,
  REJECTED: -1,
};

/**
 * Determine whether the incoming status should replace the current one.
 *
 * Rules:
 *  - REJECTED / OFFER are terminal — always accepted.
 *  - From a terminal state (OFFER / REJECTED), no further changes
 *    unless the incoming status is also terminal.
 *  - Otherwise only advance forward in the pipeline.
 */
function shouldUpdateStatus(
  current: ApplicationStatus,
  incoming: ApplicationStatus
): boolean {
  // Terminal incoming statuses always take effect
  if (incoming === "REJECTED" || incoming === "OFFER") return true;
  // Don't regress from a terminal state
  if (current === "OFFER" || current === "REJECTED") return false;
  // Only move forward in the pipeline
  return STATUS_RANK[incoming] > STATUS_RANK[current];
}

/**
 * Normalize a company name for duplicate comparison:
 * lowercase, trim, strip common suffixes (Inc., LLC, Corp., Ltd.).
 */
function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .replace(
      /\b(inc\.?|llc\.?|corp\.?|ltd\.?|co\.?|limited|corporation|incorporated)\s*$/i,
      ""
    )
    .replace(/[,.\s]+$/g, "")
    .trim()
    .toLowerCase();
}

/** Build a Google Card Service success card. */
function buildSuccessCard(
  data: ExtractedApplicationData,
  isNew: boolean,
  previousStatus?: ApplicationStatus,
  createdTaskCount?: number
) {
  const actionItemWidgets =
    data.actionItems.length > 0
      ? data.actionItems.map((item) => ({
          decoratedText: {
            text: item,
            wrapText: true,
            startIcon: { knownIcon: "DESCRIPTION" },
          },
        }))
      : [{ decoratedText: { text: "No action items identified.", wrapText: true } }];

  // Build task widgets if tasks were created
  const taskWidgets =
    data.tasks.length > 0
      ? data.tasks.map((t) => ({
          decoratedText: {
            topLabel: t.dueDate
              ? `DUE: ${new Date(t.dueDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`
              : "NO DUE DATE",
            text: `<b>${t.title}</b>`,
            wrapText: true,
            startIcon: { knownIcon: "CLOCK" },
          },
        }))
      : [];

  const sections = [
    {
      widgets: [
        {
          textParagraph: {
            text: isNew
              ? `<b>✨ Successfully added to your CRM!</b><br>We've tracked this new application for you.`
              : `<b>✅ Successfully updated!</b><br>${previousStatus ? `Moved from <b>${previousStatus}</b> to <b>${data.newStatus}</b>.` : "Your application details have been refreshed."}`,
          },
        },
      ],
    },
    {
      header: "Application Details",
      widgets: [
        {
          decoratedText: {
            topLabel: "COMPANY",
            text: `<b>${data.companyName}</b>`,
            startIcon: { knownIcon: "STORE" },
          },
        },
        {
          decoratedText: {
            topLabel: "ROLE",
            text: data.roleTitle,
            startIcon: { knownIcon: "PERSON" },
          },
        },
        {
          decoratedText: {
            topLabel: "CURRENT STATUS",
            text: `<font color=\"#4CAF50\"><b>${data.newStatus}</b></font>`,
            startIcon: { knownIcon: "STAR" },
          },
        },
      ],
    },
    {
      header: "Action Items",
      widgets: actionItemWidgets,
    },
    // Tasks section — only shown when tasks were extracted
    ...(taskWidgets.length > 0
      ? [
          {
            header: `Pending Tasks (${createdTaskCount ?? taskWidgets.length})`,
            widgets: taskWidgets,
          },
        ]
      : []),
    {
      widgets: [
        {
          buttonList: {
            buttons: [
              {
                text: "View in CareerCRM",
                color: { red: 0.25, green: 0.38, blue: 0.96, alpha: 1.0 },
                onClick: {
                  openLink: {
                    url: "https://careercrm.dev/dashboard",
                  },
                },
              },
            ],
          },
        },
      ],
    },
  ];

  return {
    action: {
      navigations: [
        {
          pushCard: {
            header: {
              title: "Sync Complete",
              subtitle: "CareerCRM",
              imageUrl: "https://www.gstatic.com/images/icons/material/system/2x/check_circle_outline_green_48dp.png",
              imageType: "CIRCLE",
            },
            sections,
          },
        },
      ],
    },
  };
}

// ─── Default demo userId ─────────────────────────────────────────────
// In production, resolve the user from the OAuth token / session.
// For now we use the demo seed user.
const DEMO_USER_EMAIL = "demo@careercrm.dev";

// ─── Route Handler ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: any;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      buildErrorCard("Invalid Request", "Could not parse the request body."),
      { status: 400 }
    );
  }

  // ── 1. Extract token & messageId from Google's event object ─────
  const oauthToken: string | undefined =
    body?.authorizationEventObject?.userOAuthToken;
  const messageId: string | undefined = body?.gmail?.messageId;

  if (!oauthToken) {
    return Response.json(
      buildErrorCard(
        "Missing OAuth Token",
        "No userOAuthToken found in the request. Make sure the add-on has the gmail.readonly scope."
      )
    );
  }

  if (!messageId) {
    return Response.json(
      buildErrorCard(
        "Missing Message ID",
        "No gmail.messageId found in the request. Open an email before syncing."
      )
    );
  }

  // ── 2. Fetch the email from the Gmail API ───────────────────────
  let emailText: string | null = null;

  try {
    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${oauthToken}`,
        },
      }
    );

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      return Response.json(
        buildErrorCard(
          `Gmail API Error (${gmailRes.status})`,
          errText.slice(0, 300)
        )
      );
    }

    const gmailMessage = await gmailRes.json();
    emailText = extractPlainTextFromGmailMessage(gmailMessage);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      buildErrorCard("Gmail Fetch Failed", msg.slice(0, 300))
    );
  }

  if (!emailText || emailText.trim().length === 0) {
    return Response.json(
      buildErrorCard(
        "Empty Email",
        "Could not extract text content from this email. It may be image-only or HTML without a plain-text part."
      )
    );
  }

  // ── 3. Pass email text to the LLM parser ────────────────────────
  const extraction = await extractApplicationData(emailText);

  if (!extraction.success) {
    return Response.json(
      buildErrorCard("LLM Parsing Failed", extraction.error)
    );
  }

  const { companyName, roleTitle, newStatus, actionItems, tasks } = extraction.data;

  // ── 4. Upsert into Postgres via Prisma ──────────────────────────
  try {
    // Resolve the user (use demo user for now)
    let user = await prisma.user.findUnique({
      where: { email: DEMO_USER_EMAIL },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: DEMO_USER_EMAIL,
          name: "Gmail Add-on User",
        },
      });
    }

    // ── Smart duplicate detection ─────────────────────────────────
    // Fetch all applications for this user and compare with normalized
    // company names to catch variants like "Google" vs "Google Inc."
    const userApps = await prisma.application.findMany({
      where: { userId: user.id },
    });

    const normIncomingCompany = normalizeCompanyName(companyName);
    const normIncomingRole = roleTitle.toLowerCase().trim();

    const existing = userApps.find(
      (app) =>
        normalizeCompanyName(app.companyName) === normIncomingCompany &&
        app.roleTitle.toLowerCase().trim() === normIncomingRole
    );

    let application;
    let isNew = false;
    let previousStatus: ApplicationStatus | undefined;
    let statusDidChange = false;

    if (existing) {
      previousStatus = existing.status;

      if (shouldUpdateStatus(existing.status, newStatus)) {
        // Advance the pipeline — update the status
        statusDidChange = true;
        application = await prisma.application.update({
          where: { id: existing.id },
          data: { status: newStatus },
        });
      } else {
        // Status would regress or is unchanged — keep current status
        // but still log the sync event for audit trail
        application = existing;
      }
    } else {
      // No match found — create a brand-new application
      isNew = true;
      application = await prisma.application.create({
        data: {
          companyName,
          roleTitle,
          status: newStatus,
          appliedDate: new Date(),
          userId: user.id,
          notes: "Synced from Gmail add-on.",
        },
      });
    }

    // ── Descriptive timeline event ────────────────────────────────
    const timelineParts: string[] = ["📧 Synced from Gmail"];

    if (isNew) {
      timelineParts.push(`New application created with status: ${newStatus}`);
    } else if (statusDidChange && previousStatus) {
      timelineParts.push(
        `Status updated: ${previousStatus} → ${newStatus}`
      );
    } else if (previousStatus) {
      timelineParts.push(
        `Sync received (status unchanged: ${previousStatus})`
      );
    }

    if (actionItems.length > 0) {
      timelineParts.push(`Action items: ${actionItems.join("; ")}`);
    }

    await prisma.timelineEvent.create({
      data: {
        applicationId: application.id,
        content: timelineParts.join("\n"),
      },
    });

    // ── Create tasks from extracted deadlines ─────────────────────
    let createdTaskCount = 0;
    if (tasks.length > 0) {
      for (const task of tasks) {
        await prisma.task.create({
          data: {
            title: task.title,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            isCompleted: false,
            applicationId: application.id,
          },
        });
        createdTaskCount++;
      }

      // Log task creation as a separate timeline event
      await prisma.timelineEvent.create({
        data: {
          applicationId: application.id,
          content: [
            `📋 ${createdTaskCount} task${createdTaskCount > 1 ? "s" : ""} created via Gmail Sync`,
            ...tasks.map(
              (t) =>
                `• ${t.title}${t.dueDate ? " — due " + new Date(t.dueDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : ""}`
            ),
          ].join("\n"),
        },
      });
    }

    // ── 5. Return success card ──────────────────────────────────────
    return Response.json(
      buildSuccessCard(
        extraction.data,
        isNew,
        isNew ? undefined : previousStatus,
        createdTaskCount
      )
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      buildErrorCard("Database Error", `Failed to save: ${msg.slice(0, 250)}`)
    );
  }
}
