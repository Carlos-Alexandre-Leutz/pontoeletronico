# Ponto Eletrônico

Lista os dias do mês, você escreve o que fez e baixa o `.xlsx` da MTP preenchido.
Os dados ficam no Firebase (Firestore), então não se perdem ao limpar o histórico.

## Configurar o Firebase (uma vez)

1. https://console.firebase.google.com → **Adicionar projeto**.
2. **Build → Authentication → Começar → Google** → ativar.
   Em **Settings → Authorized domains**, confira que o domínio onde a página está publicada (ex.: `usuario.github.io`) está na lista; `localhost` já vem.
3. **Build → Firestore Database → Criar banco** (modo produção).
   Na aba **Regras**, cole o conteúdo de `firestore.rules` e publique.
4. **Configurações do projeto → Seus apps → Web (`</>`)** → registre o app e copie o `firebaseConfig` para `firebase-config.js`.

## Uso

- Escolha o mês, ajuste o valor hora e escreva a descrição de cada dia (padrão 8h em dias úteis, 0h em fins de semana).
- `↑` copia a descrição do dia anterior.
- Tudo salva sozinho. No fim do mês, **Baixar .xlsx**.
- `template.xlsx` é o modelo; se a MTP mudar o layout, troque o arquivo (as células usadas estão em `app.js`).

Para testar local: `python3 -m http.server` na pasta e abrir `http://localhost:8000`.
