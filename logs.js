import { collection, addDoc, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Registra erros na coleção "logs" (só o admin lê). Limitado para um erro
// em loop não encher o banco.
const MAX_POR_SESSAO = 5;
const vistos = new Set();

export function iniciarLogs(db, pegarUid) {
  const registrar = (origem, erro) => {
    const mensagem = String(erro?.message ?? erro ?? "").slice(0, 500);
    if (!mensagem || vistos.size >= MAX_POR_SESSAO || vistos.has(`${origem}:${mensagem}`)) return;
    vistos.add(`${origem}:${mensagem}`);
    addDoc(collection(db, "logs"), {
      origem: String(origem).slice(0, 60),
      mensagem,
      pagina: location.pathname.slice(0, 200),
      uid: pegarUid() ?? "",
      em: new Date().toISOString(),
    }).catch(() => {}); // o log nunca pode gerar outro erro
  };
  window.addEventListener("error", (e) => registrar("erro", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => registrar("promessa", e.reason));
  return registrar;
}

export const ADMIN_EMAIL = "tercmtcarlosl@gmail.com";

const lerVisto = (tipo) => { try { return localStorage.getItem(`adminVisto:${tipo}`) ?? ""; } catch { return ""; } };

export function marcarVisto(tipo) {
  try { localStorage.setItem(`adminVisto:${tipo}`, new Date().toISOString()); } catch {}
}

// Quantos logs e sugestões chegaram desde a última vez que o admin abriu cada aba.
export async function contarNovos(db) {
  const novos = (tipo) => getDocs(query(collection(db, tipo), where("em", ">", lerVisto(tipo)), limit(100)));
  const [l, s] = await Promise.all([novos("logs"), novos("sugestoes")]);
  return { logs: l.size, sugestoes: s.size };
}
