# Worker do chat de dúvidas

Recebe a pergunta do site e consulta o Gemini (plano grátis). A chave do Gemini fica só no Worker.

1. Pegue uma chave em https://aistudio.google.com/apikey
2. Nesta pasta:

```bash
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

3. Copie o endereço que o deploy mostrar (`https://ponto-chat.<conta>.workers.dev`) para `CHAT_URL` em `../chat-config.js`.
4. Para limitar abuso, crie uma regra de rate limiting para esse Worker no painel da Cloudflare (Security → WAF → Rate limiting rules).

`ALLOWED_ORIGIN` em `wrangler.toml` é o endereço do site; mude se o site mudar de domínio.
