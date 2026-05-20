import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  extractApplicationData,
  type ExtractedApplicationData,
  type ExtractedTask,
} from "@/lib/extractApplicationData";
import { ApplicationStatus } from "@/generated/prisma/enums";

/**
 * Gmail Add-on Sync — LOCAL TEST BYPASS
 *
 * This endpoint mirrors /api/addon/sync but skips the Gmail API fetch,
 * accepting raw email text (or a fully mocked extraction) directly in the
 * request body.  This lets you test the LLM extraction → Prisma upsert
 * pipeline without a valid Gmail OAuth token.
 *
 * **DO NOT deploy this to production** — it has no authentication.
 *
 * Usage:
 *   POST /api/addon/sync-test
 *
 *   Body option 1 – run Gemini extraction:
 *   { "emailText": "Dear Mayank, ..." }
 *
 *   Body option 2 – skip Gemini too:
 *   {
 *     "emailText": "ignored",
 *     "mockExtraction": {
 *       "companyName": "Google",
 *       "roleTitle": "Software Engineer",
 *       "newStatus": "INTERVIEW",
 *       "actionItems": ["Schedule phone screen"],
 *       "tasks": [{ "title": "Schedule phone screen", "dueDate": "2026-06-05T00:00:00.000Z" }]
 *     }
 *   }
 */

// ─── Only enable in development ──────────────────────────────────────
const IS_DEV = process.env.NODE_ENV !== "production";

// ─── Demo user (same as the real sync endpoint) ──────────────────────
const DEMO_USER_EMAIL = "demo@careercrm.dev";

// ─── Helpers ─────────────────────────────────────────────────────────

function buildErrorCard(title: string, detail: string) {
  return {
    action: {
      navigations: [
        {
          pushCard: {
            header: { title: "Sync Test Failed", subtitle: title },
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

function buildSuccessCard(data: ExtractedApplicationData, isNew: boolean, createdTaskCount?: number) {
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
              : `<b>✅ Successfully updated!</b><br>Your application details have been refreshed.`,
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
              subtitle: "CareerCRM (Test Mode)",
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

// ─── Validation ──────────────────────────────────────────────────────

const VALID_STATUSES = Object.values(ApplicationStatus);

function validateMockExtraction(
  obj: Record<string, unknown>
): ExtractedApplicationData | string {
  if (typeof obj.companyName !== "string" || obj.companyName.trim() === "") {
    return "mockExtraction.companyName must be a non-empty string.";
  }
  if (typeof obj.roleTitle !== "string" || obj.roleTitle.trim() === "") {
    return "mockExtraction.roleTitle must be a non-empty string.";
  }
  if (
    typeof obj.newStatus !== "string" ||
    !VALID_STATUSES.includes(obj.newStatus as ApplicationStatus)
  ) {
    return `mockExtraction.newStatus must be one of: ${VALID_STATUSES.join(", ")}`;
  }
  const actionItems = Array.isArray(obj.actionItems)
    ? obj.actionItems.filter((i): i is string => typeof i === "string")
    : [];

  // Validate optional tasks array
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
          typeof t.dueDate === "string" && t.dueDate.trim() !== ""
            ? new Date(t.dueDate).toISOString()
            : null,
      }))
      .filter((t) => t.title.length > 0);
  }

  return {
    companyName: obj.companyName,
    roleTitle: obj.roleTitle,
    newStatus: obj.newStatus as ApplicationStatus,
    actionItems,
    tasks,
  };
}

// ─── Route Handler ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Block in production
  if (!IS_DEV) {
    return Response.json(
      { error: "This test endpoint is disabled in production." },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      buildErrorCard("Invalid JSON", "Could not parse the request body."),
      { status: 400 }
    );
  }

  // ── Determine extraction source ─────────────────────────────────
  let extraction: ExtractedApplicationData;

  if (body.mockExtraction && typeof body.mockExtraction === "object") {
    // Path B: fully mocked — skip Gemini entirely
    const result = validateMockExtraction(body.mockExtraction);
    if (typeof result === "string") {
      return Response.json(buildErrorCard("Invalid mockExtraction", result));
    }
    extraction = result;
  } else {
    // Path A: send emailText through Gemini
    const emailText = body.emailText;
    if (!emailText || typeof emailText !== "string" || emailText.trim() === "") {
      return Response.json(
        buildErrorCard(
          "Missing emailText",
          'Provide "emailText" (string) in the request body, or provide a full "mockExtraction" object.'
        )
      );
    }

    const llmResult = await extractApplicationData(emailText);
    if (!llmResult.success) {
      return Response.json(buildErrorCard("LLM Parsing Failed", llmResult.error));
    }
    extraction = llmResult.data;
  }

  // ── Upsert into Postgres ────────────────────────────────────────
  const { companyName, roleTitle, newStatus, actionItems, tasks } = extraction;

  try {
    let user = await prisma.user.findUnique({
      where: { email: DEMO_USER_EMAIL },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: DEMO_USER_EMAIL, name: "Test User" },
      });
    }

    const existing = await prisma.application.findFirst({
      where: { companyName, roleTitle, userId: user.id },
    });

    let application;
    let isNew = false;

    if (existing) {
      application = await prisma.application.update({
        where: { id: existing.id },
        data: { status: newStatus },
      });
    } else {
      isNew = true;
      application = await prisma.application.create({
        data: {
          companyName,
          roleTitle,
          status: newStatus,
          appliedDate: new Date(),
          userId: user.id,
          notes: "Synced via sync-test bypass endpoint.",
        },
      });
    }

    const timelineContent = [
      "🧪 Synced via test bypass endpoint",
      `Status: ${newStatus}`,
      ...(actionItems.length > 0
        ? [`Action items: ${actionItems.join("; ")}`]
        : []),
    ].join("\n");

    await prisma.timelineEvent.create({
      data: {
        applicationId: application.id,
        content: timelineContent,
      },
    });

    // Create tasks from extracted deadlines
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
    }

    return Response.json(buildSuccessCard(extraction, isNew, createdTaskCount));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      buildErrorCard("Database Error", `Failed to save: ${msg.slice(0, 250)}`)
    );
  }
}
