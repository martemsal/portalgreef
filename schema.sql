-- =============================================================================
-- SCHEMA SQL COMPLETO - PORTAL DE PERFORMANCE & TRÁFEGO PAGO (SUPABASE)
-- Execute este script no SQL Editor do Supabase.
-- =============================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABELA: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  client_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Perfis de acesso vinculados ao Supabase Auth (admin e client).';

-- 3. TABELA: campaign_records
CREATE TABLE IF NOT EXISTS public.campaign_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL CHECK (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  platform TEXT NOT NULL CHECK (platform IN ('Meta Ads', 'Google Ads')),
  campaign_type TEXT NOT NULL CHECK (
    campaign_type IN (
      'WhatsApp / Mensagens',
      'Leads / Formulário',
      'Vendas / E-commerce',
      'Reconhecimento / Alcance',
      'Tráfego / Cliques'
    )
  ),
  campaign_name TEXT NOT NULL,
  amount_invested NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_invested >= 0),
  results_count NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (results_count >= 0),
  reach_impressions NUMERIC(14, 2) NULL CHECK (reach_impressions IS NULL OR reach_impressions >= 0),
  -- Custo por resultado calculado automaticamente pelo banco (evita divisão por zero)
  cost_per_result NUMERIC(14, 2) GENERATED ALWAYS AS (
    CASE
      WHEN results_count > 0 THEN ROUND(amount_invested / results_count, 2)
      ELSE 0
    END
  ) STORED,
  roas NUMERIC(10, 2) NULL,
  revenue_generated NUMERIC(14, 2) NULL CHECK (revenue_generated IS NULL OR revenue_generated >= 0),
  creative_image_url TEXT NULL,
  observation TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_records_client_period
  ON public.campaign_records (client_id, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_records_period
  ON public.campaign_records (period_month DESC);

-- Trigger opcional para calcular ROAS automaticamente quando revenue_generated é informado
CREATE OR REPLACE FUNCTION public.calculate_campaign_roas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.revenue_generated IS NOT NULL AND NEW.revenue_generated > 0 AND NEW.amount_invested > 0 THEN
    NEW.roas := ROUND(NEW.revenue_generated / NEW.amount_invested, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_campaign_roas ON public.campaign_records;
CREATE TRIGGER trg_calculate_campaign_roas
BEFORE INSERT OR UPDATE ON public.campaign_records
FOR EACH ROW
EXECUTE FUNCTION public.calculate_campaign_roas();

-- Trigger para criar perfil automaticamente quando um usuário é criado no auth.users via metadados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, client_name, company_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'client_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'Empresa Cliente'),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    client_name = EXCLUDED.client_name,
    company_name = EXCLUDED.company_name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 4. FUNÇÃO AUXILIAR DE VERIFICAÇÃO DE ADMIN (SECURITY DEFINER PARA EVITAR RECURSÃO RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_records ENABLE ROW LEVEL SECURITY;

-- Políticas para `profiles`
DROP POLICY IF EXISTS "Admins possuem controle total em profiles" ON public.profiles;
CREATE POLICY "Admins possuem controle total em profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Clientes visualizam apenas o próprio perfil" ON public.profiles;
CREATE POLICY "Clientes visualizam apenas o próprio perfil"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Políticas para `campaign_records`
DROP POLICY IF EXISTS "Admins possuem controle total em campaign_records" ON public.campaign_records;
CREATE POLICY "Admins possuem controle total em campaign_records"
  ON public.campaign_records
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Clientes visualizam apenas os próprios registros de campanha" ON public.campaign_records;
CREATE POLICY "Clientes visualizam apenas os próprios registros de campanha"
  ON public.campaign_records
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- 6. SUPABASE STORAGE: BUCKET PÚBLICO `creatives` E POLÍTICAS RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creatives',
  'creatives',
   true,
  10485760, -- 10MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de Storage para o bucket `creatives`
-- Padronizamos o caminho do arquivo como: `{client_id}/{timestamp}-{filename}`
-- Assim `storage.foldername(name)[1]` corresponde ao `client_id`.

DROP POLICY IF EXISTS "Admins possuem controle total no bucket creatives" ON storage.objects;
CREATE POLICY "Admins possuem controle total no bucket creatives"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'creatives' AND public.is_admin())
  WITH CHECK (bucket_id = 'creatives' AND public.is_admin());

DROP POLICY IF EXISTS "Clientes leem apenas imagens da sua própria pasta no bucket creatives" ON storage.objects;
CREATE POLICY "Clientes leem apenas imagens da sua própria pasta no bucket creatives"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'creatives'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
