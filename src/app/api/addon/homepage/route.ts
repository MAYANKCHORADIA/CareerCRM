import { NextResponse } from 'next/server';

export async function POST(request) {
  const cardUI = {
    action: {
      navigations: [
        {
          pushCard: {
            header: {
              title: "CareerCRM Tracker",
              subtitle: "Sync applications from your inbox",
              imageUrl: "https://www.gstatic.com/images/icons/material/system/2x/work_black_24dp.png",
              imageType: "SQUARE" // <-- This is the fix!
            },
            sections: [
              {
                header: "Current Email Status",
                widgets: [
                  {
                    textParagraph: {
                      text: "Click the button below to extract the job details from this email and sync it to your CareerCRM database."
                    }
                  },
                  {
                    buttonList: {
                      buttons: [
                        {
                          text: "Sync Application Update",
                          color: { red: 0, green: 0, blue: 1, alpha: 1 },
                          onClick: {
                            action: {
                              function: process.env.NEXT_PUBLIC_NGROK_URL + "/api/addon/sync",
                              parameters: []
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  };

  return NextResponse.json(cardUI);
}