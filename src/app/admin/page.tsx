import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { CampaignRecord, Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!currentProfile || currentProfile.role !== "admin") {
    redirect("/portal");
  }

  const { data: clientsData } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("company_name", { ascending: true });

  const { data: recordsData } = await supabase
    .from("campaign_records")
    .select("*, profiles(client_name, company_name)")
    .order("period_month", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <AdminDashboard
      adminProfile={currentProfile as Profile}
      initialClients={(clientsData ?? []) as Profile[]}
      initialRecords={(recordsData ?? []) as CampaignRecord[]}
    />
  );
}
