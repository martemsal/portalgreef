import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createClientSchema, updateClientSchema } from "@/types/database";

async function verifyAdminCaller() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado.", status: 401 as const };
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return {
      error: "Acesso negado. Apenas administradores podem gerenciar clientes.",
      status: 403 as const,
    };
  }

  return { user };
}

export async function POST(request: Request) {
  try {
    const authCheck = await verifyAdminCaller();
    if ("error" in authCheck) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
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

export async function PATCH(request: Request) {
  try {
    const authCheck = await verifyAdminCaller();
    if ("error" in authCheck) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const body = await request.json();
    const parsed = updateClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Dados inválidos para atualização.",
        },
        { status: 400 }
      );
    }

    const { id, client_name, company_name, email, password } = parsed.data;
    const adminSupabase = createAdminSupabaseClient();

    // Atualiza credenciais e metadados no Supabase Auth
    const authUpdatePayload: {
      email?: string;
      password?: string;
      email_confirm?: boolean;
      user_metadata: {
        role: string;
        client_name: string;
        company_name: string;
      };
    } = {
      email,
      email_confirm: true,
      user_metadata: {
        role: "client",
        client_name,
        company_name,
      },
    };

    if (password && password.trim().length >= 6) {
      authUpdatePayload.password = password.trim();
    } else if (password && password.trim().length > 0 && password.trim().length < 6) {
      return NextResponse.json(
        { error: "Se informada, a nova senha deve ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    const { error: updateAuthError } =
      await adminSupabase.auth.admin.updateUserById(id, authUpdatePayload);

    if (updateAuthError) {
      return NextResponse.json(
        { error: updateAuthError.message },
        { status: 400 }
      );
    }

    // Atualiza os dados na tabela `profiles`
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .update({
        client_name,
        company_name,
        email,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno no servidor.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
