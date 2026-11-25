// Testa o firestore.rules no emulador: isolamento entre usuários e caixa de entrada da API.
// Rodar com `npm test` (precisa de Java 11+ e Node 18+).
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const fs = require("fs");
const crypto = require("crypto");

process.on("unhandledRejection", (e) => { console.log(e.stack || e); process.exit(2); });

const sha256 = (c) => crypto.createHash("sha256").update(c).digest("hex");
const novaChave = () => crypto.randomBytes(32).toString("hex");

(async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-ponto",
    firestore: { rules: fs.readFileSync(`${__dirname}/../firestore.rules`, "utf8") },
  });
  const chaveA = novaChave();
  const chaveB = novaChave();

  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    for (const [u, chave, nome] of [["alice", chaveA, "Alice"], ["bruno", chaveB, "Bruno"]]) {
      await f.doc(`users/${u}`).set({ x: 1 });
      await f.doc(`users/${u}/meses/2026-11`).set({ dias: { 25: { d: `segredo-${u}`, h: 8 } } });
      await f.doc(`users/${u}/config/geral`).set({ nome });
      await f.doc(`users/${u}/config/api`).set({ hash: sha256(chave), criadaEm: "x" });
      await f.doc(`users/${u}/entrada/e1`).set({ chave, data: "2026-11-25", descricao: `pendente-${u}` });
    }
    await f.doc("users/semchave/meses/2026-11").set({ dias: {} });
    await f.doc("outros/x").set({ a: 1 });
  });

  const anon = env.unauthenticatedContext().firestore();
  const A = env.authenticatedContext("alice").firestore();
  const B = env.authenticatedContext("bruno").firestore();
  const entrada = (db, uid) => db.collection(`users/${uid}/entrada`);
  const pend = (chave, extra = {}) => ({ chave, data: "2026-11-26", descricao: "texto", ...extra });

  const casos = [
    // Bruno (logado) tentando alcançar os dados da Alice
    ["Bruno lê o mês da Alice", false, () => B.doc("users/alice/meses/2026-11").get()],
    ["Bruno lista os meses da Alice", false, () => B.collection("users/alice/meses").get()],
    ["Bruno lê o nome da Alice", false, () => B.doc("users/alice/config/geral").get()],
    ["Bruno lê o hash da chave da Alice", false, () => B.doc("users/alice/config/api").get()],
    ["Bruno lê as pendentes da Alice", false, () => entrada(B, "alice").get()],
    ["Bruno lê o documento users/alice", false, () => B.doc("users/alice").get()],
    ["Bruno lista a coleção users", false, () => B.collection("users").get()],
    ["Bruno busca collectionGroup meses", false, () => B.collectionGroup("meses").get()],
    ["Bruno busca collectionGroup entrada", false, () => B.collectionGroup("entrada").get()],
    ["Bruno busca collectionGroup config", false, () => B.collectionGroup("config").get()],
    ["Bruno lê coleção fora de users", false, () => B.doc("outros/x").get()],
    ["Bruno escreve no mês da Alice", false, () => B.doc("users/alice/meses/2026-11").set({ dias: { 25: { d: "invadido", h: 99 } } })],
    ["Bruno atualiza o mês da Alice", false, () => B.doc("users/alice/meses/2026-11").update({ "dias.25.d": "invadido" })],
    ["Bruno apaga o mês da Alice", false, () => B.doc("users/alice/meses/2026-11").delete()],
    ["Bruno troca o nome da Alice", false, () => B.doc("users/alice/config/geral").set({ nome: "hackeada" })],
    ["Bruno planta um hash dele na config/api da Alice", false, () => B.doc("users/alice/config/api").set({ hash: sha256(chaveB), criadaEm: "x" })],
    ["Bruno apaga a pendente da Alice", false, () => B.doc("users/alice/entrada/e1").delete()],
    ["Bruno cria pendente na Alice com a chave DELE", false, () => entrada(B, "alice").add(pend(chaveB))],

    // Sem login
    ["Anônimo lê o mês da Alice", false, () => anon.doc("users/alice/meses/2026-11").get()],
    ["Anônimo lista os meses da Alice", false, () => anon.collection("users/alice/meses").get()],
    ["Anônimo busca collectionGroup meses", false, () => anon.collectionGroup("meses").get()],
    ["Anônimo lê uma pendente pelo id", false, () => anon.doc("users/alice/entrada/e1").get()],
    ["Anônimo lista as pendentes", false, () => entrada(anon, "alice").get()],
    ["Anônimo escreve no mês da Alice", false, () => anon.doc("users/alice/meses/2026-11").set({ dias: {} })],
    ["Anônimo lê config/api", false, () => anon.doc("users/alice/config/api").get()],
    ["Anônimo troca a própria chave (config/api)", false, () => anon.doc("users/alice/config/api").set({ hash: "x" })],
    ["Anônimo atualiza uma pendente", false, () => anon.doc("users/alice/entrada/e1").update({ descricao: "y" })],
    ["Anônimo apaga uma pendente", false, () => anon.doc("users/alice/entrada/e1").delete()],

    // Caixa de entrada: validação da chave e do conteúdo
    ["Chave da Alice cria pendente na Alice", true, () => entrada(anon, "alice").add(pend(chaveA))],
    ["Chave do Bruno cria pendente no Bruno", true, () => entrada(anon, "bruno").add(pend(chaveB))],
    ["Chave do Bruno NÃO cria pendente na Alice", false, () => entrada(anon, "alice").add(pend(chaveB))],
    ["Chave da Alice NÃO cria pendente no Bruno", false, () => entrada(anon, "bruno").add(pend(chaveA))],
    ["Chave inventada não cria pendente", false, () => entrada(anon, "alice").add(pend("a".repeat(64)))],
    ["Usuário sem chave cadastrada não recebe pendente", false, () => entrada(anon, "semchave").add(pend(chaveA))],
    ["Chave em maiúsculas é recusada", false, () => entrada(anon, "alice").add(pend(chaveA.toUpperCase()))],
    ["Campo extra é recusado", false, () => entrada(anon, "alice").add(pend(chaveA, { extra: 1 }))],
    ["Sem descrição é recusado", false, () => entrada(anon, "alice").add({ chave: chaveA, data: "2026-11-26" })],
    ["Data fora do formato é recusada", false, () => entrada(anon, "alice").add(pend(chaveA, { data: "26/11/2026" }))],
    ["Descrição vazia é recusada", false, () => entrada(anon, "alice").add(pend(chaveA, { descricao: "" }))],
    ["Descrição com 2001 caracteres é recusada", false, () => entrada(anon, "alice").add(pend(chaveA, { descricao: "a".repeat(2001) }))],
    ["Descrição com 2000 caracteres é aceita", true, () => entrada(anon, "alice").add(pend(chaveA, { descricao: "a".repeat(2000) }))],
    ["Outro usuário logado com a chave certa cria pendente", true, () => entrada(B, "alice").add(pend(chaveA))],

    // O dono continua com acesso total aos próprios dados
    ["Alice lê o próprio mês", true, () => A.doc("users/alice/meses/2026-11").get()],
    ["Alice lê o próprio nome", true, () => A.doc("users/alice/config/geral").get()],
    ["Alice lê as próprias pendentes", true, () => entrada(A, "alice").get()],
    ["Alice escreve no próprio mês", true, () => A.doc("users/alice/meses/2026-12").set({ dias: {} })],
    ["Alice troca a própria chave", true, () => A.doc("users/alice/config/api").set({ hash: sha256(novaChave()), criadaEm: "y" })],
    ["Alice apaga a própria pendente", true, () => A.doc("users/alice/entrada/e1").delete()],
    ["Bruno lê o próprio mês", true, () => B.doc("users/bruno/meses/2026-11").get()],
  ];

  let falhas = 0;
  for (const [nome, esperado, fn] of casos) {
    let ok = true;
    try { await (esperado ? assertSucceeds(fn()) : assertFails(fn())); } catch { ok = false; falhas++; }
    console.log(`${ok ? "OK    " : "FALHOU"} ${nome} -> esperado ${esperado ? "permitir" : "negar"}`);
  }
  console.log(`\n${casos.length - falhas}/${casos.length} casos como esperado`);
  await env.cleanup();
  process.exit(falhas ? 1 : 0);
})();
