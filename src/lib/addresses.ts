import { z } from "zod";

import { initialFormState, type FormActionState } from "@/lib/form-state";
import { pakistaniPhoneSchema, uuidSchema } from "@/lib/validators";

/**
 * Level 11 — saved address contract.
 *
 * Phone numbers are normalized to +92... on the server so the value stored in
 * the database satisfies its immutable check constraint. The customer id is
 * never accepted from the browser; RLS and auth.uid() own that decision.
 */

export const createAddressSchema = z
  .object({
    label: z.string().trim().min(2, "Give this address a short label.").max(50, "Label is too long."),
    fullName: z.string().trim().min(2, "Enter the recipient name.").max(100, "Name is too long."),
    phone: pakistaniPhoneSchema,
    address: z.string().trim().min(10, "Enter the full street address.").max(500, "Address is too long."),
    city: z.string().trim().min(2, "Enter a city.").max(100, "City is too long."),
  })
  .strict();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;

export const addressIdSchema = z.object({ addressId: uuidSchema }).strict();

export interface SavedAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  isDefault: boolean;
}

/** A saved address reduced to checkout prefill values. */
export interface AddressPrefill {
  fullName: string;
  phone: string;
  city: string;
  address: string;
}

export function toAddressPrefill(address: SavedAddress): AddressPrefill {
  return {
    fullName: address.fullName,
    phone: address.phone,
    city: address.city,
    address: address.address,
  };
}

export type AddressActionState = FormActionState;

export const initialAddressState: AddressActionState = {
  ...initialFormState,
};

/** Maps a saved-address RPC error code to a safe form message. */
export function describeAddressError(code: string | null): string {
  switch (code) {
    case "23505":
      return "Only one address can be your default. Choose another address first.";
    case "23514":
      return "Please check the phone number and address details.";
    case "42501":
      return "Please sign in to manage your addresses.";
    case "P0002":
      return "That address could not be found.";
    default:
      return "The address could not be saved right now. Please try again.";
  }
}
