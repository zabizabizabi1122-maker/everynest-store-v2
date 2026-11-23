import { z } from "zod";

import { uuidSchema } from "@/lib/validators";

/**
 * Parsing helpers for the trusted admin-management RPCs.
 *
 * RPC results are JSON from the database, not trusted TypeScript values. The
 * schemas below keep unexpected shapes out of the UI and give every screen one
 * shared account/permission type.
 */

const adminAccountSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  fullName: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.enum(["admin", "super_admin"]),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  permissions: z.array(z.string()),
});

const adminDetailSchema = adminAccountSchema.extend({
  roleDefaults: z.array(z.string()),
});

const adminPermissionSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  category: z.string(),
});

const adminCatalogSchema = z.object({
  permissions: z.array(adminPermissionSchema),
  roleDefaults: z.array(z.string()),
});

export type AdminAccount = z.infer<typeof adminAccountSchema>;
export type AdminDetail = z.infer<typeof adminDetailSchema>;
export type AdminPermission = z.infer<typeof adminPermissionSchema>;
export type AdminCatalog = z.infer<typeof adminCatalogSchema>;

function parseMany<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function parseAdminAccounts(value: unknown): AdminAccount[] {
  const parsed = z.array(adminAccountSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function parseAdminDetail(value: unknown): AdminDetail | null {
  return parseMany(adminDetailSchema.nullable(), value, null);
}

export function parseAdminCatalog(value: unknown): AdminCatalog {
  return parseMany(
    adminCatalogSchema,
    value,
    { permissions: [], roleDefaults: [] },
  );
}

export function groupPermissions(permissions: readonly AdminPermission[]): { category: string; items: AdminPermission[] }[] {
  const groups = new Map<string, AdminPermission[]>();

  for (const permission of permissions) {
    const category = permission.category || "general";
    const items = groups.get(category) ?? [];
    items.push(permission);
    groups.set(category, items);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, items]) => ({
      category,
      items: items.sort((left, right) => left.label.localeCompare(right.label)),
    }));
}
