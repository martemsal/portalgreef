"use client";

import React, { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  type Profile,
  type CampaignRecord,
  type CampaignRecordFormValues,
  type CreateClientFormValues,
  campaignRecordSchema,
  createClientSchema,
  PLATFORMS,
  CAMPAIGN_TYPES,
} from "@/types/database";
import { formatBRL, formatNumber, formatPeriodMonth } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Edit3,
  ExternalLink,
  ImagePlus,
  Loader2,
  LogOut,
  PlusCircle,
  Sparkles,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";

interface AdminDashboardProps {
  adminProfile: Profile;
  initialClients: Profile[];
  initialRecords: CampaignRecord[];
}

export function AdminDashboard({
  adminProfile,
  initialClients,
  initialRecords,
}: AdminDashboardProps) {
  const router = useRouter();
  const supabase = createClient();

  const [clients, setClients] = useState<Profile[]>(initialClients);
  const [records, setRecords] = useState<CampaignRecord[]>(initialRecords);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [filterClientId, setFilterClientId] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  // Estados de feedback
  const [clientSuccessMsg, setClientSuccessMsg] = useState<string | null>(null);
  const [clientErrorMsg, setClientErrorMsg] = useState<string | null>(null);
  const [recordSuccessMsg, setRecordSuccessMsg] = useState<string | null>(null);
  const [recordErrorMsg, setRecordErrorMsg] = useState<string | null>(null);

  // Estado de upload de imagem do criativo (Drag and Drop)
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const launchFormRef = useRef<HTMLDivElement | null>(null);

  // Mês padrão YYYY-MM
  const defaultPeriodMonth = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }, []);

  // =========================================================================
  // 1. FORMULÁRIO DE CADASTRO DE CLIENTES (React Hook Form + Zod)
  // =========================================================================
  const {
    register: registerClient,
    handleSubmit: handleClientSubmit,
    reset: resetClientForm,
    formState: { errors: clientErrors, isSubmitting: isCreatingClient },
  } = useForm<CreateClientFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      client_name: "",
      company_name: "",
      email: "",
      password: "",
    },
  });

  async function onCreateClientSubmit(values: CreateClientFormValues) {
    setClientErrorMsg(null);
    setClientSuccessMsg(null);

    try {
      const response = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await response.json();
      if (!response.ok) {
        setClientErrorMsg(data.error || "Erro ao cadastrar cliente.");
        return;
      }

      const newClient = data.profile as Profile;
      setClients((prev) =>
        [...prev, newClient].sort((a, b) =>
          a.company_name.localeCompare(b.company_name)
        )
      );
      setValue("client_id", newClient.id);
      resetClientForm();
      setClientSuccessMsg(
        `Cliente "${newClient.company_name}" cadastrado com sucesso!`
      );
    } catch {
      setClientErrorMsg("Falha de comunicação com o servidor.");
    }
  }

  // =========================================================================
  // 2. FORMULÁRIO DE LANÇAMENTO DE CAMPANHAS (React Hook Form + Zod)
  // =========================================================================
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CampaignRecordFormValues>({
    resolver: zodResolver(campaignRecordSchema),
    defaultValues: {
      client_id: initialClients[0]?.id ?? "",
      period_month: defaultPeriodMonth,
      platform: "Meta Ads",
      campaign_type: "WhatsApp / Mensagens",
      campaign_name: "",
      amount_invested: 0,
      results_count: 0,
      reach_impressions: null,
      revenue_generated: null,
      roas: null,
      creative_image_url: null,
      observation: "",
    },
  });

  const watchedCampaignType = watch("campaign_type");
  const watchedAmountInvested = Number(watch("amount_invested") || 0);
  const watchedResultsCount = Number(watch("results_count") || 0);
  const watchedReachImpressions = Number(watch("reach_impressions") || 0);
  const watchedRevenueGenerated = Number(watch("revenue_generated") || 0);
  const watchedCreativeUrl = watch("creative_image_url");
  const watchedClientId = watch("client_id");

  // Cálculos Automáticos Dinâmicos conforme o Objetivo da Campanha
  const calculatedMetrics = useMemo(() => {
    const costPerResult =
      watchedResultsCount > 0
        ? watchedAmountInvested / watchedResultsCount
        : 0;

    const roas =
      watchedAmountInvested > 0 && watchedRevenueGenerated > 0
        ? watchedRevenueGenerated / watchedAmountInvested
        : 0;

    // Para Reconhecimento / Alcance, CPM = (Investimento / Impressões ou Resultados) * 1000
    const impressionsBase =
      watchedReachImpressions > 0
        ? watchedReachImpressions
        : watchedResultsCount;
    const cpm =
      impressionsBase > 0 ? (watchedAmountInvested / impressionsBase) * 1000 : 0;

    return { costPerResult, roas, cpm };
  }, [
    watchedAmountInvested,
    watchedResultsCount,
    watchedReachImpressions,
    watchedRevenueGenerated,
  ]);

  // Rótulos dinâmicos dos campos de acordo com o Objetivo da Campanha
  const dynamicFieldLabels = useMemo(() => {
    switch (watchedCampaignType) {
      case "WhatsApp / Mensagens":
        return {
          resultsLabel: "Mensagens / Conversas Iniciadas",
          reachLabel: "Alcance / Impressões (Opcional)",
          autoMetricLabel: "Custo por Conversa (Automático)",
          autoMetricValue: formatBRL(calculatedMetrics.costPerResult),
          showRevenue: false,
        };
      case "Leads / Formulário":
        return {
          resultsLabel: "Leads Coletados (Formulários)",
          reachLabel: "Alcance / Impressões (Opcional)",
          autoMetricLabel: "Custo por Lead - CPL (Automático)",
          autoMetricValue: formatBRL(calculatedMetrics.costPerResult),
          showRevenue: false,
        };
      case "Vendas / E-commerce":
        return {
          resultsLabel: "Vendas Realizadas (Pedidos)",
          reachLabel: "Alcance / Impressões (Opcional)",
          autoMetricLabel: "ROAS Calculado (Faturamento / Invest.)",
          autoMetricValue: `${calculatedMetrics.roas.toFixed(2)}x (${formatBRL(
            calculatedMetrics.costPerResult
          )} / venda)`,
          showRevenue: true,
        };
      case "Reconhecimento / Alcance":
        return {
          resultsLabel: "Alcance Único (Pessoas Impactadas)",
          reachLabel: "Impressões Totais",
          autoMetricLabel: "CPM Estimado (Custo por Mil Impressões)",
          autoMetricValue: formatBRL(calculatedMetrics.cpm),
          showRevenue: false,
        };
      case "Tráfego / Cliques":
      default:
        return {
          resultsLabel: "Cliques no Link / Visitas",
          reachLabel: "Alcance / Impressões (Opcional)",
          autoMetricLabel: "Custo por Clique - CPC (Automático)",
          autoMetricValue: formatBRL(calculatedMetrics.costPerResult),
          showRevenue: false,
        };
    }
  }, [watchedCampaignType, calculatedMetrics]);

  // Upload de imagem do Criativo para o Supabase Storage (bucket `creatives`)
  async function handleCreativeUpload(file: File) {
    if (!watchedClientId) {
      setRecordErrorMsg(
        "Selecione primeiro o cliente antes de enviar a imagem do criativo."
      );
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setRecordErrorMsg("Formato inválido. Envie PNG, JPG ou WebP.");
      return;
    }

    setUploadingImage(true);
    setRecordErrorMsg(null);

    try {
      const sanitizedName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9.\-_]/g, "-");
      const filePath = `${watchedClientId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from("creatives")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        setRecordErrorMsg(
          `Erro ao enviar imagem para o bucket 'creatives': ${uploadError.message}`
        );
        setUploadingImage(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("creatives").getPublicUrl(filePath);

      setValue("creative_image_url", publicUrl, { shouldDirty: true });
    } catch {
      setRecordErrorMsg("Erro inesperado durante o upload da imagem.");
    } finally {
      setUploadingImage(false);
    }
  }

  // Salvar ou Atualizar Lançamento de Campanha
  async function onCampaignSubmit(values: CampaignRecordFormValues) {
    setRecordErrorMsg(null);
    setRecordSuccessMsg(null);

    const computedRoas =
      values.campaign_type === "Vendas / E-commerce" &&
      values.revenue_generated &&
      values.amount_invested > 0
        ? Number((values.revenue_generated / values.amount_invested).toFixed(2))
        : values.roas ?? null;

    const payload = {
      client_id: values.client_id,
      period_month: values.period_month,
      platform: values.platform,
      campaign_type: values.campaign_type,
      campaign_name: values.campaign_name,
      amount_invested: values.amount_invested,
      results_count: values.results_count,
      reach_impressions: values.reach_impressions ?? null,
      revenue_generated: values.revenue_generated ?? null,
      roas: computedRoas,
      creative_image_url: values.creative_image_url || null,
      observation: values.observation?.trim() || null,
    };

    try {
      if (editingRecordId) {
        const { data: updated, error } = await supabase
          .from("campaign_records")
          .update(payload)
          .eq("id", editingRecordId)
          .select("*, profiles(client_name, company_name)")
          .single();

        if (error || !updated) {
          setRecordErrorMsg(error?.message || "Erro ao atualizar lançamento.");
          return;
        }

        setRecords((prev) =>
          prev.map((item) =>
            item.id === editingRecordId ? (updated as CampaignRecord) : item
          )
        );
        setEditingRecordId(null);
        setRecordSuccessMsg("Lançamento atualizado com sucesso!");
      } else {
        const { data: inserted, error } = await supabase
          .from("campaign_records")
          .insert(payload)
          .select("*, profiles(client_name, company_name)")
          .single();

        if (error || !inserted) {
          setRecordErrorMsg(error?.message || "Erro ao salvar lançamento.");
          return;
        }

        setRecords((prev) => [inserted as CampaignRecord, ...prev]);
        setRecordSuccessMsg("Campanha registrada com sucesso!");
      }

      // Mantém cliente e mês selecionados para agilizar múltiplos lançamentos
      reset({
        client_id: values.client_id,
        period_month: values.period_month,
        platform: values.platform,
        campaign_type: values.campaign_type,
        campaign_name: "",
        amount_invested: 0,
        results_count: 0,
        reach_impressions: null,
        revenue_generated: null,
        roas: null,
        creative_image_url: null,
        observation: "",
      });
    } catch {
      setRecordErrorMsg("Erro inesperado ao salvar os dados.");
    }
  }

  function handleQuickSelectClient(clientId: string) {
    setEditingRecordId(null);
    setValue("client_id", clientId);
    setFilterClientId(clientId);
    launchFormRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleEditRecord(record: CampaignRecord) {
    setEditingRecordId(record.id);
    setRecordErrorMsg(null);
    setRecordSuccessMsg(null);
    reset({
      client_id: record.client_id,
      period_month: record.period_month,
      platform: record.platform,
      campaign_type: record.campaign_type,
      campaign_name: record.campaign_name,
      amount_invested: Number(record.amount_invested),
      results_count: Number(record.results_count),
      reach_impressions:
        record.reach_impressions !== null
          ? Number(record.reach_impressions)
          : null,
      revenue_generated:
        record.revenue_generated !== null
          ? Number(record.revenue_generated)
          : null,
      roas: record.roas !== null ? Number(record.roas) : null,
      creative_image_url: record.creative_image_url ?? null,
      observation: record.observation ?? "",
    });
    launchFormRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleDeleteRecord(id: string) {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir este lançamento de campanha?"
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("campaign_records")
      .delete()
      .eq("id", id);

    if (error) {
      alert(`Erro ao excluir registro: ${error.message}`);
      return;
    }

    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (editingRecordId === id) {
      setEditingRecordId(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  // Filtros da tabela de histórico
  const availableMonths = useMemo(() => {
    const set = new Set(records.map((r) => r.period_month));
    return Array.from(set).sort().reverse();
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchClient =
        filterClientId === "all" || rec.client_id === filterClientId;
      const matchMonth =
        filterMonth === "all" || rec.period_month === filterMonth;
      return matchClient && matchMonth;
    });
  }, [records, filterClientId, filterMonth]);

  return (
    <div className="min-h-screen bg-slate-50/80 pb-16">
      {/* BARRA DE NAVEGAÇÃO SUPERIOR */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">
                  Painel do Gestor de Tráfego
                </h1>
                <Badge variant="default" className="text-[11px]">
                  Admin
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Logado como {adminProfile.client_name} ({adminProfile.company_name})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/portal")}
              className="gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver Visão do Cliente (/portal)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 text-slate-600 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 pt-8 sm:px-6 lg:px-8">
        {/* SEÇÃO 1: GESTÃO DE CLIENTES */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Card Cadastro de Novo Cliente */}
          <Card className="lg:col-span-5">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <CardTitle>Cadastrar Novo Cliente</CardTitle>
              </div>
              <CardDescription>
                Cria o acesso no Supabase Auth e vincula automaticamente ao perfil
                isolado por RLS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleClientSubmit(onCreateClientSubmit)}
                className="space-y-3.5"
              >
                {clientErrorMsg && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    {clientErrorMsg}
                  </div>
                )}
                {clientSuccessMsg && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{clientSuccessMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="client_name">Nome do Cliente</Label>
                    <Input
                      id="client_name"
                      placeholder="Ex: Dr. Roberto Silva"
                      {...registerClient("client_name")}
                    />
                    {clientErrors.client_name && (
                      <p className="text-xs text-rose-600">
                        {clientErrors.client_name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="company_name">Empresa</Label>
                    <Input
                      id="company_name"
                      placeholder="Ex: Clínica Vida Plena"
                      {...registerClient("company_name")}
                    />
                    {clientErrors.company_name && (
                      <p className="text-xs text-rose-600">
                        {clientErrors.company_name.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="client_email">E-mail de Acesso</Label>
                    <Input
                      id="client_email"
                      type="email"
                      placeholder="cliente@empresa.com.br"
                      {...registerClient("email")}
                    />
                    {clientErrors.email && (
                      <p className="text-xs text-rose-600">
                        {clientErrors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="client_password">Senha Temporária</Label>
                    <Input
                      id="client_password"
                      type="text"
                      placeholder="Mínimo 6 caracteres"
                      {...registerClient("password")}
                    />
                    {clientErrors.password && (
                      <p className="text-xs text-rose-600">
                        {clientErrors.password.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isCreatingClient}
                  className="w-full gap-2"
                >
                  {isCreatingClient ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando Conta do Cliente...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-4 w-4" />
                      Cadastrar Cliente
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Card Listagem de Clientes Cadastrados */}
          <Card className="lg:col-span-7">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <CardTitle>Carteira de Clientes ({clients.length})</CardTitle>
                </div>
              </div>
              <CardDescription>
                Selecione um cliente para lançar resultados mensais ou abrir o
                relatório executivo dele.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center">
                  <Building2 className="h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-sm font-medium text-slate-700">
                    Nenhum cliente cadastrado ainda
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Utilize o formulário ao lado para criar o primeiro acesso.
                  </p>
                </div>
              ) : (
                <div className="max-h-[270px] overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {clients.map((client) => {
                    const clientRecordsCount = records.filter(
                      (r) => r.client_id === client.id
                    ).length;

                    return (
                      <div
                        key={client.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {client.company_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            Responsável: {client.client_name} •{" "}
                            <span className="text-slate-600 font-medium">
                              {clientRecordsCount} campanha(s)
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              watchedClientId === client.id
                                ? "default"
                                : "secondary"
                            }
                            onClick={() => handleQuickSelectClient(client.id)}
                          >
                            Lançar Dados
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              router.push(`/portal?client_id=${client.id}`)
                            }
                            title="Visualizar Portal deste Cliente"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SEÇÃO 2: FORMULÁRIO DE LANÇAMENTO MANUAL DINÂMICO */}
        <div ref={launchFormRef}>
          <Card className="border-blue-200/80 shadow-md">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60 rounded-t-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <div>
                    <CardTitle className="text-lg">
                      {editingRecordId
                        ? "Editar Lançamento de Campanha"
                        : "Lançamento Manual de Resultados de Tráfego"}
                    </CardTitle>
                    <CardDescription>
                      Os campos e indicadores de eficiência (CPL, Custo por
                      Conversa, ROAS, CPM) se ajustam automaticamente conforme o
                      objetivo.
                    </CardDescription>
                  </div>
                </div>

                {editingRecordId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingRecordId(null);
                      reset({
                        client_id: watchedClientId,
                        period_month: defaultPeriodMonth,
                        platform: "Meta Ads",
                        campaign_type: "WhatsApp / Mensagens",
                        campaign_name: "",
                        amount_invested: 0,
                        results_count: 0,
                        reach_impressions: null,
                        revenue_generated: null,
                        roas: null,
                        creative_image_url: null,
                        observation: "",
                      });
                    }}
                    className="gap-1.5 text-slate-600"
                  >
                    <X className="h-4 w-4" />
                    Cancelar Edição
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <form
                onSubmit={handleSubmit(onCampaignSubmit)}
                className="space-y-6"
              >
                {recordErrorMsg && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {recordErrorMsg}
                  </div>
                )}

                {recordSuccessMsg && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{recordSuccessMsg}</span>
                  </div>
                )}

                {/* Linha 1: Cliente, Mês de Referência, Plataforma e Objetivo */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="client_id">Cliente *</Label>
                    <select
                      id="client_id"
                      {...register("client_id")}
                      className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Selecione um cliente...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name} ({c.client_name})
                        </option>
                      ))}
                    </select>
                    {errors.client_id && (
                      <p className="text-xs text-rose-600">
                        {errors.client_id.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="period_month">Mês de Referência *</Label>
                    <div className="relative">
                      <Calendar className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <Input
                        id="period_month"
                        type="month"
                        className="pl-9"
                        {...register("period_month")}
                      />
                    </div>
                    {errors.period_month && (
                      <p className="text-xs text-rose-600">
                        {errors.period_month.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="platform">Plataforma *</Label>
                    <select
                      id="platform"
                      {...register("platform")}
                      className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="campaign_type">Objetivo da Campanha *</Label>
                    <select
                      id="campaign_type"
                      {...register("campaign_type")}
                      className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {CAMPAIGN_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Linha 2: Nome da Campanha e Métricas Dinâmicas */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
                  <div className="space-y-1.5 lg:col-span-4">
                    <Label htmlFor="campaign_name">Nome da Campanha *</Label>
                    <Input
                      id="campaign_name"
                      placeholder="Ex: [Meta] Captação WhatsApp - Implantes"
                      {...register("campaign_name")}
                    />
                    {errors.campaign_name && (
                      <p className="text-xs text-rose-600">
                        {errors.campaign_name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 lg:col-span-2">
                    <Label htmlFor="amount_invested">Investimento (R$) *</Label>
                    <Input
                      id="amount_invested"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...register("amount_invested")}
                    />
                    {errors.amount_invested && (
                      <p className="text-xs text-rose-600">
                        {errors.amount_invested.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 lg:col-span-2">
                    <Label htmlFor="results_count">
                      {dynamicFieldLabels.resultsLabel} *
                    </Label>
                    <Input
                      id="results_count"
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      {...register("results_count")}
                    />
                    {errors.results_count && (
                      <p className="text-xs text-rose-600">
                        {errors.results_count.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 lg:col-span-2">
                    <Label htmlFor="reach_impressions">
                      {dynamicFieldLabels.reachLabel}
                    </Label>
                    <Input
                      id="reach_impressions"
                      type="number"
                      step="1"
                      min="0"
                      placeholder="Ex: 45200"
                      {...register("reach_impressions")}
                    />
                  </div>

                  {/* Indicador Calculado Automaticamente */}
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label className="text-blue-700 font-semibold">
                      {dynamicFieldLabels.autoMetricLabel}
                    </Label>
                    <div className="flex h-10 items-center rounded-lg border border-blue-200 bg-blue-50/70 px-3 text-sm font-bold text-blue-900">
                      {dynamicFieldLabels.autoMetricValue}
                    </div>
                  </div>
                </div>

                {/* Linha extra condicional para E-commerce / Vendas */}
                {dynamicFieldLabels.showRevenue && (
                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="revenue_generated"
                        className="text-emerald-900"
                      >
                        Faturamento Gerado (R$)
                      </Label>
                      <Input
                        id="revenue_generated"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ex: 18500.00"
                        {...register("revenue_generated")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-emerald-900">
                        ROAS (Retorno sobre Investimento Publicitário)
                      </Label>
                      <div className="flex h-10 items-center rounded-lg border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-700">
                        {calculatedMetrics.roas.toFixed(2)}x (Para cada R$ 1,00
                        investido, voltaram{" "}
                        {formatBRL(calculatedMetrics.roas)})
                      </div>
                    </div>
                  </div>
                )}

                {/* Linha 3: Upload Drag-and-Drop de Criativo + Observação Estratégica do Gestor */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* Upload de Imagem do Criativo */}
                  <div className="space-y-2 lg:col-span-5">
                    <Label>
                      Imagem do Criativo em Destaque (Opcional - Supabase Storage)
                    </Label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleCreativeUpload(file);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`cursor-pointer rounded-xl border-2 border-dashed p-4 transition-all ${
                        isDragging
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-slate-50/50 hover:border-blue-400 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCreativeUpload(file);
                        }}
                      />

                      {uploadingImage ? (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-600">
                          <Loader2 className="h-7 w-7 animate-spin text-blue-600 mb-2" />
                          <span className="text-xs font-medium">
                            Enviando imagem para o bucket creatives...
                          </span>
                        </div>
                      ) : watchedCreativeUrl ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={watchedCreativeUrl}
                              alt="Preview do Criativo"
                              className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                            />
                            <div className="text-xs">
                              <p className="font-semibold text-emerald-700">
                                Criativo anexado com sucesso!
                              </p>
                              <p className="text-slate-500 mt-0.5">
                                Clique para substituir a imagem
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setValue("creative_image_url", null);
                            }}
                          >
                            <X className="h-4 w-4 text-slate-500" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4 text-center">
                          <div className="h-10 w-10 rounded-full bg-blue-100/80 text-blue-600 flex items-center justify-center mb-2">
                            <UploadCloud className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-medium text-slate-700">
                            Arraste e solte o print/banner do anúncio ou{" "}
                            <span className="text-blue-600 underline">
                              clique para selecionar
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            PNG, JPG ou WebP até 10MB (Bucket público: creatives)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Campo Observação do Gestor */}
                  <div className="space-y-2 lg:col-span-7">
                    <Label htmlFor="observation">
                      Observação Estratégica do Gestor (Exibida no Card de Parecer
                      do Cliente)
                    </Label>
                    <textarea
                      id="observation"
                      rows={4}
                      placeholder="Explique em linguagem simples o contexto deste mês: quais criativos performaram melhor, ajustes de público realizados e próximos passos recomendados..."
                      className="flex w-full rounded-xl border border-input bg-white px-3.5 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      {...register("observation")}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting || uploadingImage}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvando Lançamento...
                      </>
                    ) : editingRecordId ? (
                      <>
                        <Edit3 className="h-4 w-4" />
                        Salvar Alterações da Campanha
                      </>
                    ) : (
                      <>
                        <PlusCircle className="h-4 w-4" />
                        Registrar Campanha no Portal
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* SEÇÃO 3: TABELA COM HISTÓRICO DE LANÇAMENTOS */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>
                  Histórico de Lançamentos ({filteredRecords.length})
                </CardTitle>
                <CardDescription>
                  Gerencie, edite ou exclua campanhas lançadas para os clientes.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={filterClientId}
                  onChange={(e) => setFilterClientId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
                >
                  <option value="all">Todos os Clientes</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
                >
                  <option value="all">Todos os Meses</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatPeriodMonth(m)} ({m})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Nenhum lançamento encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">
                      <th className="py-3 px-3">Competência</th>
                      <th className="py-3 px-3">Cliente</th>
                      <th className="py-3 px-3">Plataforma</th>
                      <th className="py-3 px-3">Campanha / Objetivo</th>
                      <th className="py-3 px-3 text-right">Investimento</th>
                      <th className="py-3 px-3 text-right">Resultados</th>
                      <th className="py-3 px-3 text-right">Custo / Result.</th>
                      <th className="py-3 px-3 text-center">Criativo</th>
                      <th className="py-3 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 text-sm">
                    {filteredRecords.map((rec) => {
                      const clientObj = clients.find(
                        (c) => c.id === rec.client_id
                      );
                      const companyLabel =
                        rec.profiles?.company_name ??
                        clientObj?.company_name ??
                        "Cliente";

                      return (
                        <tr
                          key={rec.id}
                          className="hover:bg-slate-50/90 transition-colors"
                        >
                          <td className="py-3.5 px-3 whitespace-nowrap font-medium text-slate-800">
                            {rec.period_month}
                          </td>
                          <td className="py-3.5 px-3 font-medium text-slate-900">
                            {companyLabel}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <Badge
                              variant={
                                rec.platform === "Meta Ads" ? "meta" : "google"
                              }
                            >
                              {rec.platform}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-3">
                            <p className="font-semibold text-slate-900">
                              {rec.campaign_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {rec.campaign_type}
                            </p>
                          </td>
                          <td className="py-3.5 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                            {formatBRL(Number(rec.amount_invested))}
                          </td>
                          <td className="py-3.5 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                            {formatNumber(Number(rec.results_count))}
                          </td>
                          <td className="py-3.5 px-3 text-right font-medium text-blue-700 whitespace-nowrap">
                            {formatBRL(Number(rec.cost_per_result))}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            {rec.creative_image_url ? (
                              <a
                                href={rec.creative_image_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                                title="Abrir imagem do criativo"
                              >
                                <ImagePlus className="h-4 w-4" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditRecord(rec)}
                                title="Editar lançamento"
                              >
                                <Edit3 className="h-4 w-4 text-slate-600" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteRecord(rec.id)}
                                title="Excluir lançamento"
                              >
                                <Trash2 className="h-4 w-4 text-rose-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
