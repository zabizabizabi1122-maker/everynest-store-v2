"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import {
  Field,
  FormMessage,
  fieldDescribedBy,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { groupPermissions, type AdminCatalog } from "@/lib/admin-management";
import { initialFormState } from "@/lib/form-state";

import { createAdminAction, resetAdminPasswordAction, updateAdminAction } from "./actions";

interface AdminFormProps {
  mode: "create" | "edit";
  adminId?: string;
  isSuperAdminActor: boolean;
  isSelf: boolean;
  readOnly?: boolean;
  initial: {
    email: string;
    fullName: string;
    phone: string;
    role: "admin" | "super_admin";
    permissions: string[];
    isActive: boolean;
  };
  catalog: AdminCatalog;
  saved?: boolean;
}

const checkboxClass =
  "size-4 rounded border-[color:var(--border)] text-[color:var(--brand)] focus:ring-[color:var(--brand)]";

export function AdminForm({
  mode,
  adminId,
  isSuperAdminActor,
  isSelf,
  readOnly = false,
  initial,
  catalog,
  saved,
}: AdminFormProps) {
  const action = mode === "create" ? createAdminAction : updateAdminAction;
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const [role, setRole] = useState<"admin" | "super_admin">(initial.role);
  const [selected, setSelected] = useState<string[]>(initial.permissions);

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];
  const value = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const checked = (name: string, fallback: boolean) =>
    state.values?.[name] === undefined ? fallback : state.values[name] === "true";
  const effectiveRole = state.values?.role === "admin" || state.values?.role === "super_admin"
    ? state.values.role
    : role;
  const effectiveSelected = state.values?.permissions
    ? state.values.permissions.split(",").filter(Boolean)
    : selected;
  const groups = groupPermissions(catalog.permissions);
  const roleLocked = readOnly || isSelf || !isSuperAdminActor;

  function togglePermission(key: string) {
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-6" noValidate>
      {mode === "edit" ? <input type="hidden" name="id" value={adminId} /> : null}
      {isSelf ? <input type="hidden" name="role" value={initial.role} /> : null}
      {isSelf ? <input type="hidden" name="isActive" value="true" /> : null}

      <FormMessage status={state.status} message={state.message} />

      {readOnly ? (
        <p role="status" className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-warm)] px-4 py-3 text-sm text-neutral-700">
          You have view-only access. A Super Admin or an admin with the manage permission can change this account.
        </p>
      ) : null}

      {saved ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Admin created. Share their sign-in details securely; this page never stores passwords.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="admin-full-name"
          label="Full name"
          hint={mode === "edit" ? "Shown on orders and audit records." : undefined}
          error={errorFor("fullName")}
        >
          <input
            id="admin-full-name"
            name="fullName"
            type="text"
            required
            maxLength={80}
            autoComplete="name"
            disabled={readOnly}
            defaultValue={value("fullName", initial.fullName)}
            aria-invalid={Boolean(errorFor("fullName"))}
            aria-describedby={fieldDescribedBy("admin-full-name", errorFor("fullName"))}
            className={inputClass}
          />
        </Field>

        <Field
          id="admin-email"
          label="Email address"
          hint={mode === "edit" ? "Login emails cannot be changed here." : "Used as the admin's login email."}
          error={errorFor("email")}
        >
          <input
            id="admin-email"
            name="email"
            type="email"
            required
            maxLength={254}
            readOnly={mode === "edit"}
            autoComplete="email"
            defaultValue={value("email", initial.email)}
            aria-invalid={Boolean(errorFor("email"))}
            aria-describedby={fieldDescribedBy("admin-email", errorFor("email"))}
            className={`${inputClass} ${mode === "edit" ? "opacity-70" : ""}`}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="admin-phone" label="Phone (optional)" error={errorFor("phone")}>
          <input
            id="admin-phone"
            name="phone"
            type="tel"
            maxLength={30}
            autoComplete="tel"
            disabled={readOnly}
            defaultValue={value("phone", initial.phone)}
            aria-invalid={Boolean(errorFor("phone"))}
            aria-describedby={fieldDescribedBy("admin-phone", errorFor("phone"))}
            className={inputClass}
          />
        </Field>

        <Field
          id="admin-role"
          label="Role"
          hint={
            isSelf
              ? "You cannot change your own role. Another Super Admin can do this."
              : roleLocked
                ? "Only a Super Admin can grant the Super Admin role."
                : "Super Admin has full access. Admin uses the permissions chosen below."
          }
          error={errorFor("role")}
        >
          <select
            id="admin-role"
            name="role"
            value={effectiveRole}
            disabled={roleLocked}
            onChange={(event) => setRole(event.target.value as "admin" | "super_admin")}
            aria-invalid={Boolean(errorFor("role"))}
            aria-describedby={fieldDescribedBy("admin-role", errorFor("role"))}
            className={inputClass}
          >
            <option value="admin">Admin</option>
            <option value="super_admin" disabled={!isSuperAdminActor}>
              Super Admin
            </option>
          </select>
        </Field>
      </div>

      {mode === "edit" ? (
        <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-800">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={checked("isActive", initial.isActive)}
            disabled={readOnly || isSelf}
            className={checkboxClass}
          />
          Active account
          {isSelf ? <span className="text-xs font-normal text-neutral-500">(you cannot deactivate yourself)</span> : null}
        </label>
      ) : null}

      {mode === "create" ? (
        <section
          aria-labelledby="admin-password"
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-warm)] p-5"
        >
          <h3 id="admin-password" className="text-base font-semibold text-neutral-900">
            Initial password
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            Use at least 8 characters with a letter and a number. change it after signing in.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="admin-password-input" label="Password" error={errorFor("password")}>
              <input
                id="admin-password-input"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                aria-invalid={Boolean(errorFor("password"))}
                aria-describedby={fieldDescribedBy("admin-password-input", errorFor("password"))}
                className={inputClass}
              />
            </Field>
            <Field id="admin-confirm-password" label="Confirm password" error={errorFor("confirmPassword")}>
              <input
                id="admin-confirm-password"
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                aria-invalid={Boolean(errorFor("confirmPassword"))}
                aria-describedby={fieldDescribedBy("admin-confirm-password", errorFor("confirmPassword"))}
                className={inputClass}
              />
            </Field>
          </div>
        </section>
      ) : null}

      {effectiveRole === "admin" ? (
        <section
          aria-labelledby="admin-permissions"
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-warm)] p-5"
        >
          <div>
            <h3 id="admin-permissions" className="text-base font-semibold text-neutral-900">
              Individual permissions
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Role defaults are always included. Extra grants here apply only to this account and are checked on the server.
            </p>
          </div>

          {catalog.permissions.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[color:var(--border)] bg-white px-4 py-5 text-center text-sm text-neutral-500">
              No permission catalogue is available yet. Apply the latest database migration.
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              {groups.map((group) => (
                <div key={group.category}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {group.category.replace(/_/g, " ")}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((permission) => (
                      <label
                        key={permission.key}
                        className="flex gap-2 rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-neutral-700 transition hover:border-[color:var(--brand)]"
                      >
                        <input
                          type="checkbox"
                          name="permissions"
                          value={permission.key}
                          checked={effectiveSelected.includes(permission.key)}
                          onChange={() => togglePermission(permission.key)}
                          disabled={readOnly}
                          className={`mt-0.5 ${checkboxClass}`}
                        />
                        <span>
                          <span className="font-medium">{permission.label}</span>
                          {permission.description ? (
                            <span className="mt-0.5 block text-xs text-neutral-500">{permission.description}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Super Admin has every permission implicitly, so no individual grants are needed.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {readOnly ? null : (
          <button type="submit" className={primaryButtonClass} disabled={isPending}>
            {isPending ? "Saving…" : mode === "create" ? "Create admin" : "Save changes"}
          </button>
        )}
        <Link href="/admin/admins" className={secondaryButtonClass}>
          Back to admins
        </Link>
      </div>
    </form>
  );
}

interface ResetPasswordFormProps {
  adminId: string;
  email: string;
}

export function ResetPasswordForm({ adminId, email }: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(resetAdminPasswordAction, initialFormState);

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      <input type="hidden" name="adminId" value={adminId} />
      <FormMessage status={state.status} message={state.message} />

      <p className="text-sm text-neutral-600">
        Set a new temporary password for <span className="font-medium text-neutral-900">{email}</span>. The previous password stops working immediately.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="reset-password" label="New password" error={state.fieldErrors.password?.[0]}>
          <input
            id="reset-password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={Boolean(state.fieldErrors.password)}
            aria-describedby={fieldDescribedBy("reset-password", state.fieldErrors.password?.[0])}
            className={inputClass}
          />
        </Field>
        <Field id="reset-confirm-password" label="Confirm password" error={state.fieldErrors.confirmPassword?.[0]}>
          <input
            id="reset-confirm-password"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={Boolean(state.fieldErrors.confirmPassword)}
            aria-describedby={fieldDescribedBy("reset-confirm-password", state.fieldErrors.confirmPassword?.[0])}
            className={inputClass}
          />
        </Field>
      </div>

      <button type="submit" className={secondaryButtonClass} disabled={isPending}>
        {isPending ? "Setting password…" : "Set temporary password"}
      </button>
    </form>
  );
}
