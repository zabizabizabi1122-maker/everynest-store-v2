import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { PendingSubmitButton } from "@/app/admin/settings/submit-button";
import { parseAdminAccounts } from "@/lib/admin-management";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

import { deleteAdminAction, setAdminActiveAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin Management",
};

export const instant = false;

interface AdminsPageProps {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    notice?: string;
  }>;
}

const noticeMessages: Record<string, string> = {
  created: "Admin account created. A verification email has been sent.",
  updated: "Admin account updated.",
  deleted: "Admin account deleted.",
  error: "That change could not be completed. Please check the details and try again.",
};

export default async function AdminsPage({ searchParams }: AdminsPageProps) {
  await connection();

  const { user, access } = await requirePermission("admins.view", "/admin/admins");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const role = params.role === "admin" || params.role === "super_admin" ? params.role : "";
  const status = params.status === "active" || params.status === "inactive" ? params.status : "";
  const notice = params.notice ? noticeMessages[params.notice] : undefined;
  const canManage = access.permissions.includes("admins.manage");

  const supabase = await createClient();
  const [accountsResult, superAdminsResult] = await Promise.all([
    supabase.rpc("list_admin_accounts", {
      p_search: query === "" ? undefined : query,
      p_role: role === "" ? undefined : role,
      p_status: status === "" ? undefined : status,
    }),
    supabase.rpc("list_admin_accounts", {
      p_role: "super_admin",
      p_status: "active",
    }),
  ]);

  const accounts = parseAdminAccounts(accountsResult.data);
  const activeSuperAdmins = parseAdminAccounts(superAdminsResult.data);
  const loadError = Boolean(accountsResult.error || superAdminsResult.error);
  if (accountsResult.error) console.error("Admin list failed", accountsResult.error.code, accountsResult.error.message);
  if (superAdminsResult.error) console.error("Super Admin count failed", superAdminsResult.error.code, superAdminsResult.error.message);

  const hasFilters = query !== "" || role !== "" || status !== "";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Administration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Admin Management</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Create administrator accounts, control their status and grant only the permissions they need.
          </p>
        </div>
        {canManage ? (
          <Link href="/admin/admins/new" className={primaryButtonClass}>
            + New admin
          </Link>
        ) : null}
      </header>

      {notice ? (
        <p
          role={params.notice === "error" ? "alert" : "status"}
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            params.notice === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {notice}
        </p>
      ) : null}

      {canManage && !isServiceRoleConfigured() ? (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <strong className="font-semibold">Setup note:</strong> creating admins and setting passwords needs the server-only
          <code className="mx-1 font-mono">SUPABASE_SERVICE_ROLE_KEY</code>
          in <code className="font-mono">.env.local</code> and Vercel. List, edit, status changes and deletion work with the signed-in session.
        </p>
      ) : null}

      {loadError ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          We could not load the admin directory. Apply the latest database migration and try again.
        </p>
      ) : null}

      <form method="get" className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-warm)] p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Name, email or phone"
              className="mt-1.5 block w-full rounded-[10px] border border-[color:var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">Role</span>
            <select
              name="role"
              defaultValue={role}
              className="mt-1.5 block w-full rounded-[10px] border border-[color:var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20 sm:w-40"
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</span>
            <select
              name="status"
              defaultValue={status}
              className="mt-1.5 block w-full rounded-[10px] border border-[color:var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20 sm:w-36"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <button type="submit" className={secondaryButtonClass}>
            Apply filters
          </button>
        </div>
        {hasFilters ? (
          <p className="mt-3 text-xs text-neutral-500">
            <Link href="/admin/admins" className="font-semibold text-[color:var(--brand)] hover:underline">
              Clear filters
            </Link>
          </p>
        ) : null}
      </form>

      <section aria-label="Admin accounts" className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-white shadow-sm">
        {accounts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-neutral-900">No admin accounts found</p>
            <p className="mt-1 text-sm text-neutral-600">
              Change the filters or create a new administrator.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[color:var(--background)] text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Admin</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Role</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Extra permissions</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Created</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]/70">
                {accounts.map((account) => {
                  const isSelf = account.id === user.id;
                  const isLastActiveSuperAdmin =
                    account.role === "super_admin" &&
                    account.isActive &&
                    activeSuperAdmins.length === 1 &&
                    activeSuperAdmins[0]?.id === account.id;
                  const statusLocked = isSelf || isLastActiveSuperAdmin;

                  return (
                    <tr key={account.id} className="transition hover:bg-[color:var(--background)]">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-neutral-900">
                          {account.fullName ?? "Unnamed admin"}
                          {isSelf ? <span className="ml-2 text-xs font-normal text-neutral-500">(you)</span> : null}
                        </p>
                        <p className="mt-0.5 break-all text-xs text-neutral-500">{account.email || "No email on file"}</p>
                        {account.phone ? <p className="mt-0.5 text-xs text-neutral-500">{account.phone}</p> : null}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            account.role === "super_admin"
                              ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                              : "bg-white text-neutral-700 ring-1 ring-[color:var(--border)]"
                          }`}
                        >
                          {account.role === "super_admin" ? "Super Admin" : "Admin"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            account.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {account.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-neutral-600">
                        {account.role === "super_admin"
                          ? "Full implicit access"
                          : account.permissions.length === 0
                            ? "Role defaults only"
                            : `${account.permissions.length} individual grant${account.permissions.length === 1 ? "" : "s"}`}
                      </td>
                      <td className="px-5 py-4 text-xs text-neutral-500">
                        {new Date(account.createdAt).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <Link
                            href={`/admin/admins/${account.id}`}
                            className="text-sm font-medium text-[color:var(--brand)] transition hover:underline"
                          >
                            {canManage ? "Edit" : "View"}
                          </Link>

                          {canManage && !statusLocked ? (
                            <form action={setAdminActiveAction}>
                              <input type="hidden" name="id" value={account.id} />
                              <input type="hidden" name="active" value={account.isActive ? "false" : "true"} />
                              <PendingSubmitButton
                                variant="link"
                                pendingLabel="Updating…"
                                className="text-sm font-medium text-neutral-700 transition hover:text-[color:var(--brand)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {account.isActive ? "Deactivate" : "Activate"}
                              </PendingSubmitButton>
                            </form>
                          ) : null}

                          {canManage && !statusLocked ? (
                            <form action={deleteAdminAction}>
                              <input type="hidden" name="id" value={account.id} />
                              <ConfirmDeleteButton
                                label="Delete"
                                confirmText={`Permanently delete ${account.fullName ?? account.email ?? "this admin"}? This cannot be undone.`}
                              />
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
