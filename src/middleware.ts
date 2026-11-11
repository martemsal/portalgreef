import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedAdmin = pathname.startsWith("/admin");
  const isProtectedPortal = pathname.startsWith("/portal");
  const isLoginPage = pathname === "/login";

  // 1. Usuário não autenticado tentando acessar rotas protegidas
  if (!user && (isProtectedAdmin || isProtectedPortal)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // 2. Usuário autenticado: verificar role na tabela profiles para garantir isolamento estrito
  if (user && (isProtectedAdmin || isProtectedPortal || isLoginPage || pathname === "/")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "client";

    // Redireciona da home ou /login para o painel correspondente ao papel
    if (isLoginPage || pathname === "/") {
      const targetUrl = request.nextUrl.clone();
      targetUrl.pathname = role === "admin" ? "/admin" : "/portal";
      return NextResponse.redirect(targetUrl);
    }

    // Bloqueia clientes que tentarem acessar /admin
    if (isProtectedAdmin && role !== "admin") {
      const portalUrl = request.nextUrl.clone();
      portalUrl.pathname = "/portal";
      return NextResponse.redirect(portalUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/portal/:path*"],
};
