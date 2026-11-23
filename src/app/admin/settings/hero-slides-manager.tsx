"use client";

import { useState } from "react";

import { secondaryButtonClass } from "@/components/ui/form";
import type { HeroSlideRow } from "@/lib/site-settings";

import { deleteHeroSlideAction, reorderHeroSlideAction, toggleHeroSlideAction } from "./actions";
import { HeroSlideForm } from "./hero-slide-form";
import { PendingSubmitButton } from "./submit-button";

const smallButtonClass =
  "grid size-8 place-items-center rounded-lg border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)] disabled:cursor-not-allowed disabled:opacity-40";

export function HeroSlidesManager({ slides }: { slides: HeroSlideRow[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">Hero slides</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Active slides appear on the homepage in display order.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          className={secondaryButtonClass}
        >
          {showCreate ? "Hide add form" : "Add slide"}
        </button>
      </div>

      {showCreate ? (
        <div className="border-b border-neutral-200 p-5">
          <HeroSlideForm mode="create" />
        </div>
      ) : null}

      {slides.length === 0 ? (
        <p className="p-6 text-sm text-neutral-600">
          No hero slides saved yet. The homepage is using its built-in slides.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {slides.map((slide, index) => (
            <li key={slide.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{slide.title}</span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        slide.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {slide.is_active ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Order {slide.display_order} · {slide.primary_label} · {slide.image}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={reorderHeroSlideAction}>
                    <input type="hidden" name="id" value={slide.id} />
                    <input type="hidden" name="direction" value="up" />
                    <PendingSubmitButton
                      className={smallButtonClass}
                      pendingLabel="…"
                      disabled={index === 0}
                      ariaLabel={`Move ${slide.title} up`}
                    >
                      ↑
                    </PendingSubmitButton>
                  </form>

                  <form action={reorderHeroSlideAction}>
                    <input type="hidden" name="id" value={slide.id} />
                    <input type="hidden" name="direction" value="down" />
                    <PendingSubmitButton
                      className={smallButtonClass}
                      pendingLabel="…"
                      disabled={index === slides.length - 1}
                      ariaLabel={`Move ${slide.title} down`}
                    >
                      ↓
                    </PendingSubmitButton>
                  </form>

                  <form action={toggleHeroSlideAction}>
                    <input type="hidden" name="id" value={slide.id} />
                    <input type="hidden" name="active" value={slide.is_active ? "false" : "true"} />
                    <PendingSubmitButton
                      variant="link"
                      pendingLabel="Saving…"
                      ariaLabel={slide.is_active ? `Hide ${slide.title}` : `Activate ${slide.title}`}
                    >
                      {slide.is_active ? "Hide" : "Activate"}
                    </PendingSubmitButton>
                  </form>

                  <button
                    type="button"
                    onClick={() => setEditingId((current) => (current === slide.id ? null : slide.id))}
                    className="text-sm font-medium text-[color:var(--brand)] transition hover:underline"
                  >
                    {editingId === slide.id ? "Close editor" : "Edit"}
                  </button>

                  <form action={deleteHeroSlideAction}>
                    <input type="hidden" name="id" value={slide.id} />
                    <PendingSubmitButton
                      variant="link"
                      className="text-sm font-medium text-red-600 transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      pendingLabel="Deleting…"
                      ariaLabel={`Delete ${slide.title}`}
                    >
                      Delete
                    </PendingSubmitButton>
                  </form>
                </div>
              </div>

              {editingId === slide.id ? (
                <HeroSlideForm mode="edit" slide={slide} onCancel={() => setEditingId(null)} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
