"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CampaignRecord, Profile } from "@/types/database";
import {
  formatBRL,
  formatNumber,
  formatPeriodMonth,
  calculateDeltaPercent,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Eye,
  GitCompare,
  Layers,
  LogOut,
  MessageSquareQuote,
  MessageCircle,
  Printer,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
  ZoomIn,
} from "lucide-react";

interface ClientPortalProps {
  viewerProfile: Profile;
  clientProfile: Profile;
  allClientsForAdmin: Profile[];
  records: CampaignRecord[];
}

const CONVERSION_TYPES = [
  "WhatsApp / Mensagens",
  "Leads / Formulário",
  "Vendas / E-commerce",
];

const PLATFORM_COLORS: Record<string, string> = {
  "Meta Ads": "#2563eb", // Azul executivo
  "Google Ads": "#f59e0b", // Âmbar/Dourado Google
};

export function ClientPortal({
  viewerProfile,
  clientProfile,
  allClientsForAdmin,
  records,
}: ClientPortalProps) {
  const router = useRouter();
  const supabase = createClient();
  const isAdmin = viewerProfile.role === "admin";

  // Lista de meses disponíveis para o cliente
  const availableMonths = useMemo(() => {
    const unique = Array.from(new Set(records.map((r) => r.period_month)))
      .sort()
      .reverse();
    if (unique.length === 0) {
      const now = new Date();
      return [
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      ];
    }
    return unique;
  }, [records]);

  const [viewMode, setViewMode] = useState<"single" | "compare">("single");
  const [primaryMonth, setPrimaryMonth] = useState<string>(
    availableMonths[0] ?? "2026-11"
  );
  const [compareMonth, setCompareMonth] = useState<string>(
    availableMonths[1] ?? availableMonths[0] ?? "2026-10"
  );

  // Estado do Modal de Zoom de Criativo
  const [zoomedCreative, setZoomedCreative] = useState<CampaignRecord | null>(
    null
  );

  // Filtra registros do mês principal e do mês de comparação
  const primaryRecords = useMemo(
    () => records.filter((r) => r.period_month === primaryMonth),
    [records, primaryMonth]
  );

  const compareRecords = useMemo(
    () => records.filter((r) => r.period_month === compareMonth),
    [records, compareMonth]
  );

  // Função agregadora de KPIs para um conjunto de campanhas
  function aggregateKPIs(list: CampaignRecord[]) {
    let totalInvested = 0;
    let totalConversions = 0;
    let conversionInvestment = 0;
    let totalReach = 0;
    let totalRevenue = 0;

    for (const item of list) {
      const invested = Number(item.amount_invested || 0);
      const results = Number(item.results_count || 0);
      const reach = Number(item.reach_impressions || 0);
      const revenue = Number(item.revenue_generated || 0);

      totalInvested += invested;
      totalRevenue += revenue;

      // Soma conversões diretas (WhatsApp + Leads + Vendas)
      if (CONVERSION_TYPES.includes(item.campaign_type)) {
        totalConversions += results;
        conversionInvestment += invested;
      }

      // Alcance total (se reach_impressions preenchido usa ele; em campanha de Alcance soma também results_count se necessário)
      if (reach > 0) {
        totalReach += reach;
      } else if (item.campaign_type === "Reconhecimento / Alcance") {
        totalReach += results;
      }
    }

    const avgCostPerConversion =
      totalConversions > 0 ? conversionInvestment / totalConversions : 0;

    return {
      totalInvested,
      totalConversions,
      avgCostPerConversion,
      totalReach,
      totalRevenue,
    };
  }

  const currentKPIs = useMemo(
    () => aggregateKPIs(primaryRecords),
    [primaryRecords]
  );
  const previousKPIs = useMemo(
    () => aggregateKPIs(compareRecords),
    [compareRecords]
  );

  // Variações percentuais para o modo Comparar Meses
  const deltas = useMemo(() => {
    return {
      invested: calculateDeltaPercent(
        currentKPIs.totalInvested,
        previousKPIs.totalInvested
      ),
      conversions: calculateDeltaPercent(
        currentKPIs.totalConversions,
        previousKPIs.totalConversions
      ),
      costPerConversion: calculateDeltaPercent(
        currentKPIs.avgCostPerConversion,
        previousKPIs.avgCostPerConversion
      ),
      reach: calculateDeltaPercent(
        currentKPIs.totalReach,
        previousKPIs.totalReach
      ),
    };
  }, [currentKPIs, previousKPIs]);

  // Dados para o Donut Chart (Divisão Meta Ads vs Google Ads)
  const platformDistributionData = useMemo(() => {
    const totals: Record<string, number> = {
      "Meta Ads": 0,
      "Google Ads": 0,
    };

    for (const r of primaryRecords) {
      totals[r.platform] =
        (totals[r.platform] || 0) + Number(r.amount_invested || 0);
    }

    return Object.entries(totals)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2)),
        percentage:
          currentKPIs.totalInvested > 0
            ? Math.round((value / currentKPIs.totalInvested) * 100)
            : 0,
      }));
  }, [primaryRecords, currentKPIs.totalInvested]);

  // Dados para o Gráfico de Barras (Investimento vs Conversões / Mensagens)
  const barChartData = useMemo(() => {
    if (viewMode === "compare") {
      return [
        {
          name: formatPeriodMonth(compareMonth),
          Investimento: Number(previousKPIs.totalInvested.toFixed(2)),
          Conversoes: previousKPIs.totalConversions,
        },
        {
          name: formatPeriodMonth(primaryMonth),
          Investimento: Number(currentKPIs.totalInvested.toFixed(2)),
          Conversoes: currentKPIs.totalConversions,
        },
      ];
    }

    return primaryRecords.map((r) => ({
      name:
        r.campaign_name.length > 22
          ? `${r.campaign_name.slice(0, 22)}...`
          : r.campaign_name,
      Investimento: Number(r.amount_invested),
      Conversoes: Number(r.results_count),
    }));
  }, [
    viewMode,
    primaryRecords,
    primaryMonth,
    compareMonth,
    currentKPIs,
    previousKPIs,
  ]);

  // Galeria de Criativos em Destaque no mês selecionado
  const featuredCreatives = useMemo(
    () =>
      primaryRecords.filter(
        (r) => r.creative_image_url && r.creative_image_url.trim().length > 0
      ),
    [primaryRecords]
  );

  // Pareceres Estratégicos do Gestor cadastrados no mês selecionado
  const managerObservations = useMemo(
    () =>
      primaryRecords.filter(
        (r) => r.observation && r.observation.trim().length > 0
      ),
    [primaryRecords]
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function handlePrintReport() {
    window.print();
  }

  // Componente interno para renderizar o Badge de evolução no modo Comparar Meses
  function renderEvolutionBadge(
    delta: number | null,
    invertColors = false,
    suffixLabel = "vs mês comparado"
  ) {
    if (viewMode !== "compare" || delta === null) return null;

    const isPositiveNumber = delta >= 0;
    // Para Custo por Conversão, cair (-15%) é positivo (verde)!
    const isGoodOutcome = invertColors ? delta <= 0 : delta >= 0;
    const formattedSign = isPositiveNumber ? "+" : "";

    return (
      <div className="mt-2 flex items-center gap-1.5">
        <Badge
          variant={isGoodOutcome ? "success" : "danger"}
          className="gap-1 px-2 py-0.5 text-[11px]"
        >
          {isPositiveNumber ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {formattedSign}
          {delta.toFixed(1)}%
        </Badge>
        <span className="text-[11px] text-slate-500">{suffixLabel}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* =====================================================================
          CABEÇALHO EXCLUSIVO DE IMPRESSÃO A4 (OCULTO NA TELA, VISÍVEL NO PDF)
         ===================================================================== */}
      <div className="hidden print-only border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Relatório Executivo de Performance Digital
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
              {clientProfile.company_name}
            </h1>
            <p className="text-xs text-slate-600">
              Aos cuidados de: {clientProfile.client_name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">
              Competência: {formatPeriodMonth(primaryMonth)}
            </p>
            {viewMode === "compare" && (
              <p className="text-xs text-slate-600">
                Comparado com: {formatPeriodMonth(compareMonth)}
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Gerado em {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          BARRA SUPERIOR DE NAVEGAÇÃO E FILTROS (OCULTA NA IMPRESSÃO .no-print)
         ===================================================================== */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Identificação da Empresa Cliente */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900">
                    {clientProfile.company_name}
                  </h1>
                  <Badge variant="secondary" className="text-[11px]">
                    Portal do Cliente
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Olá, {clientProfile.client_name} • Prestação de Contas de
                  Tráfego Pago
                </p>
              </div>
            </div>

            {/* Ações Superiores */}
            <div className="flex flex-wrap items-center gap-2.5">
              {isAdmin && (
                <>
                  <select
                    value={clientProfile.id}
                    onChange={(e) =>
                      router.push(`/portal?client_id=${e.target.value}`)
                    }
                    className="h-9 rounded-lg border border-blue-200 bg-blue-50/60 px-3 text-xs font-semibold text-blue-900"
                  >
                    {allClientsForAdmin.map((c) => (
                      <option key={c.id} value={c.id}>
                        Cliente: {c.company_name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/admin")}
                  >
                    Voltar ao Admin
                  </Button>
                </>
              )}

              <Button
                variant="default"
                size="sm"
                onClick={handlePrintReport}
                className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white"
              >
                <Printer className="h-4 w-4" />
                Imprimir / Salvar PDF
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

          {/* Barra de Filtros: Modo de Visualização e Seletor de Competência */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            {/* Toggle Mês Individual vs Comparar Meses */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-1">
              <button
                type="button"
                onClick={() => setViewMode("single")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "single"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                Mês Individual
              </button>
              <button
                type="button"
                onClick={() => setViewMode("compare")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "compare"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <GitCompare className="h-3.5 w-3.5 text-blue-600" />
                Comparar Meses
              </button>
            </div>

            {/* Seletores de Competência */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600">
                  Mês Principal:
                </span>
                <select
                  value={primaryMonth}
                  onChange={(e) => setPrimaryMonth(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 shadow-sm"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatPeriodMonth(m)} ({m})
                    </option>
                  ))}
                </select>
              </div>

              {viewMode === "compare" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">
                    Comparar com:
                  </span>
                  <select
                    value={compareMonth}
                    onChange={(e) => setCompareMonth(e.target.value)}
                    className="h-9 rounded-lg border border-blue-200 bg-blue-50/40 px-3 text-xs font-semibold text-blue-900 shadow-sm"
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {formatPeriodMonth(m)} ({m})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          CONTEÚDO PRINCIPAL DO DASHBOARD EXECUTIVO
         ===================================================================== */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6 lg:px-8">
        {/* Banner Resumo do Período */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Resultados de {formatPeriodMonth(primaryMonth)}
            </h2>
            <p className="text-sm text-slate-500">
              Visão executiva consolidada dos investimentos em anúncios e
              retorno comercial.
            </p>
          </div>
          <div className="no-print flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full font-medium">
            <ShieldCheck className="h-4 w-4" />
            Dados auditados e exclusivos de {clientProfile.company_name}
          </div>
        </div>

        {/* 1. CARDS DE MÉTRICAS PRINCIPAIS (KPIs EM DESTAQUE) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* KPI 1: Total Investido */}
          <Card className="border-l-4 border-l-blue-600">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Investido
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-slate-900">
                  {formatBRL(currentKPIs.totalInvested)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Verba aplicada em Meta Ads e Google Ads
                </p>
              </div>
              {renderEvolutionBadge(deltas.invested, false, "no investimento")}
            </CardContent>
          </Card>

          {/* KPI 2: Total de Conversões (WhatsApp + Leads + Vendas) */}
          <Card className="border-l-4 border-l-emerald-600">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total de Conversões
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <MessageCircle className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-slate-900">
                  {formatNumber(currentKPIs.totalConversions)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Contatos de WhatsApp, Leads e Vendas
                </p>
              </div>
              {renderEvolutionBadge(
                deltas.conversions,
                false,
                "em oportunidades geradas"
              )}
            </CardContent>
          </Card>

          {/* KPI 3: Custo Médio por Conversão / Lead */}
          <Card className="border-l-4 border-l-indigo-600">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Custo Médio / Conversão
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Target className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-slate-900">
                  {formatBRL(currentKPIs.avgCostPerConversion)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Valor médio investido para gerar 1 contato
                </p>
              </div>
              {renderEvolutionBadge(
                deltas.costPerConversion,
                true, // Custo menor é positivo (verde)!
                "no custo por contato"
              )}
            </CardContent>
          </Card>

          {/* KPI 4: Alcance Total / Pessoas Impactadas */}
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pessoas Impactadas
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-slate-900">
                  {formatNumber(currentKPIs.totalReach)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Alcance / visualizações dos anúncios
                </p>
              </div>
              {renderEvolutionBadge(deltas.reach, false, "em visibilidade")}
            </CardContent>
          </Card>
        </div>

        {/* 2. CARD DE PARECER ESTRATÉGICO DO GESTOR (SE HOUVER OBSERVAÇÃO NO MÊS) */}
        {managerObservations.length > 0 && (
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <MessageSquareQuote className="h-6 w-6" />
                </div>
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Parecer Estratégico do Gestor de Tráfego
                      </h3>
                      <p className="text-xs text-slate-600">
                        Análise executiva e direcionamento das campanhas em{" "}
                        {formatPeriodMonth(primaryMonth)}
                      </p>
                    </div>
                    <Badge variant="meta" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      Análise Mensal
                    </Badge>
                  </div>

                  <div className="space-y-2.5">
                    {managerObservations.map((obsRecord) => (
                      <blockquote
                        key={obsRecord.id}
                        className="rounded-lg border-l-4 border-blue-500 bg-white/90 p-3.5 text-sm leading-relaxed text-slate-700 shadow-sm"
                      >
                        <p className="italic">
                          &ldquo;{obsRecord.observation}&rdquo;
                        </p>
                        <footer className="mt-1.5 text-xs font-semibold text-slate-500">
                          — Referente à campanha:{" "}
                          <span className="text-slate-800">
                            {obsRecord.campaign_name} ({obsRecord.platform})
                          </span>
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. GRÁFICOS VISUAIS (RECHARTS) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Donut Chart: Divisão percentual do investimento (Meta Ads vs Google Ads) */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Divisão do Investimento por Canal</CardTitle>
              <CardDescription>
                Proporção da verba aplicada entre Meta Ads e Google Ads em{" "}
                {formatPeriodMonth(primaryMonth)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {platformDistributionData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                  Sem dados de investimento para este mês.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={88}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percentage }) =>
                          `${name}: ${percentage}%`
                        }
                      >
                        {platformDistributionData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={PLATFORM_COLORS[entry.name] || "#3b82f6"}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => formatBRL(value)}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Barras: Investimento vs Conversões / Mensagens */}
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>
                {viewMode === "compare"
                  ? "Comparativo: Investimento vs Conversões entre Meses"
                  : "Investimento vs Resultados por Campanha"}
              </CardTitle>
              <CardDescription>
                {viewMode === "compare"
                  ? `Evolução direta entre ${formatPeriodMonth(
                      compareMonth
                    )} e ${formatPeriodMonth(primaryMonth)}.`
                  : "Relação entre o valor aplicado (R$) e o volume de resultados conquistados."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {barChartData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                  Sem campanhas registradas neste período.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barChartData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#475569" }}
                      />
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 11, fill: "#2563eb" }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: "#10b981" }}
                      />
                      <RechartsTooltip
                        formatter={(value: number, name: string) =>
                          name === "Investimento (R$)"
                            ? formatBRL(value)
                            : formatNumber(value)
                        }
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="Investimento"
                        name="Investimento (R$)"
                        fill="#2563eb"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="Conversoes"
                        name="Resultados / Conversões"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 4. GALERIA DE CRIATIVOS EM DESTAQUE (SE HOUVER IMAGEM CADASTRADA) */}
        {featuredCreatives.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                <CardTitle>
                  Galeria de Anúncios (Criativos em Destaque)
                </CardTitle>
              </div>
              <CardDescription>
                Peças publicitárias de melhor performance em{" "}
                {formatPeriodMonth(primaryMonth)}. Clique sobre a imagem para
                ampliar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {featuredCreatives.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 hover:border-blue-300 transition-colors print-break-inside-avoid"
                  >
                    {/* Imagem do Criativo com Gatilho para Modal de Zoom */}
                    <div
                      onClick={() => setZoomedCreative(item)}
                      className="group relative h-44 w-full sm:w-44 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-900"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.creative_image_url!}
                        alt={item.campaign_name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="no-print absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900 shadow">
                          <ZoomIn className="h-3.5 w-3.5 text-blue-600" />
                          Ampliar
                        </span>
                      </div>
                    </div>

                    {/* Métricas do Criativo ao Lado */}
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge
                            variant={
                              item.platform === "Meta Ads" ? "meta" : "google"
                            }
                          >
                            {item.platform}
                          </Badge>
                          <span className="text-xs font-medium text-slate-500">
                            {item.campaign_type}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {item.campaign_name}
                        </h4>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2.5 rounded-lg bg-white p-3 border border-slate-200/80">
                        <div>
                          <p className="text-[11px] text-slate-500">
                            Investimento
                          </p>
                          <p className="text-sm font-bold text-slate-900">
                            {formatBRL(Number(item.amount_invested))}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500">
                            Resultados Gerados
                          </p>
                          <p className="text-sm font-bold text-emerald-700">
                            {formatNumber(Number(item.results_count))}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500">
                            Custo por Resultado
                          </p>
                          <p className="text-xs font-semibold text-blue-700">
                            {formatBRL(Number(item.cost_per_result))}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500">
                            Pessoas Alcançadas
                          </p>
                          <p className="text-xs font-semibold text-slate-800">
                            {item.reach_impressions
                              ? formatNumber(Number(item.reach_impressions))
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 5. TABELA RESUMO DAS AÇÕES */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              <CardTitle>Detalhamento das Campanhas Ativas no Mês</CardTitle>
            </div>
            <CardDescription>
              Resumo transparente de cada ação realizada, verba aplicada e
              retorno obtido em {formatPeriodMonth(primaryMonth)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {primaryRecords.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Nenhuma campanha registrada para{" "}
                {formatPeriodMonth(primaryMonth)}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4">Canal</th>
                      <th className="py-3.5 px-4">Campanha</th>
                      <th className="py-3.5 px-4">Objetivo Estratégico</th>
                      <th className="py-3.5 px-4 text-right">Verba Aplicada</th>
                      <th className="py-3.5 px-4 text-right">
                        Resultado Alcançado
                      </th>
                      <th className="py-3.5 px-4 text-right">
                        Custo por Resultado
                      </th>
                      <th className="py-3.5 px-4 text-right">
                        Alcance / ROAS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 text-sm">
                    {primaryRecords.map((rec) => (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/90 transition-colors"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge
                            variant={
                              rec.platform === "Meta Ads" ? "meta" : "google"
                            }
                          >
                            {rec.platform}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {rec.campaign_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {rec.campaign_type}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatBRL(Number(rec.amount_invested))}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                          {formatNumber(Number(rec.results_count))}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-blue-700 whitespace-nowrap">
                          {formatBRL(Number(rec.cost_per_result))}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-600 whitespace-nowrap">
                          {rec.campaign_type === "Vendas / E-commerce" &&
                          rec.roas ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <TrendingUp className="h-3.5 w-3.5" />
                              ROAS {Number(rec.roas).toFixed(2)}x
                            </span>
                          ) : rec.reach_impressions ? (
                            `${formatNumber(
                              Number(rec.reach_impressions)
                            )} pessoas`
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-900 text-sm">
                      <td colSpan={3} className="py-3.5 px-4">
                        Total Consolidado ({formatPeriodMonth(primaryMonth)})
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {formatBRL(currentKPIs.totalInvested)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-700">
                        {formatNumber(currentKPIs.totalConversions)} conversões
                      </td>
                      <td className="py-3.5 px-4 text-right text-blue-700">
                        {formatBRL(currentKPIs.avgCostPerConversion)} (média)
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {formatNumber(currentKPIs.totalReach)} impactados
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* =====================================================================
          MODAL LIGHTBOX PARA ZOOM DO CRIATIVO (OCULTO NA IMPRESSÃO)
         ===================================================================== */}
      {zoomedCreative && (
        <div
          onClick={() => setZoomedCreative(null)}
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {zoomedCreative.campaign_name}
                </h3>
                <p className="text-xs text-slate-500">
                  {zoomedCreative.platform} • {zoomedCreative.campaign_type}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoomedCreative(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex flex-col md:flex-row">
              <div className="flex-1 bg-slate-950 flex items-center justify-center max-h-[70vh] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={zoomedCreative.creative_image_url!}
                  alt={zoomedCreative.campaign_name}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </div>
              <div className="w-full md:w-72 p-5 space-y-4 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Performance da Peça
                </h4>
                <div className="space-y-3">
                  <div className="rounded-lg bg-white p-3 border border-slate-200">
                    <span className="text-xs text-slate-500">
                      Valor Investido
                    </span>
                    <p className="text-lg font-bold text-slate-900">
                      {formatBRL(Number(zoomedCreative.amount_invested))}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-slate-200">
                    <span className="text-xs text-slate-500">
                      Resultados Gerados
                    </span>
                    <p className="text-lg font-bold text-emerald-700">
                      {formatNumber(Number(zoomedCreative.results_count))}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-slate-200">
                    <span className="text-xs text-slate-500">
                      Custo por Resultado
                    </span>
                    <p className="text-lg font-bold text-blue-700">
                      {formatBRL(Number(zoomedCreative.cost_per_result))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
