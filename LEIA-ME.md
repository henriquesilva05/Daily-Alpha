# Daily Alpha — como pôr o site no ar

Este pacote tem o site completo:

| Ficheiro | Para que serve |
|---|---|
| `index.html` | O site (notícias, portfólio, pesquisa, aprender, login) |
| `api/market.js` | Intermediário de dados de mercado: esconde as chaves e partilha a cache entre leitores |
| `api/explain.js` | "Explica-me este ativo" com IA (só com sessão iniciada, com limite diário) |
| `supabase/schema.sql` | Tabelas e regras de segurança da base de dados |
| `package.json`, `vercel.json` | Configuração para a Vercel |

---

## 1. Supabase (5 minutos)

1. Abre o teu projeto em https://supabase.com/dashboard
2. Menu da esquerda → **SQL Editor** → **New query**.
3. Abre o ficheiro `supabase/schema.sql`, copia tudo, cola e carrega em **Run**. Deve aparecer "Success".
4. Menu da esquerda → **Authentication** → **Sign In / Providers** → **Email**:
   - Deixa **Enable Email provider** ligado.
   - Desliga **Confirm email** (por agora). O serviço de email gratuito do Supabase só envia emails para membros da tua equipa, por isso os teus amigos não receberiam a confirmação. Mais tarde configuramos um serviço de email próprio e voltamos a ligar.
   - Guarda.

## 2. GitHub (5 minutos)

1. Abre o repositório `daily-alpha` que criaste.
2. Carrega em **uploading an existing file** (ou **Add file → Upload files**).
3. Arrasta para lá **o conteúdo** da pasta `daily-alpha` (os ficheiros e as pastas `api` e `supabase`, não a pasta em si).
4. Carrega em **Commit changes**.

## 3. Vercel (5 minutos)

1. Em https://vercel.com/new escolhe o repositório `daily-alpha` → **Import**.
2. **Framework Preset**: Other. Não mexas em mais nada nessa parte.
3. Abre **Environment Variables** e acrescenta estas variáveis (nome → valor):

| Nome | Valor |
|---|---|
| `TWELVE_DATA_API_KEY` | a tua chave do Twelve Data |
| `ALPHA_VANTAGE_API_KEY` | a tua chave do Alpha Vantage |
| `SUPABASE_URL` | `https://mdxcvflzskqetvtprhew.supabase.co` |
| `SUPABASE_ANON_KEY` | a chave `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | a chave secreta `sb_secret_...` (Supabase → Project Settings → API Keys) |
| `ANTHROPIC_API_KEY` | (opcional) a tua chave da Anthropic |
| `ANTHROPIC_MODEL` | (opcional) o nome de um modelo Claude, copiado de https://docs.anthropic.com/en/docs/about-claude/models |
| `AI_DAILY_LIMIT` | (opcional) explicações por pessoa por dia, por defeito 10 |

4. Carrega em **Deploy**. Ao fim de 1 minuto tens o endereço do site (algo como `daily-alpha.vercel.app`).

## 4. Último acerto no Supabase

Em **Authentication → URL Configuration**, põe em **Site URL** o endereço que a Vercel te deu (ex.: `https://daily-alpha.vercel.app`) e guarda.

## 5. Testar

1. Abre o site e confirma que as notícias aparecem.
2. Carrega em **Entrar → Criar conta**, cria uma conta e entra.
3. Na aba **Pesquisar**, procura "Apple" e confirma que o gráfico aparece.
4. Adiciona uma compra no **Portfólio**, fecha o navegador, volta a abrir: a compra tem de lá estar.

Se algo falhar, manda uma captura de ecrã ao Claude.

---

**Nunca** escrevas as chaves secretas (`sb_secret_...`, Twelve Data, Alpha Vantage, Anthropic) no código, no GitHub ou numa conversa: ficam só nas Environment Variables da Vercel.
