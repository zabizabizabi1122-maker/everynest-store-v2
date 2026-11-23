import type { Metadata } from "next";
import { connection } from "next/server";

import { parseAdminCatalog } from "@/lib/admin-management";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { AdminForm } from "../admin-form";

export const metadata: Metadata = {
  title: "New Admin",
};

export const instant = false;

interface NewAdminPageProps {
  searchParams: Promise<{ saved?: string }>;
}

export default async function NewAdminPage({ searchParams }: NewAdminPageProps) {
  await connection();

  const { access } = await requirePermission("admins.manage", "/admin/admins/new");
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_admin_permissions");

  if (error) console.error("Admin permission catalogue failed", error.code, error.message);
  const catalog = parseAdminCatalog(data);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Administration
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">New admin</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Create a login, choose a role and grant only the extra permissions this person needs.
        </p>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          The permission catalogue could not be loaded. Apply the latest database migration, then reload this page.
        </p>
      ) : null}

      <AdminForm
        mode="create"
        isSuperAdminActor={access.isSuperAdmin}
        isSelf={false}
        initial={{
          email: "",
          fullName: "",
          phone: "",
          role: "admin",
          permissions: [],
          isActive: true,
        }}
        catalog={catalog}
        saved={saved === "true"}
      />
    </div>
  );
}
