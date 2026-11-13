import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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
      <td><input class="form-control form-control-sm" data-f="d" placeholder="${info.fds ? "" : "Descrever a atividade"}"></td>
      <td class="col-horas"><input type="number" min="0" max="24" step="0.25" class="form-control form-control-sm" data-f="h"></td>
      <td class="col-copiar"><button class="btn btn-sm btn-link p-0" title="Copiar descrição do dia anterior" data-copiar>↑</button></td>`;
    const inD = tr.querySelector('[data-f="d"]');
    const inH = tr.querySelector('[data-f="h"]');
    inD.value = d;
    inH.value = h;
    const marcar = () => inD.classList.toggle("sem-desc", !inD.value.trim() && Number(inH.value) > 0 && !!dias[info.dia]);
    inD.addEventListener("input", () => { editar(info, { d: inD.value }); marcar(); });
    inH.addEventListener("input", () => { editar(info, { h: Number(inH.value) || 0 }); marcar(); });
    tr.querySelector("[data-copiar]").addEventListener("click", () => {
      const ant = dias[info.dia - 1]?.d;
      if (!ant) return;
      inD.value = ant;
      editar(info, { d: ant });
      marcar();
    });
    tbody.appendChild(tr);
  }
  totais();
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
window.addEventListener("beforeunload", (e) => { if (saveTimer) e.preventDefault(); });

onAuthStateChanged(auth, (user) => {
  uid = user?.uid ?? null;
  $("login").classList.toggle("d-none", !!user);
  $("app").classList.toggle("d-none", !user);
  if (user) carregarConfig().then(() => carregarMes(mes ?? mesAtual()));
});
