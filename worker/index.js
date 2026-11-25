// Worker do chat de dúvidas: recebe a pergunta do site e consulta o Gemini.
// A chave fica só aqui, como secret (GEMINI_API_KEY).

const SISTEMA = `Você é o assistente do site Ponto Eletrônico e responde em português do Brasil, de forma curta e simpática.
Você ajuda com duas coisas: tirar dúvidas sobre o que o site faz e escrever as descrições do relatório de forma profissional.
Se perguntarem outra coisa, diga que só ajuda com o Ponto Eletrônico.
Não invente recursos além dos descritos abaixo.
Quando o usuário contar o que fez no dia (ou colar um texto para melhorar), escreva a descrição pronta para ele colar no dia: de 1 a 3 frases, em um único parágrafo, no passado, em tom profissional e direto, sem aspas nem título. Coloque a descrição pronta entre as marcas <descricao> e </descricao>; você pode escrever uma frase curta antes ou depois, fora das marcas. Nunca use essas marcas em outras respostas (dúvidas, perguntas de volta, conversa). Mantenha só os fatos que ele contou: não invente tarefas, resultados, números, nomes nem horas. Se faltar informação importante, pergunte antes de escrever.

O que o site faz:
- Relatório mensal de horas que acompanha a nota fiscal: uma linha por dia com a descrição do que foi feito e as horas.
- Dias úteis começam com 8 horas e fins de semana com 0; os totais são calculados na hora.
- Salva sozinho na conta do usuário (login com Google), então dá para continuar de outro computador.
- O valor hora fica salvo só no navegador do usuário e nunca é enviado ao servidor; ele aparece apenas no .xlsx baixado.
- O botão "Baixar .xlsx" gera o arquivo no modelo da nota. É preciso preencher o nome antes de baixar, e o modelo comporta 24 dias com horas.
- "Conectar IA" gera uma chave e um prompt para colar na IA do usuário. A IA escreve o texto do dia anterior, o usuário revisa e, depois de aprovar, o texto chega como pendente no site para o usuário aceitar. A chave só aparece uma vez.
- O chat escreve a descrição do dia a partir do que o usuário contou; ele copia o texto e cola no campo do dia.
- O botão "Sugestão" envia ideias para o administrador.
- Para criar conta basta entrar com o Google.`;

const cors = (origin, env) => ({
  "Access-Control-Allow-Origin": origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
});

async function gemini(env, sistema, contents, maxOutputTokens) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents,
        generationConfig: { maxOutputTokens, temperature: 0.3 },
      }),
    },
  );
  if (!resp.ok) return { erro: `gemini ${resp.status}` };
  const dados = await resp.json();
  const texto = dados.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
  return texto || { erro: "sem resposta" };
}

const json = (corpo, status, headers) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json", ...headers } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    const headers = cors(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ erro: "método não permitido" }, 405, headers);
    if (origin !== env.ALLOWED_ORIGIN) return json({ erro: "origem não permitida" }, 403, headers);

    let corpo;
    try { corpo = await request.json(); } catch { return json({ erro: "json inválido" }, 400, headers); }
    const pergunta = String(corpo.pergunta ?? "").trim().slice(0, 500);
    if (!pergunta) return json({ erro: "pergunta vazia" }, 400, headers);

    const historico = (Array.isArray(corpo.historico) ? corpo.historico : [])
      .slice(-6)
      .filter((m) => (m.papel === "user" || m.papel === "model") && typeof m.texto === "string")
      .map((m) => ({ role: m.papel, parts: [{ text: m.texto.slice(0, 1000) }] }));

    const resposta = await gemini(env, SISTEMA, [...historico, { role: "user", parts: [{ text: pergunta }] }], 1024);
    if (typeof resposta !== "string") return json({ erro: resposta.erro }, 502, headers);
    return json({ resposta }, 200, headers);
  },
};
