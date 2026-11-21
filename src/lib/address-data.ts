import { cache } from "react";

import { requireUser } from "@/lib/auth";
import type { SavedAddress } from "@/lib/addresses";
import { createClient } from "@/lib/supabase/server";

const ADDRESS_COLUMNS = "id, label, full_name, phone, address, city, is_default";

type AddressRow = {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  is_default: boolean;
};

function toSavedAddress(row: AddressRow): SavedAddress {
  return {
    id: row.id,
    label: row.label,
    fullName: row.full_name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    isDefault: row.is_default,
  };
}

/** Loads the signed-in customer's saved addresses (RLS scopes the rows). */
export const loadSavedAddresses = cache(async (): Promise<SavedAddress[]> => {
  await requireUser("/account/addresses");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("saved_addresses")
    .select(ADDRESS_COLUMNS)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("saved address list failed", error.code, error.message);
    return [];
  }

  return (data ?? []).map(toSavedAddress);
});

/**
 * Loads the caller's default address for checkout prefill.
 * Returns null when none is saved; the caller is already authenticated.
 */
export const loadDefaultAddress = cache(async (): Promise<SavedAddress | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_addresses")
    .select(ADDRESS_COLUMNS)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    console.error("default address lookup failed", error.code, error.message);
    return null;
  }

  return data ? toSavedAddress(data) : null;
});
