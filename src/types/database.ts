import { z } from "zod";

export type UserRole = "admin" | "client";

export type AdPlatform = "Meta Ads" | "Google Ads";

export type CampaignType =
  | "WhatsApp / Mensagens"
  | "Leads / Formulário"
  | "Vendas / E-commerce"
  | "Reconhecimento / Alcance"
  | "Tráfego / Cliques";

export const PLATFORMS: AdPlatform[] = ["Meta Ads", "Google Ads"];

export const CAMPAIGN_TYPES: CampaignType[] = [
  "WhatsApp / Mensagens",
  "Leads / Formulário",
  "Vendas / E-commerce",
  "Reconhecimento / Alcance",
  "Tráfego / Cliques",
];

export interface Profile {
  id: string;
  role: UserRole;
  client_name: string;
  company_name: string;
  companies?: string[];
  email?: string | null;
  created_at: string;
}

export interface CampaignRecord {
  id: string;
  client_id: string;
  company_name?: string;
  period_month: string; // YYYY-MM
  platform: AdPlatform;
  campaign_type: CampaignType;
  campaign_name: string;
  amount_invested: number;
  results_count: number;
  reach_impressions: number | null;
  cost_per_result: number;
  roas: number | null;
  revenue_generated: number | null;
  creative_image_url: string | null;
  observation: string | null;
  created_at: string;
  profiles?: Pick<Profile, "client_name" | "company_name"> | null;
}

/**
 * Schema Zod para criação de novo cliente pelo Administrador
 */
export const createClientSchema = z.object({
  client_name: z
    .string()
    .min(2, "Informe o nome do responsável (mín. 2 caracteres)."),
  company_name: z
    .string()
    .min(2, "Informe pelo menos uma empresa (mín. 2 caracteres)."),
  email: z.string().email("Informe um e-mail válido."),
  password: z
    .string()
    .min(6, "A senha temporária deve ter pelo menos 6 caracteres."),
});

export type CreateClientFormValues = z.infer<typeof createClientSchema>;

/**
 * Schema Zod para edição de cliente existente pelo Administrador
 */
export const updateClientSchema = z.object({
  id: z.string().uuid("ID de cliente inválido."),
  client_name: z
    .string()
    .min(2, "Informe o nome do responsável (mín. 2 caracteres)."),
  company_name: z
    .string()
    .min(2, "Informe pelo menos uma empresa (mín. 2 caracteres)."),
  email: z.string().email("Informe um e-mail válido."),
  password: z
    .string()
    .optional()
    .or(z.literal("")),
});

export type UpdateClientFormValues = z.infer<typeof updateClientSchema>;

/**
 * Utilitário para extrair a lista de empresas de um perfil
 * (suporta empresas separadas por vírgula em `company_name` ou array em `companies`)
 */
export function getProfileCompanies(profile?: Pick<Profile, "company_name" | "companies"> | null): string[] {
  if (!profile) return [];
  if (Array.isArray(profile.companies) && profile.companies.length > 0) {
    return profile.companies.map((c) => c.trim()).filter(Boolean);
  }
  if (!profile.company_name) return [];
  return profile.company_name
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Extrai a empresa vinculada a uma campanha (caso `company_name` não exista como coluna no banco,
 * lê um prefixo opcional `[[Empresa]] ` na campanha ou retorna a empresa principal do cliente).
 */
export function unpackCampaignCompany(
  rawCampaignName: string,
  explicitCompanyName?: string | null,
  fallbackCompany?: string
): { companyName: string; cleanCampaignName: string } {
  const match = rawCampaignName.match(/^\[\[(.+?)\]\]\s*(.*)$/);
  if (match) {
    return {
      companyName: explicitCompanyName || match[1].trim(),
      cleanCampaignName: match[2].trim() || rawCampaignName,
    };
  }
  return {
    companyName: explicitCompanyName || fallbackCompany || "Empresa Principal",
    cleanCampaignName: rawCampaignName,
  };
}

export function packCampaignNameWithCompany(
  cleanCampaignName: string,
  companyName?: string | null
): string {
  const trimmedName = cleanCampaignName.replace(/^\[\[(.+?)\]\]\s*/, "").trim();
  if (!companyName || !companyName.trim()) {
    return trimmedName;
  }
  return `[[${companyName.trim()}]] ${trimmedName}`;
}

/**
 * Schema Zod para lançamento/edição de campanha
 */
export const campaignRecordSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente válido."),
  company_name: z.string().min(1, "Selecione a empresa da campanha."),
  period_month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato AAAA-MM (ex: 2026-11)."),
  platform: z.enum(["Meta Ads", "Google Ads"], {
    required_error: "Selecione a plataforma.",
  }),
  campaign_type: z.enum(
    [
      "WhatsApp / Mensagens",
      "Leads / Formulário",
      "Vendas / E-commerce",
      "Reconhecimento / Alcance",
      "Tráfego / Cliques",
    ],
    {
      required_error: "Selecione o objetivo da campanha.",
    }
  ),
  campaign_name: z
    .string()
    .min(2, "Informe o nome de identificação da campanha."),
  amount_invested: z.coerce
    .number({ invalid_type_error: "Informe o valor investido." })
    .min(0.01, "O investimento deve ser maior que R$ 0,00."),
  results_count: z.coerce
    .number({ invalid_type_error: "Informe a quantidade de resultados." })
    .min(0, "O resultado não pode ser negativo."),
  reach_impressions: z
    .union([z.coerce.number().min(0), z.literal(""), z.null()])
    .optional()
    .transform((val) => (val === "" || val === undefined ? null : Number(val))),
  revenue_generated: z
    .union([z.coerce.number().min(0), z.literal(""), z.null()])
    .optional()
    .transform((val) => (val === "" || val === undefined ? null : Number(val))),
  roas: z
    .union([z.coerce.number().min(0), z.literal(""), z.null()])
    .optional()
    .transform((val) => (val === "" || val === undefined ? null : Number(val))),
  creative_image_url: z.string().nullable().optional(),
  observation: z.string().nullable().optional(),
});

export type CampaignRecordFormValues = z.infer<typeof campaignRecordSchema>;
