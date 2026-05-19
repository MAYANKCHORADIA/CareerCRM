"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ApplicationStatus } from "@/generated/prisma/enums";

export async function updateApplicationStatus(
  applicationId: string,
  newStatus: ApplicationStatus
) {
  await prisma.application.update({
    where: { id: applicationId },
    data: { status: newStatus },
  });

  revalidatePath("/");
}

export async function addTimelineEvent(applicationId: string, content: string) {
  await prisma.timelineEvent.create({
    data: {
      applicationId,
      content,
    },
  });

  revalidatePath("/");
}
