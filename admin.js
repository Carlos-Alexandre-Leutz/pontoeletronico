import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { ADMIN_EMAIL, contarNovos, marcarVisto } from "./logs.js";

const $ = (id) => document.getElementById(id);
const auth = getAuth(initializeApp(firebaseConfig));
const db = getFirestore();

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const mostrarErro = (e) => { console.error(e); $("erro").textContent = `Erro: ${e.message}`; };

function linha(...filhos) {
  const el = document.createElement("div");
  el.className = "list-group-item";
  el.append(...filhos);
  return el;
}

function texto(classe, conteudo, tag = "div") {
  const el = document.createElement(tag);
  el.className = classe;
  el.textContent = conteudo;
  return el;
}

function botaoApagar(rotulo, fn) {
  const b = document.createElement("button");
  b.className = "btn btn-sm btn-outline-danger";
  b.textContent = rotulo;
  b.addEventListener("click", async () => {
    b.disabled = true;
    try { await fn(); } catch (e) { if (e.message !== "cancelado") mostrarErro(e); b.disabled = false; }
  });
  return b;
}

// ---------- usuários ----------

let usuarios = [];

async function carregarUsuarios() {
  const snap = await getDocs(collection(db, "usuarios"));
  usuarios = snap.docs.map((x) => ({ uid: x.id, ...x.data() }));
  usuarios.sort((a, b) => (a.meses?.length ?? 0) - (b.meses?.length ?? 0) || String(a.ultimoAcesso).localeCompare(String(b.ultimoAcesso)));
  $("n-usuarios").textContent = usuarios.length;
  renderUsuarios();
}

function renderUsuarios() {
  const soSemUso = $("so-sem-uso").checked;
  const lista = usuarios.filter((u) => !soSemUso || !(u.meses?.length));
  const semUso = usuarios.filter((u) => !(u.meses?.length)).length;
  $("resumo-usuarios").textContent = `${usuarios.length} conta(s), ${semUso} sem nenhum mês salvo`;
  const tbody = $("lista-usuarios");
  tbody.replaceChildren(...lista.map((u) => {
    const tr = document.createElement("tr");
    const celula = (conteudo, classe = "") => {
      const td = document.createElement("td");
      td.className = classe;
      if (conteudo instanceof Node) td.append(conteudo); else td.textContent = conteudo;
      return td;
    };
    const n = u.meses?.length ?? 0;
    const apagar = botaoApagar("Excluir dados", async () => {
      if (!confirm(`Apagar todos os dados de ${u.email}? Isso não pode ser desfeito. A pessoa ainda poderá entrar e usar de novo.`)) throw new Error("cancelado");
      await excluirUsuario(u.uid);
      usuarios = usuarios.filter((x) => x.uid !== u.uid);
      $("n-usuarios").textContent = usuarios.length;
      renderUsuarios();
    });
    tr.append(celula(u.nome || "—"), celula(u.email), celula(String(n), `text-end ${n ? "" : "text-danger"}`), celula(fmt(u.ultimoAcesso)), celula(apagar));
    return tr;
  }));
}

// Apaga tudo de users/{uid} (meses, config, entrada) e o resumo. A conta de login não é tocada.
async function excluirUsuario(uid) {
  for (const sub of ["meses", "config", "entrada"]) {
    const snap = await getDocs(collection(db, "users", uid, sub));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
  await deleteDoc(doc(db, "usuarios", uid));
}

// ---------- logs e sugestões ----------

async function carregarLogs() {
  const snap = await getDocs(query(collection(db, "logs"), orderBy("em", "desc"), limit(200)));
  const itens = snap.docs.map((x) => ({ ref: x.ref, ...x.data() }));
  $("resumo-logs").textContent = `${itens.length} registro(s), os mais recentes primeiro`;
  $("lista-logs").replaceChildren(...(itens.length ? itens.map((l) => {
    const el = linha(
      texto("small text-muted", `${fmt(l.em)} · ${l.origem} · ${l.pagina}${l.uid ? ` · usuário ${l.uid}` : ""}`),
      texto("texto-longo font-monospace small", l.mensagem),
    );
    const apagar = botaoApagar("Apagar", async () => { await deleteDoc(l.ref); el.remove(); });
    apagar.classList.add("mt-1");
    el.append(apagar);
    return el;
  }) : [linha(texto("text-muted small", "Nenhum erro registrado."))]));
}

async function carregarSugestoes() {
  const snap = await getDocs(query(collection(db, "sugestoes"), orderBy("em", "desc"), limit(200)));
  const itens = snap.docs.map((x) => ({ ref: x.ref, ...x.data() }));
  $("lista-sugestoes").replaceChildren(...(itens.length ? itens.map((s) => {
    const el = linha(texto("small text-muted", `${fmt(s.em)} · ${s.email}`), texto("texto-longo", s.texto));
    const apagar = botaoApagar("Apagar", async () => { await deleteDoc(s.ref); el.remove(); });
    apagar.classList.add("mt-1");
    el.append(apagar);
    return el;
  }) : [linha(texto("text-muted small", "Nenhuma sugestão ainda."))]));
}

$("limpar-logs").addEventListener("click", async () => {
  if (!confirm("Apagar todos os registros de erro?")) return;
  try {
    const snap = await getDocs(collection(db, "logs"));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await carregarLogs();
  } catch (e) { mostrarErro(e); }
});

$("so-sem-uso").addEventListener("change", renderUsuarios);

// ---------- abas e sino ----------

async function atualizarBadges() {
  const n = await contarNovos(db);
  for (const [tipo, qtd] of [["logs", n.logs], ["sugestoes", n.sugestoes]]) {
    $(`n-${tipo}`).textContent = qtd;
    $(`n-${tipo}`).classList.toggle("d-none", !qtd);
  }
}

async function abrirAba(nome) {
  $("erro").textContent = "";
  for (const b of document.querySelectorAll("[data-aba]")) b.classList.toggle("active", b.dataset.aba === nome);
  for (const a of ["usuarios", "logs", "sugestoes"]) $(`aba-${a}`).classList.toggle("d-none", a !== nome);
  try {
    if (nome === "usuarios") await carregarUsuarios();
    if (nome === "logs") { await carregarLogs(); marcarVisto("logs"); $("n-logs").classList.add("d-none"); }
    if (nome === "sugestoes") { await carregarSugestoes(); marcarVisto("sugestoes"); $("n-sugestoes").classList.add("d-none"); }
  } catch (e) { mostrarErro(e); }
}

for (const b of document.querySelectorAll("[data-aba]")) b.addEventListener("click", () => abrirAba(b.dataset.aba));

onAuthStateChanged(auth, (user) => {
  $("carregando").classList.add("d-none");
  const admin = !!user && user.emailVerified && user.email === ADMIN_EMAIL;
  $("painel").classList.toggle("d-none", !admin);
  $("negado").classList.toggle("d-none", admin);
  if (admin) {
    abrirAba("usuarios");
    atualizarBadges().catch(mostrarErro);
  }
});
