import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ClientPortal } from "@/components/portal/ClientPortal";
import type { CampaignRecord, Profile } from "@/types/database";

export const dynamic = "force-dynamic";

interface PortalPageProps {
  searchParams?: {
    client_id?: string;
  };
}

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!viewerProfile) {
    redirect("/login");
  }

  const isAdmin = viewerProfile.role === "admin";

  // Se for cliente, SEMPRE força o isolamento para o próprio auth.uid()
  let activeClientProfile: Profile = viewerProfile as Profile;
  let allClientsForAdmin: Profile[] = [];

  if (isAdmin) {
    const { data: clientsList } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "client")
      .order("company_name", { ascending: true });

    allClientsForAdmin = (clientsList ?? []) as Profile[];

    const requestedClientId = searchParams?.client_id;
    const matchedClient =
      allClientsForAdmin.find((c) => c.id === requestedClientId) ??
      allClientsForAdmin[0];

    if (matchedClient) {
      activeClientProfile = matchedClient;
    }
  }

  // Busca somente os registros do cliente ativo (protegido também por RLS no banco)
  const { data: recordsData } = await supabase
    .from("campaign_records")
    .select("*")
    .eq("client_id", activeClientProfile.id)
    .order("period_month", { ascending: false })
    .order("amount_invested", { ascending: false });

  return (
    <ClientPortal
      viewerProfile={viewerProfile as Profile}
      clientProfile={activeClientProfile}
      allClientsForAdmin={allClientsForAdmin}
      records={(recordsData ?? []) as CampaignRecord[]}
    />
  );
}
