import type { Metadata } from "next";
import { connection } from "next/server";

import { requirePermission } from "@/lib/auth";
import { loadAdminHeroSlides, loadSiteSettings } from "@/lib/site-settings";

import { ContactForm } from "./contact-form";
import { HeroSlidesManager } from "./hero-slides-manager";
import { PromoForm } from "./promo-form";
import { SocialsForm } from "./socials-form";

export const metadata: Metadata = {
  title: "Website settings · EveryNest Admin",
};

export const instant = false;

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await connection();
  await requirePermission("settings.view", "/admin/settings");

  const [{ notice }, settings, hero] = await Promise.all([
    searchParams,
    loadSiteSettings(),
    loadAdminHeroSlides(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Storefront content
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Website settings</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Manage the promo bar, footer contact details, social links and homepage hero slides.
        </p>
        {notice ? (
          <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            That settings request could not be completed. Please try again.
          </p>
        ) : null}
        {settings.error ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {settings.error}
          </p>
        ) : null}
        {hero.error ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {hero.error}
          </p>
        ) : null}
      </header>

      <div className="mt-8 space-y-6">
        <PromoForm
          initial={
            settings.has.promo
              ? {
                  message: settings.promo.message,
                  shippingThresholdPaisa: settings.promo.shippingThresholdPaisa,
                  enabled: settings.promo.enabled,
                }
              : null
          }
        />
        <ContactForm initial={settings.has.contact ? settings.contact : null} />
        <SocialsForm initial={settings.has.socials ? settings.socials : []} />
        <HeroSlidesManager slides={hero.rows} />
      </div>
    </div>
  );
}
