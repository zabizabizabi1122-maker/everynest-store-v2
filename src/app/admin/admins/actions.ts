"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSiteOrigin, requirePermission } from "@/lib/auth";
import { getPublicEnv } from "@/lib/env";
import { formString, toFieldErrors, type FormActionState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validators";
import type { Database } from "@/types/database.types";

/**
 * Admin Management Server Actions.
 *
 * These are the trust boundary for every account change. The visible page and
 * navigation are cosmetic: each action re-checks `admins.manage`, and the
 * database RPCs repeat the same check with a trusted SECURITY DEFINER function.
 * Passwords are never echoed back in form state or written to the database.
 */

const roleSchema = z.enum(["admin", "super_admin"]);
const permissionKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_.]*$/, "Invalid permission.");

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

const adminFormSchema = z
  .object({
    id: z.union([uuidSchema, z.literal("")]),
    email: z.string().trim().email("Enter a valid email address.").max(254),
    fullName: z
      .string()
      .trim()
      .min(2, "Full name is required.")
      .max(80, "Full name must be 80 characters or fewer."),
    phone: z.union([z.literal(""), z.string().trim().max(30, "Phone number is too long.")]),
    role: roleSchema,
    permissions: z.array(permissionKeySchema).max(100),
    isActive: z.boolean(),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const resetPasswordSchema = z
  .object({
    adminId: uuidSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

interface RawAdminForm {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  password: string;
  confirmPassword: string;
}

function readAdminForm(formData: FormData): RawAdminForm {
  return {
    id: formString(formData, "id"),
    email: formString(formData, "email").toLowerCase(),
    fullName: formString(formData, "fullName"),
    phone: formString(formData, "phone"),
    role: formString(formData, "role"),
    permissions: formData
      .getAll("permissions")
      .filter((value): value is string => typeof value === "string"),
    isActive: formData.has("isActive"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  };
}

function adminValues(raw: RawAdminForm): Record<string, string> {
  // Never include password fields here: failed submissions must not repopulate them.
  return {
    id: raw.id,
    email: raw.email,
    fullName: raw.fullName,
    phone: raw.phone,
    role: raw.role,
    permissions: raw.permissions.join(","),
    isActive: String(raw.isActive),
  };
}

function failure(
  raw: RawAdminForm,
  message: string,
  fieldErrors: Record<string, string[]> = {},
): FormActionState {
  return { status: "error", message, fieldErrors, values: adminValues(raw) };
}

function setupFailure(raw: RawAdminForm): FormActionState {
  return failure(
    raw,
    "This action needs the server-only Supabase service-role key. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the app.",
  );
}

function errorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const value = error as { code?: unknown };
  return typeof value.code === "string" ? value.code : "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const value = error as { message?: unknown };
    if (typeof value.message === "string") return value.message;
  }
  return "";
}

function isSetupError(error: unknown): boolean {
  return errorMessage(error).includes("SUPABASE_SERVICE_ROLE_KEY");
}

function isMissingRpcError(error: unknown): boolean {
  return errorCode(error) === "PGRST202" || errorMessage(error).includes("Could not find the function");
}

function logMutationError(label: string, error: unknown) {
  const code = errorCode(error) || "unknown";
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? String((error as { status?: unknown }).status)
      : "-";
  console.error(label, code, status, errorMessage(error));
}

function mutationFailure(raw: RawAdminForm, error: unknown): FormActionState {
  logMutationError("Admin management mutation failed", error);

  if (isMissingRpcError(error)) {
    return failure(
      raw,
      "The Admin Management database setup is missing. Apply the latest Supabase migration and try again.",
    );
  }

  const message = errorMessage(error).toLowerCase();
  if (message.includes("last active super admin")) {
    return failure(raw, "The last active Super Admin cannot be removed, demoted or deactivated.");
  }
  if (message.includes("only a super admin")) {
    return failure(raw, "Only a Super Admin can manage Super Admin accounts.");
  }
  if (message.includes("your own account")) {
    return failure(raw, "You cannot change the role or status of your own account here.");
  }
  if (message.includes("already an administrator")) {
    return failure(raw, "That account is already an administrator.", {
      email: ["This email already belongs to an admin account."],
    });
  }
  if (message.includes("permission") || errorCode(error) === "42501") {
    return failure(raw, "You do not have permission to make this change.");
  }
  if (errorCode(error) === "23503" || message.includes("foreign key")) {
    return failure(raw, "This account has related store records and cannot be deleted.");
  }

  return failure(raw, "We could not save the admin account. Please try again.");
}

function passwordFailure(
  adminId: string,
  error: unknown,
  fieldErrors: Record<string, string[]> = {},
): FormActionState {
  logMutationError("Admin password reset failed", error);

  if (isSetupError(error)) {
    return {
      status: "error",
      message:
        "This action needs the server-only Supabase service-role key. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the app.",
      fieldErrors,
      values: { adminId },
    };
  }

  const message = errorMessage(error).toLowerCase();
  if (message.includes("password should be") || message.includes("weak password")) {
    return {
      status: "error",
      message: null,
      fieldErrors: { ...fieldErrors, password: ["Choose a stronger password."] },
      values: { adminId },
    };
  }

  return {
    status: "error",
    message: "We could not set the password. Please try again.",
    fieldErrors,
    values: { adminId },
  };
}

export async function createAdminAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { access } = await requirePermission("admins.manage", "/admin/admins/new");
  const raw = readAdminForm(formData);
  const parsed = adminFormSchema.safeParse(raw);

  if (!parsed.success) {
    return failure(raw, "Please check the highlighted fields.", toFieldErrors(parsed.error));
  }
  if (parsed.data.role === "super_admin" && !access.isSuperAdmin) {
    return failure(raw, "Only a Super Admin can create another Super Admin.", {
      role: ["Choose Admin. Super Admin accounts can only be created by a Super Admin."],
    });
  }

  // The service-role key is still required so a failed promotion can be rolled
  // back cleanly. Check before creating any Auth user.
  if (!isServiceRoleConfigured()) return setupFailure(raw);

  const data = parsed.data;
  const origin = await getSiteOrigin();
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/verification-success")}&type=verification`;
  let adminClient: ReturnType<typeof createAdminClient> | null = null;
  let createdUserId: string | null = null;

  try {
    adminClient = createAdminClient();

    // A separate publishable-key client creates the unverified user. It has no
    // access to the signed-in admin's cookies, so the current session cannot be
    // replaced by the new account's signup session.
    const { url, publishableKey } = getPublicEnv();
    const signupClient = createSupabaseClient<Database>(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: authError } = await signupClient.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName, phone: data.phone },
        emailRedirectTo,
      },
    });

    if (authError || !created.user) {
      logMutationError("Admin Auth user creation failed", authError ?? new Error("No user returned"));
      const message = errorMessage(authError).toLowerCase();
      if (message.includes("already registered") || message.includes("already exists")) {
        return failure(raw, "An account with that email already exists.", {
          email: ["This email is already registered."],
        });
      }
      if (message.includes("password")) {
        return failure(raw, "Please check the highlighted fields.", {
          password: ["Choose a stronger password."],
        });
      }
      return failure(raw, "We could not create the login account. Please try again.");
    }

    createdUserId = created.user.id;

    // If the project has email confirmation disabled, signUp returns a verified
    // user and sends no email. Mark it unverified and request a confirmation
    // email explicitly so the admin verification workflow still applies.
    if (created.user.email_confirmed_at) {
      const { error: unconfirmError } = await adminClient.auth.admin.updateUserById(createdUserId, {
        email_confirm: false,
      });

      if (unconfirmError) {
        logMutationError("Admin email unconfirm failed", unconfirmError);
      } else {
        const { error: resendError } = await signupClient.auth.resend({
          type: "signup",
          email: data.email,
          options: { emailRedirectTo },
        });
        if (resendError) logMutationError("Admin verification email failed", resendError);
      }
    }
    const supabase = await createClient();
    const { error: rpcError } = await supabase.rpc("claim_admin_account", {
      p_user_id: createdUserId,
      p_full_name: data.fullName,
      p_phone: data.phone === "" ? undefined : data.phone,
      p_role: data.role,
      p_permissions: data.permissions,
    });

    if (rpcError) {
      try {
        await adminClient.auth.admin.deleteUser(createdUserId);
      } catch (cleanupError) {
        logMutationError("Admin creation rollback failed", cleanupError);
      }
      return mutationFailure(raw, rpcError);
    }
  } catch (error) {
    if (createdUserId && adminClient) {
      try {
        await adminClient.auth.admin.deleteUser(createdUserId);
      } catch (cleanupError) {
        logMutationError("Admin creation rollback failed", cleanupError);
      }
    }

    if (isSetupError(error)) return setupFailure(raw);
    return mutationFailure(raw, error);
  }

  revalidatePath("/admin/admins");
  revalidatePath("/admin");
  redirect("/admin/admins?notice=created");
}

export async function updateAdminAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { access } = await requirePermission("admins.manage", "/admin/admins");
  const raw = readAdminForm(formData);
  const parsed = adminFormSchema.safeParse(raw);

  if (!parsed.success) {
    return failure(raw, "Please check the highlighted fields.", toFieldErrors(parsed.error));
  }
  if (!uuidSchema.safeParse(raw.id).success) {
    return failure(raw, "That admin account could not be found.");
  }
  if (parsed.data.role === "super_admin" && !access.isSuperAdmin) {
    return failure(raw, "Only a Super Admin can manage Super Admin accounts.", {
      role: ["Choose Admin for this account."],
    });
  }

  const data = parsed.data;
  const supabase = await createClient();

  try {
    const { error } = await supabase.rpc("update_admin_account", {
      p_admin_id: raw.id,
      p_full_name: data.fullName,
      p_phone: data.phone === "" ? undefined : data.phone,
      p_role: data.role,
      p_permissions: data.permissions,
      p_is_active: data.isActive,
    });

    if (error) return mutationFailure(raw, error);
  } catch (error) {
    return mutationFailure(raw, error);
  }

  revalidatePath("/admin/admins");
  revalidatePath(`/admin/admins/${raw.id}`);
  revalidatePath("/admin");

  return {
    status: "success",
    message: "Admin account saved.",
    fieldErrors: {},
    values: adminValues(raw),
  };
}

export async function setAdminActiveAction(formData: FormData): Promise<void> {
  await requirePermission("admins.manage", "/admin/admins");

  const id = uuidSchema.safeParse(formString(formData, "id"));
  const isActive = formString(formData, "active") === "true";
  if (!id.success) redirect("/admin/admins?status=error");

  const supabase = await createClient();
  let failed = false;

  try {
    const { error } = await supabase.rpc("set_admin_active", {
      p_admin_id: id.data,
      p_is_active: isActive,
    });
    failed = Boolean(error);
    if (error) logMutationError("Admin status change failed", error);
  } catch (error) {
    failed = true;
    logMutationError("Admin status change failed", error);
  }

  revalidatePath("/admin/admins");
  revalidatePath(`/admin/admins/${id.data}`);
  revalidatePath("/admin");
  redirect(`/admin/admins?status=${failed ? "error" : "updated"}`);
}

export async function deleteAdminAction(formData: FormData): Promise<void> {
  await requirePermission("admins.manage", "/admin/admins");

  const id = uuidSchema.safeParse(formString(formData, "id"));
  if (!id.success) redirect("/admin/admins?status=error");

  const supabase = await createClient();
  let failed = false;

  try {
    const { error } = await supabase.rpc("delete_admin_account", { p_admin_id: id.data });
    failed = Boolean(error);
    if (error) logMutationError("Admin delete failed", error);
  } catch (error) {
    failed = true;
    logMutationError("Admin delete failed", error);
  }

  revalidatePath("/admin/admins");
  revalidatePath("/admin");
  redirect(`/admin/admins?status=${failed ? "error" : "deleted"}`);
}

export async function resetAdminPasswordAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const { user } = await requirePermission("admins.manage", "/admin/admins");
  const adminId = formString(formData, "adminId");
  const raw = {
    adminId,
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  };
  const parsed = resetPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
      values: { adminId },
    };
  }

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    if (isSetupError(error)) {
      return {
        status: "error",
        message:
          "This action needs the server-only Supabase service-role key. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the app.",
        fieldErrors: {},
        values: { adminId },
      };
    }
    return passwordFailure(adminId, error);
  }

  try {
    const { error } = await adminClient.auth.admin.updateUserById(parsed.data.adminId, {
      password: parsed.data.password,
    });
    if (error) return passwordFailure(adminId, error);

    // Audit the event without storing the password itself.
    const { error: auditError } = await adminClient.from("audit_log").insert({
      actor_id: user.id,
      action: "admin.password_reset",
      entity: "profiles",
      entity_id: parsed.data.adminId,
      details: { via: "admin-panel" },
    });
    if (auditError) logMutationError("Admin password audit failed", auditError);
  } catch (error) {
    if (isSetupError(error)) {
      return {
        status: "error",
        message:
          "This action needs the server-only Supabase service-role key. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the app.",
        fieldErrors: {},
        values: { adminId },
      };
    }
    return passwordFailure(adminId, error);
  }

  return {
    status: "success",
    message: "Temporary password set. The admin can sign in with it immediately.",
    fieldErrors: {},
    values: { adminId },
  };
}
