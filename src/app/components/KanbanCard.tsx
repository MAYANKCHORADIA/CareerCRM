"use client";

import type { ApplicationCard, ColumnConfig } from "../types";

type Props = {
  card: ApplicationCard;
  config: ColumnConfig;
  isDragging: boolean;
  isPending: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function KanbanCard({
  card,
  config,
  isDragging,
  isPending,
  onDragStart,
  onDragEnd,
  onClick,
}: Props) {
  return (
    <div
      id={`card-${card.id}`}
      draggable
      onClick={onClick}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.id);
        // Slight delay so the ghost image renders before opacity change
        requestAnimationFrame(() => onDragStart());
      }}
      onDragEnd={onDragEnd}
      className={`
        group cursor-grab rounded-lg border bg-white p-3.5
        shadow-sm transition-all duration-200
        active:cursor-grabbing
        dark:bg-zinc-800/80
        ${
          isDragging
            ? "scale-95 border-zinc-300 opacity-40 dark:border-zinc-600"
            : "border-zinc-200/80 hover:border-zinc-300 hover:shadow-md dark:border-zinc-700/60 dark:hover:border-zinc-600"
        }
        ${isPending ? "animate-pulse" : ""}
      `}
    >
      {/* Company & Role */}
      <div className="mb-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`
                flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                text-[11px] font-bold tracking-tight
                ${config.badgeBg} ${config.badgeText}
              `}
            >
              {getInitials(card.companyName)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {card.companyName}
              </h3>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {card.roleTitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes preview */}
      {card.notes && (
        <p className="mb-2.5 line-clamp-2 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
          {card.notes}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-2.5 dark:border-zinc-700/40">
        <div className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
            />
          </svg>
          <span>{formatDate(card.appliedDate)}</span>
        </div>
        <div
          className="opacity-0 transition-opacity group-hover:opacity-100"
          title="Drag to move"
        >
          <svg
            className="h-4 w-4 text-zinc-300 dark:text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 9h16.5m-16.5 6.75h16.5"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
