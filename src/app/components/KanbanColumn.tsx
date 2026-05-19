"use client";

import { KanbanCard } from "./KanbanCard";
import type { ApplicationCard, ColumnConfig } from "../types";

type Props = {
  config: ColumnConfig;
  cards: ApplicationCard[];
  draggedCardId: string | null;
  isDropTarget: boolean;
  isPending: boolean;
  onDragStart: (cardId: string) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onCardClick: (cardId: string) => void;
};

export function KanbanColumn({
  config,
  cards,
  draggedCardId,
  isDropTarget,
  isPending,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onCardClick,
}: Props) {
  return (
    <div
      id={`column-${config.status}`}
      className={`
        flex min-w-[280px] max-w-[320px] flex-1 flex-col rounded-xl
        border transition-all duration-200
        ${
          isDropTarget
            ? `${config.borderColor} ${config.bgColor} scale-[1.01] shadow-lg ring-2 ring-offset-2 ring-offset-zinc-950 ${config.borderColor.replace("border-", "ring-")}`
            : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
        }
      `}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDragLeave={(e) => {
        // Only trigger if leaving the column entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onDragLeave();
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{config.emoji}</span>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {config.label}
          </h2>
        </div>
        <span
          className={`
            inline-flex h-6 min-w-6 items-center justify-center rounded-full
            px-2 text-xs font-semibold tabular-nums
            ${config.badgeBg} ${config.badgeText}
          `}
        >
          {cards.length}
        </span>
      </div>

      {/* Accent bar */}
      <div className={`mx-4 h-0.5 rounded-full ${config.bgColor}`} />

      {/* Cards area */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 scrollbar-thin">
        {cards.length === 0 ? (
          <div
            className={`
              flex flex-col items-center justify-center rounded-lg border-2
              border-dashed py-10 text-center transition-colors duration-200
              ${
                isDropTarget
                  ? `${config.borderColor} ${config.bgColor}`
                  : "border-zinc-200 dark:border-zinc-700/50"
              }
            `}
          >
            <span className="text-2xl opacity-40">{config.emoji}</span>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              Drop applications here
            </p>
          </div>
        ) : (
          cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              config={config}
              isDragging={draggedCardId === card.id}
              isPending={isPending && draggedCardId === card.id}
              onDragStart={() => onDragStart(card.id)}
              onDragEnd={onDragEnd}
              onClick={() => onCardClick(card.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
