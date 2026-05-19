import { NextRequest } from "next/server";

/**
 * Google Workspace Gmail Add-on — Homepage Trigger (Alternate Runtime)
 *
 * Google sends a POST request to this endpoint when the add-on sidebar opens.
 * We return a RenderActions JSON payload containing a single Card with a
 * "Sync Application Update" button that calls the /api/addon/sync endpoint.
 *
 * @see https://developers.google.com/apps-script/add-ons/alternate-runtimes
 * @see https://developers.google.com/workspace/add-ons/reference/rpc/google.apps.card.v1
 */

// Replace this with your actual ngrok or Vercel deployment URL
const BASE_URL =
  process.env.ADDON_BASE_URL || "https://YOUR_NGROK_OR_VERCEL_URL";

export async function POST(request: NextRequest) {
  // Google sends context about the host app; we can use it later
  // const body = await request.json();

  const cardResponse = {
    action: {
      navigations: [
        {
          pushCard: {
            header: {
              title: "CareerCRM Sync",
              subtitle: "Manage your job applications",
              imageUrl: `${BASE_URL}/icon.png`,
              imageType: "CIRCLE",
            },
            sections: [
              {
                header: "Quick Actions",
                widgets: [
                  {
                    decoratedText: {
                      topLabel: "STATUS",
                      text: "Connected to CareerCRM",
                      startIcon: {
                        knownIcon: "STAR",
                      },
                    },
                  },
                  {
                    decoratedText: {
                      topLabel: "SYNC",
                      text: "Pull application updates from this email thread into your CRM pipeline.",
                      wrapText: true,
                    },
                  },
                  {
                    buttonList: {
                      buttons: [
                        {
                          text: "Sync Application Update",
                          color: {
                            red: 0.44,
                            green: 0.36,
                            blue: 0.86,
                            alpha: 1,
                          },
                          onClick: {
                            action: {
                              function: `${BASE_URL}/api/addon/sync`,
                            },
                          },
                        },
                      ],
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

  return Response.json(cardResponse);
}
