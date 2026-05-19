"use client";

import { useState, useTransition } from "react";
import type { ApplicationCard, ColumnConfig } from "../types";
import { addTimelineEvent } from "../actions";

type Props = {
  application: ApplicationCard | null;
  config: ColumnConfig | undefined;
  isOpen: boolean;
  onClose: () => void;
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ApplicationModal({
  application,
  config,
  isOpen,
  onClose,
}: Props) {
  const [newNote, setNewNote] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!isOpen || !application) return null;

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    startTransition(async () => {
      await addTimelineEvent(application.id, newNote);
      setNewNote("");
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-sm transition-opacity dark:bg-zinc-950/60"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className={`
          fixed inset-y-0 right-0 z-50 w-full max-w-md
          transform bg-white shadow-2xl transition-transform duration-300
          ease-in-out dark:bg-zinc-900 sm:max-w-lg
        `}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              {config && (
                <span
                  className={`
                    inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                    ${config.badgeBg} ${config.badgeText}
                  `}
                >
                  {config.emoji} {config.label}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {application.roleTitle}
              </h2>
              <p className="mt-1 text-lg text-zinc-600 dark:text-zinc-400">
                {application.companyName}
              </p>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Applied Date
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatDate(application.appliedDate).split(',')[0]}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Created Date
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatDate(application.createdAt).split(',')[0]}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Initial Notes
                </p>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  {application.notes || "No initial notes."}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Timeline & Notes
              </h3>

              {/* Add Note Form */}
              <form onSubmit={handleSubmitNote} className="mb-6">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add an update, interview note, or feedback..."
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
                  rows={3}
                  disabled={isPending}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isPending || !newNote.trim()}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-500 disabled:opacity-50"
                  >
                    {isPending ? "Saving..." : "Add Note"}
                  </button>
                </div>
              </form>

              {/* Event List */}
              <div className="space-y-6">
                {application.timelineEvents.length === 0 ? (
                  <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No timeline events yet.
                  </p>
                ) : (
                  <div className="relative border-l border-zinc-200 pl-4 dark:border-zinc-800">
                    {application.timelineEvents.map((event) => (
                      <div key={event.id} className="mb-6 last:mb-0">
                        <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-zinc-300 dark:border-zinc-900 dark:bg-zinc-600" />
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">
                          {formatDate(event.createdAt)}
                        </p>
                        <div className="mt-1 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200">
                          {event.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
