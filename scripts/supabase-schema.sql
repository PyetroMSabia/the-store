-- ==============================================================================
-- THE STORE — SCRIPT SQL OFICIAL PARA SUPABASE (PostgreSQL)
-- Cole este script no SQL Editor do seu projeto Supabase e clique em RUN.
-- Ele cria todas as tabelas, índices e permissões necessárias para o funcionamento 100%.
-- ==============================================================================

-- 1. TABELA DE USUÁRIOS (users)
CREATE TABLE IF NOT EXISTS public.users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- 2. TABELA DE PRODUTOS E OFERTAS (products)
CREATE TABLE IF NOT EXISTS public.products (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  price            NUMERIC NOT NULL CHECK (price > 0),
  old_price        NUMERIC CHECK (old_price IS NULL OR old_price > 0),
  rating           NUMERIC CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  image_url        TEXT NOT NULL,
  images           TEXT,                 -- JSON string com array de URLs de fotos
  affiliate_url    TEXT NOT NULL,
  source_url       TEXT,
  store_name       TEXT NOT NULL,
  available_stores TEXT,                 -- JSON string com array de nomes de lojas
  offers           TEXT,                 -- JSON string com lista de ofertas/preços por loja
  ai_summary       TEXT,                 -- Resumo de inteligência artificial da curadoria
  category         TEXT NOT NULL,
  description      TEXT,
  click_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_clicks ON public.products (click_count DESC);

-- 3. TABELA DE FAVORITOS (favorites)
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites (user_id, created_at DESC);

-- 4. TABELA DE ITENS DO CARRINHO (cart_items)
CREATE TABLE IF NOT EXISTS public.cart_items (
  user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_user ON public.cart_items (user_id, created_at DESC);

-- Compatibilidade com referência alternativa 'cart'
CREATE OR REPLACE VIEW public.cart AS 
SELECT user_id, product_id, quantity, created_at FROM public.cart_items;

-- 5. TABELA DE SESSÕES (sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
  id         TEXT PRIMARY KEY,           -- sha256 do sid da sessão
  user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,            -- timestamp em milissegundos
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.sessions (expires_at);

-- 6. TABELA DE RECUPERAÇÃO DE SENHA (password_resets)
CREATE TABLE IF NOT EXISTS public.password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  used_at    BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON public.password_resets (user_id);

-- ==============================================================================
-- PERMISSÕES E ROW LEVEL SECURITY (RLS)
-- Como a The Store gerencia toda a autenticação e autorização RBAC de forma segura
-- no backend do Next.js (server-only), configuramos o acesso para as chaves da SDK.
-- ==============================================================================

-- Desabilita RLS para permitir operações diretas pela SDK do backend
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets DISABLE ROW LEVEL SECURITY;

-- Garante privilégios para roles anon e service_role
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.favorites TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.cart_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.password_resets TO anon, authenticated, service_role;

-- ==============================================================================
-- INICIALIZAÇÃO DO ADMINISTRADOR DA CURADORIA (OPCIONAL/PADRÃO)
-- ==============================================================================
INSERT INTO public.users (id, name, email, password_hash, role)
VALUES (
  'admin-master',
  'Curador The Store',
  'thestore@gmail.com',
  'scrypt$16384$8$1$85TxD3D5vqldnrGb0Z/KkQ==$iu7JiLbBpXMQPIHbcTIoTrxcO1iVz2zk8QqeVmxF3DJX9NKXF974ilLoJvtPjwCvbw+rd3F2uqZ6/aikxszZ6Q==',
  'ADMIN'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'ADMIN';

DELETE FROM public.users WHERE email = 'admin@thestore.local';


-- Fim do script de migração do Supabase
