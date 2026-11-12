"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, Lock, Mail, Loader2, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeProvider";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError || !authData.user) {
        setErrorMessage(
          "E-mail ou senha inválidos. Verifique suas credenciais e tente novamente."
        );
        setLoading(false);
        return;
      }

      // Consulta role na tabela profiles para redirecionamento imediato
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profile?.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/portal");
      }
      router.refresh();
    } catch {
      setErrorMessage("Ocorreu um erro inesperado ao autenticar.");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-100 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 px-4 py-12 transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-blue-600/15 dark:bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-lg">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            AdPulse Executive
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs">
            Portal de Inteligência, Prestação de Contas e Performance em Tráfego Pago
          </p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 backdrop-blur-md shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
              Acesse sua conta
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Insira seu e-mail corporativo e senha para visualizar seus indicadores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {errorMessage && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-600 dark:text-rose-300">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="voce@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
                  <Input
                    id="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  "Entrar no Portal"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span>Ambiente seguro com isolamento de dados por cliente (RLS)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
