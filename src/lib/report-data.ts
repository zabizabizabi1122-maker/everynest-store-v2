import { cache } from "react";

import { reportDataSchema, type ReportDays, type ReportData } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

/**
 * Loads real dashboard/report figures through `public.get_reports_data`.
 *
 * The RPC enforces staff authorization and Asia/Karachi day boundaries. It
 * returns bigint money as decimal strings; the Zod schema below is the final
 * guard before anything reaches a server component.
 */
export const loadReports = cache(async (days: ReportDays): Promise<ReportData> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_reports_data", { p_days: days });

  if (error) {
    console.error("get_reports_data failed", error.code, error.message);
    throw new Error("Could not load reports.");
  }

  const parsed = reportDataSchema.safeParse(data);
  if (!parsed.success) {
    console.error("get_reports_data returned an unexpected payload", parsed.error.issues);
    throw new Error("Could not load reports.");
  }

  return parsed.data;
});
