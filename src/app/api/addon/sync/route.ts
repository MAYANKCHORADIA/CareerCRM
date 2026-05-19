import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  extractApplicationData,
  type ExtractedApplicationData,
} from "@/lib/extractApplicationData";

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

/** Build a Google Card Service success card. */
function buildSuccessCard(data: ExtractedApplicationData, isNew: boolean) {
  const actionItemWidgets =
    data.actionItems.length > 0
      ? data.actionItems.map((item) => ({
          decoratedText: {
            text: `• ${item}`,
            wrapText: true,
          },
        }))
      : [{ decoratedText: { text: "No action items found.", wrapText: true } }];

  return {
    action: {
      navigations: [
        {
          pushCard: {
            header: {
              title: "Success! Dashboard updated",
              subtitle: isNew ? "New application created" : "Application updated",
            },
            sections: [
              {
                header: "Extracted Data",
                widgets: [
                  {
                    decoratedText: {
                      topLabel: "COMPANY",
                      text: data.companyName,
                      startIcon: { knownIcon: "HOTEL_ROOM_TYPE" },
                    },
                  },
                  {
                    decoratedText: {
                      topLabel: "ROLE",
                      text: data.roleTitle,
                      startIcon: { knownIcon: "BOOKMARK" },
                    },
                  },
                  {
                    decoratedText: {
                      topLabel: "STATUS",
                      text: data.newStatus,
                      startIcon: { knownIcon: "STAR" },
                    },
                  },
                ],
              },
              {
                header: "Action Items",
                widgets: actionItemWidgets,
              },
            ],
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

  const { companyName, roleTitle, newStatus, actionItems } = extraction.data;

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

    // Check if an application already exists for this company + role + user
    const existing = await prisma.application.findFirst({
      where: {
        companyName,
        roleTitle,
        userId: user.id,
      },
    });

    let application;
    let isNew = false;

    if (existing) {
      // Update status on the existing application
      application = await prisma.application.update({
        where: { id: existing.id },
        data: { status: newStatus },
      });
    } else {
      // Create a brand-new application
      isNew = true;
      application = await prisma.application.create({
        data: {
          companyName,
          roleTitle,
          status: newStatus,
          appliedDate: new Date(),
          userId: user.id,
          notes: `Synced from Gmail add-on.`,
        },
      });
    }

    // Create a timeline event capturing what happened
    const timelineContent = [
      `📧 Synced from Gmail`,
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

    // ── 5. Return success card ──────────────────────────────────────
    return Response.json(buildSuccessCard(extraction.data, isNew));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      buildErrorCard("Database Error", `Failed to save: ${msg.slice(0, 250)}`)
    );
  }
}
