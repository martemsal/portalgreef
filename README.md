# AdPulse Executive — Portal de Performance & Tráfego Pago

Aplicação web full-stack em **Next.js 14 (App Router)**, **TypeScript estrito**, **Tailwind CSS**, **Shadcn/UI**, **Recharts**, **React Hook Form + Zod** e **Supabase (Auth, Database & Storage)** para gestão e prestação de contas executiva de campanhas de **Google Ads** e **Meta Ads**.

---

## 1. Arquitetura & Segurança (RLS)

- **Banco de Dados (`schema.sql`):**
  - Tabela `profiles`: vinculada a `auth.users` com papéis `'admin'` e `'client'`.
  - Tabela `campaign_records`: registros mensais (`YYYY-MM`) por plataforma (`Meta Ads` | `Google Ads`), objetivo, investimento, resultados, alcance, faturamento, ROAS, imagem do criativo e observação estratégica.
  - Coluna `cost_per_result` calculada automaticamente pelo PostgreSQL (`GENERATED ALWAYS AS ... STORED`).
- **Supabase Storage:**
  - Bucket público `creatives` configurado automaticamente pelo SQL com limite de 10MB para PNG, JPG e WebP.
- **Row Level Security (RLS):**
  - Clientes (`role = 'client'`) têm permissão **exclusiva de leitura (`SELECT`)** apenas onde `client_id = auth.uid()` e na pasta `{auth.uid()}/` do bucket `creatives`.
  - Administradores (`role = 'admin'`) possuem controle total (`ALL` / CRUD) nas tabelas e no bucket.

---

## 2. Passo a Passo de Configuração

### Passo 1: Configurar o Supabase
1. Crie um projeto no [Supabase](https://supabase.com).
2. Abra o **SQL Editor** do Supabase, cole todo o conteúdo do arquivo [`schema.sql`](./schema.sql) e clique em **Run**.
3. Para promover seu primeiro usuário a **Administrador**, crie um usuário em *Authentication > Users* e execute no SQL Editor:
   ```sql
   INSERT INTO public.profiles (id, role, client_name, company_name, email)
   VALUES ('UUID-DO-SEU-USUARIO', 'admin', 'Gestor Principal', 'Agência Performance', 'admin@agencia.com')
   ON CONFLICT (id) DO UPDATE SET role = 'admin';
   ```

### Passo 2: Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env.local`:
```bash
cp .env.example .env.local
```
Preencha com as chaves do seu projeto Supabase (*Project Settings > API*):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` *(usada exclusivamente na rota `/api/admin/clients` para que o administrador cadastre novos clientes sem perder sua própria sessão)*

### Passo 3: Instalar e Executar Localmente
```bash
npm install
npm run dev
```
Acesse `http://localhost:3000`.

### Passo 4: Deploy na Vercel
1. Suba a pasta `traffic-portal` em um repositório no GitHub.
2. Importe o repositório na **Vercel**.
3. Adicione as 3 variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) nas configurações do projeto na Vercel e clique em **Deploy**.
