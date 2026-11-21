"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface HeroSlide {
  eyebrow: string;
  title: string;
  description: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}

const SLIDES: HeroSlide[] = [
  {
    eyebrow: "EveryNest · Pakistan",
    title: "Everyday essentials, picked for you.",
    description:
      "Explore clothes, stationery and shoes with clear prices and real-time availability. Choose your variant and add it to your cart in a tap.",
    primary: { label: "Shop all products", href: "/products" },
    secondary: { label: "Create an account", href: "/signup" },
  },
  {
    eyebrow: "Style for every day",
    title: "Fresh fits, honest prices.",
    description:
      "From classic cotton shirts to everyday sneakers, find pieces that work as hard as you do — with stock you can actually see.",
    primary: { label: "Explore clothing", href: "/products?sort=newest" },
    secondary: { label: "Browse all", href: "/products" },
  },
  {
    eyebrow: "Made for everyday life",
    title: "Great value, delivered nationwide.",
    description:
      "Cash on delivery, transparent prices and a catalogue that is updated as stock moves. No surprises at checkout.",
    primary: { label: "Shop the catalogue", href: "/products" },
    secondary: { label: "My account", href: "/account" },
  },
];

const ROTATE_MS = 6500;

/** Auto-rotating storefront hero with manual controls and pause-on-hover. */
export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((index: number) => {
    setActive((index + SLIDES.length) % SLIDES.length);
  }, []);

  const previous = useCallback(() => goTo(active - 1), [active, goTo]);
  const next = useCallback(() => goTo(active + 1), [active, goTo]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % SLIDES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  const slide = SLIDES[active];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="EveryNest highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[color:var(--brand)] to-neutral-900 px-6 py-14 text-white sm:px-12 sm:py-20"
    >
      <div aria-hidden="true" className="absolute -right-16 -top-24 size-72 rounded-full border-[3rem] border-white/10" />
      <div aria-hidden="true" className="absolute -bottom-24 right-24 size-52 rounded-full bg-white/5" />
      <div aria-hidden="true" className="absolute -left-20 bottom-8 size-40 rounded-full border-[2rem] border-white/5" />

      <div className="relative max-w-2xl">
        <p key={`eyebrow-${active}`} className="animate-slide-in text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
          {slide.eyebrow}
        </p>
        <h1 key={`title-${active}`} className="animate-slide-in mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {slide.title}
        </h1>
        <p key={`description-${active}`} className="animate-slide-in mt-5 max-w-xl text-base leading-7 text-white/85">
          {slide.description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={slide.primary.href}
            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {slide.primary.label}
          </Link>
          <Link
            href={slide.secondary.href}
            className="inline-flex items-center justify-center rounded-xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {slide.secondary.label}
          </Link>
        </div>
      </div>

      <div className="relative mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2" role="tablist" aria-label="Choose a highlight">
          {SLIDES.map((item, index) => (
            <button
              key={item.title}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`Show highlight ${index + 1}: ${item.title}`}
              onClick={() => goTo(index)}
              className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                index === active ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={previous}
            aria-label="Previous highlight"
            className="grid size-9 place-items-center rounded-full border border-white/30 text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next highlight"
            className="grid size-9 place-items-center rounded-full border border-white/30 text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <span className="text-xs font-medium text-white/60" aria-hidden="true">
          {paused ? "Paused" : `${active + 1} / ${SLIDES.length}`}
        </span>
      </div>
    </section>
  );
}
