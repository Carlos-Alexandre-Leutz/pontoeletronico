import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
import { firebaseConfig } from "./firebase-config.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const HORAS_PADRAO = 8;
const PRIMEIRA_LINHA = 7;
const ULTIMA_LINHA = 30;

const $ = (id) => document.getElementById(id);
const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

if (Object.values(firebaseConfig).some((v) => v === "COLE_AQUI")) {
  $("login").classList.remove("d-none");
  $("btn-login").classList.add("d-none");
  $("login-erro").textContent = "Preencha o firebase-config.js com a config do seu projeto Firebase.";
  throw new Error("firebase-config.js não preenchido");
}

const auth = getAuth(initializeApp(firebaseConfig));
const db = getFirestore();

let uid = null;
let mes = null; // "YYYY-MM"
let valor = 0;
let nome = "";
let dias = {}; // { "1": { d: "descrição", h: 8 } } — só dias editados
let saveTimer = null;

const refMes = (m) => doc(db, "users", uid, "meses", m);
const refConfig = () => doc(db, "users", uid, "config", "geral");

function setStatus(t) { $("status").textContent = t; }

function mesAtual() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}

function diasDoMes() {
  const [a, m] = mes.split("-").map(Number);
  const n = new Date(a, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => {
    const dia = i + 1;
    const dow = new Date(a, m - 1, dia).getDay();
    return { dia, dow, fds: dow === 0 || dow === 6 };
  });
}

function dadosDoDia(info) {
  const e = dias[info.dia] || {};
  return { d: e.d ?? "", h: e.h ?? (info.fds ? 0 : HORAS_PADRAO) };
}

function render() {
  const tbody = $("dias");
  tbody.innerHTML = "";
  for (const info of diasDoMes()) {
    const { d, h } = dadosDoDia(info);
    const tr = document.createElement("tr");
    if (info.fds) tr.className = "dia-fds";
    tr.innerHTML = `
      <td class="col-dia">${String(info.dia).padStart(2, "0")} <span class="text-muted small">${DIAS_SEMANA[info.dow]}</span></td>
      <td><textarea class="form-control form-control-sm desc" rows="1" data-f="d" placeholder="${info.fds ? "" : "Descrever a atividade"}"></textarea></td>
      <td class="col-horas"><input type="number" min="0" max="24" step="0.25" class="form-control form-control-sm" data-f="h"></td>
      <td class="col-copiar"><button class="btn btn-sm btn-link p-0" title="Copiar descrição do dia anterior" data-copiar>↑</button></td>`;
    const inD = tr.querySelector('[data-f="d"]');
    const inH = tr.querySelector('[data-f="h"]');
    inD.value = d;
    inH.value = h;
    const marcar = () => inD.classList.toggle("sem-desc", !inD.value.trim() && Number(inH.value) > 0 && !!dias[info.dia]);
    inD.addEventListener("focus", () => ajustarAltura(inD, true));
    inD.addEventListener("blur", () => ajustarAltura(inD, false));
    inD.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
    inD.addEventListener("input", () => {
      if (/[\r\n]/.test(inD.value)) inD.value = inD.value.replace(/[\r\n]+/g, " ");
      ajustarAltura(inD, true);
      editar(info, { d: inD.value });
      marcar();
    });
    inH.addEventListener("input", () => { editar(info, { h: Number(inH.value) || 0 }); marcar(); });
    tr.querySelector("[data-copiar]").addEventListener("click", () => {
      const ant = dias[info.dia - 1]?.d;
      if (!ant) return;
      inD.value = ant;
      ajustarAltura(inD, document.activeElement === inD);
      editar(info, { d: ant });
      marcar();
    });
    tbody.appendChild(tr);
  }
  totais();
}

// Campo fechado: uma linha. Ao focar, cresce para mostrar o texto todo (mínimo de 4 linhas).
function ajustarAltura(ta, aberto) {
  ta.style.height = "auto";
  if (!aberto) { ta.style.height = ""; return; }
  const minimo = parseFloat(getComputedStyle(ta).lineHeight) * 4 + 12;
  ta.style.height = `${Math.max(ta.scrollHeight + 2, minimo)}px`;
}

function editar(info, campos) {
  dias[info.dia] = { ...dadosDoDia(info), ...campos };
  totais();
  agendarSave();
}

function totalHoras() {
  return diasDoMes().reduce((s, info) => s + dadosDoDia(info).h, 0);
}

function totais() {
  const h = totalHoras();
  $("total-horas").textContent = `${h.toLocaleString("pt-BR")}h`;
  $("total-valor").textContent = brl(h * valor);
}

function agendarSave() {
  setStatus("Salvando…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(salvar, 600);
}

async function salvar() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    await Promise.all([
      setDoc(refMes(mes), { dias }),
      setDoc(refConfig(), { nome }),
    ]);
    setStatus("Salvo");
  } catch (e) {
    console.error(e);
    setStatus("Erro ao salvar");
  }
}

// O valor hora fica só neste navegador (localStorage), nunca vai para o banco.
function lerValor(m) {
  try {
    return Number(localStorage.getItem(`valor:${m}`) ?? localStorage.getItem("valor")) || 0;
  } catch {
    return 0;
  }
}

function gravarValor(m, v) {
  try {
    localStorage.setItem(`valor:${m}`, v);
    localStorage.setItem("valor", v);
  } catch {}
}

let config = {};

async function carregarConfig() {
  const snap = await getDoc(refConfig());
  config = snap.exists() ? snap.data() : {};
  nome = config.nome ?? "";
  $("nome").value = nome;
}

async function carregarMes(novo) {
  if (saveTimer) await salvar();
  mes = novo;
  setStatus("Carregando…");
  const snap = await getDoc(refMes(mes));
  dias = snap.exists() ? snap.data().dias ?? {} : {};
  valor = lerValor(mes);
  $("mes").value = mes;
  $("valor").value = valor;
  render();
  setStatus("");
}

// ---------- chave da API e entradas pendentes ----------
// Um script com a chave deixa textos em users/{uid}/entrada (ver firestore.rules);
// aqui o dono revisa e só então eles entram no mês.

const refApi = () => doc(db, "users", uid, "config", "api");

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(texto) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto))));
}

async function copiar(botao, texto) {
  const rotulo = botao.textContent;
  try {
    await navigator.clipboard.writeText(texto);
    botao.textContent = "Copiado!";
  } catch {
    botao.textContent = "Copie manualmente";
  }
  setTimeout(() => { botao.textContent = rotulo; }, 1500);
}

async function mostrarPainelIa() {
  $("ia-prompt-box").classList.add("d-none");
  $("ia-prompt").value = "";
  const snap = await getDoc(refApi());
  const existe = snap.exists();
  $("ia-status").textContent = existe
    ? `Conexão ativa desde ${new Date(snap.data().criadaEm).toLocaleDateString("pt-BR")}. Para receber um novo prompt, gere uma nova conexão (a atual deixa de valer).`
    : "Nenhuma conexão gerada ainda.";
  $("btn-gerar-conexao").textContent = existe ? "Gerar nova conexão" : "Gerar conexão";
  $("btn-gerar-conexao").dataset.existe = existe ? "1" : "";
}

function montarPrompt(chave) {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${uid}/entrada?key=${firebaseConfig.apiKey}`;
  return `Você vai me ajudar a manter o meu Ponto Eletrônico (relatório mensal de horas que vai junto com a minha nota fiscal) sempre em dia.

## Como funciona
Todo dia útil, no início do dia, você me avisa e me mostra um texto sobre o que eu fiz no dia útil anterior, para eu revisar. Só depois que eu aprovar, você envia o texto para a minha caixa de entrada do Ponto Eletrônico. Eu então aceito o texto no site e ele entra no relatório.

## Passo 1 - Guardar a conexão (faça agora)
Salve os dados abaixo em um arquivo local meu, fora de qualquer repositório, com permissão só para mim (por exemplo ~/.ponto-eletronico.json com chmod 600). Nunca repita a chave em respostas, logs ou commits.

{
  "projectId": "${firebaseConfig.projectId}",
  "apiKey": "${firebaseConfig.apiKey}",
  "uid": "${uid}",
  "chave": "${chave}"
}

## Passo 2 - Lembrar todo dia
Guarde esta rotina na sua memória ou instruções persistentes: no primeiro contato de cada dia útil, ANTES de qualquer outra tarefa, pergunte "Vamos atualizar o seu ponto de ontem?" (na segunda-feira, considere a sexta). Se o texto desse dia já foi enviado, não pergunte de novo. Fins de semana só se eu avisar que trabalhei.

## Passo 3 - Escrever o texto do dia
Levante o que eu fiz naquele dia (commits, tarefas, PRs, reuniões, conversas) e escreva de 1 a 3 frases corridas, em um único parágrafo, com no máximo 2000 caracteres. Seja factual, em tom profissional (o texto vai para o cliente junto com a nota), sem exagerar e sem inventar resultado, número ou horas. Se não souber o que eu fiz, pergunte em vez de supor. Mostre o texto e espere eu revisar; se eu editar, use a minha versão.

## Passo 4 - Enviar só depois da minha aprovação
Faça um POST sem login para o endereço abaixo. Monte o JSON com uma ferramenta (jq ou python), nunca na mão, para escapar aspas e acentos. Leia a chave do arquivo do passo 1.

POST ${url}
Content-Type: application/json

{"fields": {
  "chave":     {"stringValue": "<chave do arquivo>"},
  "data":      {"stringValue": "AAAA-MM-DD do dia trabalhado"},
  "descricao": {"stringValue": "<texto aprovado>"}
}}

- Resposta 200: o texto ficou pendente. Me avise: "Enviado, aceite o texto no Ponto Eletrônico."
- Resposta 403: chave errada ou substituída por uma nova. Peça para eu gerar uma nova conexão no site.
- Envie um único texto por dia. Você não consegue ler nem alterar nada do meu ponto, só deixar textos pendentes.`;
}

async function gerarConexao() {
  if ($("btn-gerar-conexao").dataset.existe && !confirm("Gerar uma nova conexão? A atual deixa de funcionar na sua IA.")) return;
  const chave = hex(crypto.getRandomValues(new Uint8Array(32)));
  await setDoc(refApi(), { hash: await sha256Hex(chave), criadaEm: new Date().toISOString() });
  $("ia-prompt").value = montarPrompt(chave);
  $("ia-prompt-box").classList.remove("d-none");
  $("ia-status").textContent = "Conexão gerada agora. Copie o prompt e cole na sua IA.";
  $("btn-gerar-conexao").textContent = "Gerar nova conexão";
  $("btn-gerar-conexao").dataset.existe = "1";
}

function abrirPainelIa() {
  const painel = $("painel-ia");
  painel.classList.remove("d-none");
  mostrarPainelIa().catch(console.error);
  painel.scrollIntoView({ behavior: "smooth", block: "start" });
}

const dataValida = (a, m, d) => new Date(a, m - 1, d).getMonth() === m - 1 && new Date(a, m - 1, d).getDate() === d;

async function descricaoAtual(data) {
  const [a, m, d] = data.split("-").map(Number);
  const chaveMes = `${a}-${String(m).padStart(2, "0")}`;
  if (chaveMes === mes) return dias[d]?.d ?? "";
  const snap = await getDoc(refMes(chaveMes));
  return snap.exists() ? snap.data().dias?.[d]?.d ?? "" : "";
}

async function aplicarPendente(it, texto, acrescentar) {
  const [a, m, d] = it.data.split("-").map(Number);
  const chaveMes = `${a}-${String(m).padStart(2, "0")}`;
  const dow = new Date(a, m - 1, d).getDay();
  const info = { dia: d, fds: dow === 0 || dow === 6 };
  const juntar = (atual) => (acrescentar && atual.trim() ? `${atual.trim()} ${texto}` : texto);

  if (chaveMes === mes) {
    editar(info, { d: juntar(dadosDoDia(info).d) });
    await salvar();
    render();
  } else {
    const snap = await getDoc(refMes(chaveMes));
    const outros = snap.exists() ? snap.data().dias ?? {} : {};
    const atual = outros[d] ?? {};
    outros[d] = { d: juntar(atual.d ?? ""), h: atual.h ?? (info.fds ? 0 : HORAS_PADRAO) };
    await setDoc(refMes(chaveMes), { dias: outros });
  }
  await removerPendente(it);
}

const removerPendente = (it) => deleteDoc(doc(db, "users", uid, "entrada", it.id));

function cartaoPendente(it) {
  const [a, m, d] = it.data.split("-").map(Number);
  const valida = dataValida(a, m, d);
  const el = document.createElement("div");
  el.className = "list-group-item";

  const titulo = document.createElement("div");
  titulo.className = "small text-muted mb-1";
  titulo.textContent = valida
    ? `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a} ${DIAS_SEMANA[new Date(a, m - 1, d).getDay()]}`
    : `Data inválida: ${it.data}`;

  const area = document.createElement("textarea");
  area.className = "form-control form-control-sm mb-2";
  area.rows = 3;
  area.value = it.descricao;

  const nota = document.createElement("div");
  nota.className = "small text-warning-emphasis mb-2";

  const acoes = document.createElement("div");
  acoes.className = "d-flex gap-2";
  const botao = (rotulo, classe, fn) => {
    const b = document.createElement("button");
    b.className = `btn btn-sm ${classe}`;
    b.textContent = rotulo;
    b.addEventListener("click", async () => {
      b.disabled = true;
      try { await fn(); } catch (e) { console.error(e); alert("Não foi possível concluir. Tente de novo."); b.disabled = false; }
    });
    return b;
  };
  const aceitar = botao("Aceitar", "btn-success", async () => { await aplicarPendente(it, area.value.trim(), false); await carregarPendentes(); });
  const acrescentar = botao("Acrescentar ao texto atual", "btn-outline-success d-none", async () => { await aplicarPendente(it, area.value.trim(), true); await carregarPendentes(); });
  const descartar = botao("Descartar", "btn-outline-danger", async () => { await removerPendente(it); await carregarPendentes(); });
  acoes.append(aceitar, acrescentar, descartar);

  if (valida) {
    descricaoAtual(it.data).then((atual) => {
      if (!atual.trim()) return;
      nota.textContent = `Este dia já tem texto: "${atual}"`;
      aceitar.textContent = "Substituir";
      acrescentar.classList.remove("d-none");
    }).catch(() => {});
  } else {
    aceitar.disabled = true;
    acrescentar.disabled = true;
  }
  el.append(titulo, area, nota, acoes);
  return el;
}

async function carregarPendentes() {
  const snap = await getDocs(collection(db, "users", uid, "entrada"));
  const itens = snap.docs.map((x) => ({ id: x.id, ...x.data() })).sort((x, y) => String(x.data).localeCompare(String(y.data)));
  $("pendentes").classList.toggle("d-none", !itens.length);
  $("pendentes-qtd").textContent = itens.length;
  $("pendentes-lista").replaceChildren(...itens.map(cartaoPendente));
}

// ---------- xlsx ----------

const xmlEsc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function setCell(xml, ref, valorCelula) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>.*?</c>)`, "s");
  if (!re.test(xml)) throw new Error(`Célula ${ref} não encontrada no modelo`);
  return xml.replace(re, (_, attrs) => {
    const s = /\ss="(\d+)"/.exec(attrs);
    const estilo = s ? ` s="${s[1]}"` : "";
    if (valorCelula === null || valorCelula === "") return `<c r="${ref}"${estilo}/>`;
    if (typeof valorCelula === "number") return `<c r="${ref}"${estilo}><v>${valorCelula}</v></c>`;
    return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(valorCelula)}</t></is></c>`;
  });
}

function serialExcel(a, m, d) {
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

async function baixar() {
  if (saveTimer) await salvar();
  const [a, m] = mes.split("-").map(Number);
  const linhas = diasDoMes()
    .map((info) => ({ info, ...dadosDoDia(info) }))
    .filter((l) => l.d.trim() || l.h > 0);
  const max = ULTIMA_LINHA - PRIMEIRA_LINHA + 1;
  if (linhas.length > max) {
    alert(`O modelo comporta ${max} dias e há ${linhas.length} com horas ou descrição. Zere os fins de semana que não trabalhou.`);
    return;
  }
  if (!nome.trim()) {
    alert("Preencha o seu nome antes de baixar.");
    $("nome").focus();
    return;
  }
  const vazios = linhas.filter((l) => !l.d.trim()).length;
  if (vazios && !confirm(`${vazios} dia(s) com horas mas sem descrição. Baixar mesmo assim?`)) return;

  const zip = await JSZip.loadAsync(await (await fetch("template.xlsx")).arrayBuffer());
  let sheet = await zip.file("xl/worksheets/sheet1.xml").async("string");

  const nomeMes = MESES[m - 1];
  const nomeCompleto = nome.trim().replace(/\s+/g, " ");
  const assunto = `MTP - Atividades: ${nomeMes[0].toUpperCase()}${nomeMes.slice(1)} ${a} ${nomeCompleto}`;
  sheet = setCell(sheet, "F5", `Título do E-mail: ${assunto}`);
  sheet = setCell(sheet, "F6", `Exemplo: ${assunto}`);

  for (let r = PRIMEIRA_LINHA; r <= ULTIMA_LINHA; r++) {
    const l = linhas[r - PRIMEIRA_LINHA];
    sheet = setCell(sheet, `B${r}`, l ? serialExcel(a, m, l.info.dia) : null);
    sheet = setCell(sheet, `C${r}`, l ? l.d.trim() : null);
    sheet = setCell(sheet, `D${r}`, l && l.h > 0 ? l.h / 24 : null);
  }

  const horas = linhas.reduce((s, l) => s + l.h, 0);
  sheet = setCell(sheet, "D32", valor);
  // mantém as fórmulas e atualiza o valor em cache
  sheet = sheet
    .replace(/(<f[^>]*>SUM\(D6:D30\)<\/f><v>)[^<]*/, `$1${horas / 24}`)
    .replace(/(<f[^>]*>D32\*D31\*24<\/f><v>)[^<]*/, `$1${valor * horas}`);
  zip.file("xl/worksheets/sheet1.xml", sheet);

  let wb = await zip.file("xl/workbook.xml").async("string");
  wb = wb.replace(/(<sheet [^>]*name=")[^"]*"/, `$1${nomeMes}"`).replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"');
  zip.file("xl/workbook.xml", wb);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `MTP - Atividades - ${nomeMes} ${a} (${nomeCompleto.replace(/[\\/:*?"<>|]/g, "")}).xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ---------- eventos ----------

$("btn-login").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    $("login-erro").textContent = e.message;
  }
});
$("btn-sair").addEventListener("click", () => signOut(auth));
$("mes").addEventListener("change", (e) => e.target.value && carregarMes(e.target.value));
$("nome").addEventListener("input", (e) => { nome = e.target.value; agendarSave(); });
$("valor").addEventListener("input", (e) => { valor = Number(e.target.value) || 0; gravarValor(mes, valor); totais(); });
$("btn-baixar").addEventListener("click", baixar);
$("btn-ia").addEventListener("click", abrirPainelIa);
$("btn-conectar").addEventListener("click", abrirPainelIa);
$("btn-fechar-aviso").addEventListener("click", () => {
  $("aviso-ia").classList.add("d-none");
  try { localStorage.setItem("avisoIaFechado", "1"); } catch {}
});
$("btn-gerar-conexao").addEventListener("click", () => gerarConexao().catch((e) => { console.error(e); alert("Não foi possível gerar a conexão."); }));
$("btn-copiar-prompt").addEventListener("click", (e) => copiar(e.target, $("ia-prompt").value));
document.addEventListener("visibilitychange", () => { if (!document.hidden && uid) carregarPendentes().catch(console.error); });
window.addEventListener("beforeunload", (e) => { if (saveTimer) e.preventDefault(); });

onAuthStateChanged(auth, (user) => {
  uid = user?.uid ?? null;
  $("login").classList.toggle("d-none", !!user);
  $("app").classList.toggle("d-none", !user);
  try { $("aviso-ia").classList.toggle("d-none", localStorage.getItem("avisoIaFechado") === "1"); } catch {}
  if (user) carregarConfig().then(() => carregarMes(mes ?? mesAtual())).then(carregarPendentes).catch(console.error);
});
