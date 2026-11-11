import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createClientSchema } from "@/types/database";

export async function POST(request: Request) {
  try {
    // 1. Verifica se o usuário autenticado é um administrador
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (callerProfile?.role !== "admin") {
      return NextResponse.json(
        { error: "Acesso negado. Apenas administradores podem criar clientes." },
        { status: 403 }
      );
    }

    // 2. Valida o payload com Zod
    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Dados inválidos para cadastro.",
        },
        { status: 400 }
      );
    }

    const { client_name, company_name, email, password } = parsed.data;

    // 3. Cria o usuário no Supabase Auth usando Service Role (sem encerrar a sessão do Admin)
    const adminSupabase = createAdminSupabaseClient();

    const { data: createdAuth, error: createAuthError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "client",
          client_name,
          company_name,
        },
      });

    if (createAuthError || !createdAuth.user) {
      return NextResponse.json(
        {
          error:
            createAuthError?.message ??
            "Não foi possível criar o usuário no Supabase Auth.",
        },
        { status: 400 }
      );
    }

    // 4. Garante a gravação na tabela `profiles`
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .upsert(
        {
          id: createdAuth.user.id,
          role: "client",
          client_name,
          company_name,
          email,
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno no servidor.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
