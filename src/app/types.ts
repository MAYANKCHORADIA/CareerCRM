import type { ApplicationStatus } from "@/generated/prisma/enums";

export type TimelineEventCard = {
  id: string;
  content: string;
  createdAt: string;
};

export type ApplicationCard = {
  id: string;
  companyName: string;
  roleTitle: string;
  status: ApplicationStatus;
  appliedDate: string | null;
  notes: string | null;
  createdAt: string;
  timelineEvents: TimelineEventCard[];
};

export type ColumnConfig = {
  status: ApplicationStatus;
  label: string;
  emoji: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
};
