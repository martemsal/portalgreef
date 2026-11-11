import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatação monetária padronizada para Real brasileiro (BRL)
 */
export function formatBRL(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
}

/**
 * Formatação de números inteiros/decimais (ex: Alcance, Conversões)
 */
export function formatNumber(value: number | null | undefined): string {
  const safeValue = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(safeValue);
}

/**
 * Formata YYYY-MM para "Novembro de 2026"
 */
export function formatPeriodMonth(periodMonth: string): string {
  if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) return periodMonth;
  const [year, month] = periodMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Calcula variação percentual entre dois períodos
 */
export function calculateDeltaPercent(
  currentValue: number,
  previousValue: number
): number | null {
  if (!previousValue || previousValue === 0) return null;
  return ((currentValue - previousValue) / previousValue) * 100;
}
