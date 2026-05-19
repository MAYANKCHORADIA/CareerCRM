"use client";

import { useState, useCallback, useTransition } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { ApplicationModal } from "./ApplicationModal";
import { updateApplicationStatus } from "../actions";
import type { ApplicationCard, ColumnConfig } from "../types";
import type { ApplicationStatus } from "@/generated/prisma/enums";

const COLUMNS: ColumnConfig[] = [
  {
    status: "SAVED" as ApplicationStatus,
    label: "Saved",
    emoji: "📌",
    accentColor: "text-slate-400",
    bgColor: "bg-slate-500/5",
    borderColor: "border-slate-500/20",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-600 dark:text-slate-300",
  },
  {
    status: "APPLIED" as ApplicationStatus,
    label: "Applied",
    emoji: "🚀",
    accentColor: "text-blue-400",
    bgColor: "bg-blue-500/5",
    borderColor: "border-blue-500/20",
    badgeBg: "bg-blue-100 dark:bg-blue-900/50",
    badgeText: "text-blue-700 dark:text-blue-300",
  },
  {
    status: "ASSESSMENT" as ApplicationStatus,
    label: "Assessment",
    emoji: "📝",
    accentColor: "text-amber-400",
    bgColor: "bg-amber-500/5",
    borderColor: "border-amber-500/20",
    badgeBg: "bg-amber-100 dark:bg-amber-900/50",
    badgeText: "text-amber-700 dark:text-amber-300",
  },
  {
    status: "INTERVIEW" as ApplicationStatus,
    label: "Interview",
    emoji: "💬",
    accentColor: "text-violet-400",
    bgColor: "bg-violet-500/5",
    borderColor: "border-violet-500/20",
    badgeBg: "bg-violet-100 dark:bg-violet-900/50",
    badgeText: "text-violet-700 dark:text-violet-300",
  },
  {
    status: "OFFER" as ApplicationStatus,
    label: "Offer",
    emoji: "🎉",
    accentColor: "text-emerald-400",
    bgColor: "bg-emerald-500/5",
    borderColor: "border-emerald-500/20",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/50",
    badgeText: "text-emerald-700 dark:text-emerald-300",
  },
  {
    status: "REJECTED" as ApplicationStatus,
    label: "Rejected",
    emoji: "✕",
    accentColor: "text-rose-400",
    bgColor: "bg-rose-500/5",
    borderColor: "border-rose-500/20",
    badgeBg: "bg-rose-100 dark:bg-rose-900/50",
    badgeText: "text-rose-700 dark:text-rose-300",
  },
];

type Props = {
  applications: ApplicationCard[];
};

export function KanbanBoard({ applications: initialApplications }: Props) {
  const [applications, setApplications] =
    useState<ApplicationCard[]>(initialApplications);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDragStart = useCallback((cardId: string) => {
    setDraggedCardId(cardId);
  }, []);

  const handleDragOver = useCallback((status: string) => {
    setDragOverColumn(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (targetStatus: ApplicationStatus) => {
      if (!draggedCardId) return;

      const card = applications.find((app) => app.id === draggedCardId);
      if (!card || card.status === targetStatus) {
        setDraggedCardId(null);
        setDragOverColumn(null);
        return;
      }

      // Optimistic update
      setApplications((prev) =>
        prev.map((app) =>
          app.id === draggedCardId ? { ...app, status: targetStatus } : app
        )
      );
      setDraggedCardId(null);
      setDragOverColumn(null);

      // Persist to database
      startTransition(async () => {
        try {
          await updateApplicationStatus(draggedCardId, targetStatus);
        } catch {
          // Revert on failure
          setApplications((prev) =>
            prev.map((app) =>
              app.id === draggedCardId ? { ...app, status: card.status } : app
            )
          );
        }
      });
    },
    [draggedCardId, applications]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedCardId(null);
    setDragOverColumn(null);
  }, []);

  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  const handleCardClick = useCallback((cardId: string) => {
    setSelectedApplicationId(cardId);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedApplicationId(null);
  }, []);

  const getColumnCards = (status: string) =>
    applications.filter((app) => app.status === status);

  const selectedApplication = applications.find(app => app.id === selectedApplicationId) || null;
  const selectedApplicationConfig = selectedApplication
    ? COLUMNS.find(c => c.status === selectedApplication.status)
    : undefined;

  return (
    <>
      <div className="flex flex-1 gap-4 overflow-x-auto px-6 pb-6 pt-2">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.status}
            config={column}
            cards={getColumnCards(column.status)}
            draggedCardId={draggedCardId}
            isDropTarget={dragOverColumn === column.status}
            isPending={isPending}
            onDragStart={handleDragStart}
            onDragOver={() => handleDragOver(column.status)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(column.status)}
            onDragEnd={handleDragEnd}
            onCardClick={handleCardClick}
          />
        ))}
      </div>

      <ApplicationModal
        application={selectedApplication}
        config={selectedApplicationConfig}
        isOpen={selectedApplicationId !== null}
        onClose={handleCloseModal}
      />
    </>
  );
}
