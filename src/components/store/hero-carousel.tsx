"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ProductImage } from "./product-image";

interface HeroSlide {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}

const SLIDES: HeroSlide[] = [
  {
    eyebrow: "EveryNest · Pakistan",
    title: "Everyday essentials, picked for you.",
    description:
      "Explore clothes, stationery and shoes with clear prices and real-time availability. Choose your variant and add it to your cart in a tap.",
    image: "/products/canvas-backpack.jpg",
    imageAlt: "Everyday canvas backpack",
    primary: { label: "Shop all products", href: "/products" },
    secondary: { label: "Browse catalogue", href: "/products" },
  },
  {
    eyebrow: "Style for every day",
    title: "Fresh fits, honest prices.",
    description:
      "From classic cotton shirts to everyday sneakers, find pieces that work as hard as you do — with stock you can actually see.",
    image: "/products/classic-cotton-shirt.jpg",
    imageAlt: "Classic cotton shirt",
    primary: { label: "Explore clothing", href: "/products?category=clothes" },
    secondary: { label: "Browse all", href: "/products" },
  },
  {
    eyebrow: "Made for everyday life",
    title: "Great value, delivered nationwide.",
    description:
      "Cash on delivery, transparent prices and a catalogue that is updated as stock moves. No surprises at checkout.",
    image: "/products/everyday-sneakers.jpg",
    imageAlt: "Everyday sneakers",
    primary: { label: "Shop the catalogue", href: "/products" },
    secondary: { label: "View cart", href: "/cart" },
  },
];

const ROTATE_MS = 6500;

/** Auto-rotating two-column hero with manual controls and pause-on-hover. */
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
      className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <div className="grid lg:grid-cols-2">
        {/* Image comes first on mobile, second on desktop. */}
        <div className="group relative order-1 min-h-64 bg-[color:var(--background)] sm:min-h-80 lg:order-2 lg:min-h-[26rem]">
          <ProductImage
            key={`image-${active}`}
            src={slide.image}
            alt={slide.imageAlt}
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>

        <div className="order-2 flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:order-1">
          <p key={`eyebrow-${active}`} className="animate-slide-in flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
            <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-[color:var(--accent)]" />
            {slide.eyebrow}
          </p>
          <h1 key={`title-${active}`} className="animate-slide-in mt-4 font-heading text-[32px] font-semibold leading-[1.2] tracking-tight text-foreground sm:text-[56px]">
            {slide.title}
          </h1>
          <p key={`description-${active}`} className="animate-slide-in mt-5 max-w-[68ch] text-base leading-relaxed text-[color:var(--muted)]">
            {slide.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={slide.primary.href}
              className="inline-flex items-center justify-center rounded-[10px] bg-[color:var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--primary-hover)]"
            >
              {slide.primary.label}
            </Link>
            <Link
              href={slide.secondary.href}
              className="inline-flex items-center justify-center rounded-[10px] border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-[color:var(--background)]"
            >
              {slide.secondary.label}
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2" role="tablist" aria-label="Choose a highlight">
              {SLIDES.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={`Show highlight ${index + 1}: ${item.title}`}
                  onClick={() => goTo(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === active ? "w-8 bg-[color:var(--primary)]" : "w-2 bg-[color:var(--border)] hover:bg-[color:var(--muted)]"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={previous}
                aria-label="Previous highlight"
                className="grid size-9 place-items-center rounded-full border border-[color:var(--border)] text-foreground transition hover:bg-[color:var(--background)]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next highlight"
                className="grid size-9 place-items-center rounded-full border border-[color:var(--border)] text-foreground transition hover:bg-[color:var(--background)]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>

            <span className="text-xs font-medium text-[color:var(--muted)]" aria-hidden="true">
              {paused ? "Paused" : `${active + 1} / ${SLIDES.length}`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
