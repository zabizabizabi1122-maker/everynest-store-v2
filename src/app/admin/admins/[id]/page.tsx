import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";

import { secondaryButtonClass } from "@/components/ui/form";
import { parseAdminCatalog, parseAdminDetail } from "@/lib/admin-management";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validators";

import { AdminForm, ResetPasswordForm } from "../admin-form";

export const metadata: Metadata = {
  title: "Admin Details",
};

export const instant = false;

interface AdminDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminDetailPage({ params }: AdminDetailPageProps) {
  await connection();

  const { user, access } = await requirePermission("admins.view", "/admin/admins");
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [accountResult, catalogResult] = await Promise.all([
    supabase.rpc("get_admin_account", { p_admin_id: id }),
    supabase.rpc("list_admin_permissions"),
  ]);

  if (accountResult.error) {
    console.error("Admin detail failed", accountResult.error.code, accountResult.error.message);
    return (
      <div className="mx-auto w-full max-w-5xl">
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          We could not load this admin account. Apply the latest database migration and try again.
        </p>
        <Link href="/admin/admins" className={`${secondaryButtonClass} mt-4`}>
          Back to admins
        </Link>
      </div>
    );
  }

  const detail = parseAdminDetail(accountResult.data);
  if (!detail) notFound();

  const catalog = parseAdminCatalog(catalogResult.data);
  if (catalogResult.error) {
    console.error("Admin permission catalogue failed", catalogResult.error.code, catalogResult.error.message);
  }

  const canManage = access.permissions.includes("admins.manage");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Administration
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {detail.fullName ?? "Admin account"}
        </h1>
        <p className="mt-1.5 break-all text-sm text-neutral-600">
          {detail.email || "No email on file"} · {detail.role === "super_admin" ? "Super Admin" : "Admin"}
        </p>
      </header>

      {catalogResult.error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          The permission catalogue could not be loaded. Existing grants are still shown; apply the latest database migration to edit them.
        </p>
      ) : null}

      <AdminForm
        mode="edit"
        adminId={detail.id}
        isSuperAdminActor={access.isSuperAdmin}
        isSelf={detail.id === user.id}
        readOnly={!canManage}
        initial={{
          email: detail.email,
          fullName: detail.fullName ?? "",
          phone: detail.phone ?? "",
          role: detail.role,
          permissions: detail.permissions,
          isActive: detail.isActive,
        }}
        catalog={catalog}
      />

      {canManage ? (
        <section
          aria-labelledby="admin-password-reset"
          className="mt-8 rounded-2xl border border-[color:var(--border)] bg-white p-6 shadow-sm"
        >
          <div>
            <h2 id="admin-password-reset" className="text-lg font-semibold">
              Password
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Change this admin&apos;s login password without emailing a secret. Share the new password with them securely.
            </p>
          </div>
          <ResetPasswordForm adminId={detail.id} email={detail.email || "this admin"} />
        </section>
      ) : null}
    </div>
  );
}
