"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ProductImage } from "./product-image";

export interface HeroSlide {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}

export const defaultHeroSlides: HeroSlide[] = [
  {
    eyebrow: "EveryNest · Pakistan",
    title: "Everyday essentials, picked for you.",
    description:
      "Explore clothes, stationery and shoes with clear prices and real-time availability. Choose your variant and add it to your cart in a tap.",
    image: "/products/canvas-backpack.jpg",
    imageAlt: "Everyday canvas backpack",
    primary: { label: "Shop all products", href: "/products" },
    secondary: { label: "View new arrivals", href: "/products?sort=newest" },
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
export function HeroCarousel({ slides = defaultHeroSlides }: { slides?: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((index: number) => {
    setActive((index + slides.length) % slides.length);
  }, [slides.length]);

  const previous = useCallback(() => goTo(active - 1), [active, goTo]);
  const next = useCallback(() => goTo(active + 1), [active, goTo]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const slide = slides[active] ?? defaultHeroSlides[0];

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
        <div className="group relative order-1 min-h-64 overflow-hidden bg-[color:var(--background)] sm:min-h-80 lg:order-2 lg:min-h-[26rem]">
          <div
            aria-hidden="true"
            className="animate-hero-glow pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(217,115,63,0.18), transparent 60%)",
            }}
          />
          <div key={`image-${active}`} className="animate-hero-image absolute inset-0">
            <ProductImage
              src={slide.image}
              alt={slide.imageAlt}
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>
        </div>

        <div className="order-2 flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:order-1">
          <p
            key={`eyebrow-${active}`}
            style={{ animationDelay: "0ms" }}
            className="animate-slide-in flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]"
          >
            <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-[color:var(--accent)]" />
            {slide.eyebrow}
          </p>
          <h1
            key={`title-${active}`}
            style={{ animationDelay: "60ms" }}
            className="animate-slide-in mt-4 font-heading text-[32px] font-semibold leading-[1.2] tracking-tight text-foreground sm:text-[56px]"
          >
            {slide.title}
          </h1>
          <p
            key={`description-${active}`}
            style={{ animationDelay: "120ms" }}
            className="animate-slide-in mt-5 max-w-[68ch] text-base leading-relaxed text-[color:var(--muted)]"
          >
            {slide.description}
          </p>
          <div
            key={`actions-${active}`}
            style={{ animationDelay: "180ms" }}
            className="animate-slide-in mt-8 flex flex-wrap gap-3"
          >
            <Link
              href={slide.primary.href}
              className="hero-cta-primary inline-flex items-center justify-center gap-2 rounded-[10px] bg-[color:var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[color:var(--primary-hover)] hover:shadow-lg active:scale-[0.98] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
            >
              {slide.primary.label}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
                <path d="M5 12h13M12 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              href={slide.secondary.href}
              className="inline-flex items-center justify-center rounded-[10px] border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-foreground transition hover:border-[color:var(--primary)]/40 hover:bg-[color:var(--surface-warm)] hover:text-[color:var(--primary)] active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
            >
              {slide.secondary.label}
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2" role="tablist" aria-label="Choose a highlight">
              {slides.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={`Show highlight ${index + 1}: ${item.title}`}
                  onClick={() => goTo(index)}
                  className={`h-2 rounded-full transition-all duration-300 active:scale-110 motion-reduce:active:scale-100 ${
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
                className="grid size-9 place-items-center rounded-full border border-[color:var(--border)] text-foreground transition hover:bg-[color:var(--background)] active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next highlight"
                className="grid size-9 place-items-center rounded-full border border-[color:var(--border)] text-foreground transition hover:bg-[color:var(--background)] active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>

            <span className="text-xs font-medium text-[color:var(--muted)]" aria-hidden="true">
              {paused ? "Paused" : `${active + 1} / ${slides.length}`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
