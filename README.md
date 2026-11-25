# Horômetro

**Conheça e use:** https://carlos-alexandre-leutz.github.io/pontoeletronico/

Fiz esta página para mim e para as outras pessoas que trabalham na MTP criarem o relatório de horas mensal.

## O problema

Todo mês era preciso montar a planilha de atividades e horas para enviar junto com a nota fiscal. Dava trabalho, era chato e tinha que ser refeito do zero a cada mês, na hora de fechar, tentando lembrar o que foi feito em cada dia.

## Como resolve

Ao longo do mês, você só anota o que foi fazendo em cada dia. Não precisa fazer mais nada. No fim do mês, um botão gera o arquivo da MTP já preenchido, pronto para enviar.

## Privacidade

O valor hora fica salvo só no navegador de cada pessoa (local storage) e nunca vai para o banco. Assim ninguém sabe quanto o outro ganha.

## Conectar a sua IA (preencher o ponto automaticamente)

A tela principal continua sendo o relatório manual. Opcionalmente, você conecta a sua IA para ela te avisar todo início do dia e escrever o texto do dia anterior:

1. No site, clique em **Conectar IA → Gerar conexão**. Aparece um **prompt completo** com a sua conexão.
2. Cole o prompt na sua IA (Claude, Copilot, ChatGPT...). Ela guarda a conexão e passa a perguntar todo dia útil sobre o dia anterior.
3. Você revisa o texto. Depois da sua aprovação, a IA envia para cá e o texto aparece como **pendente**: você aceita, edita ou descarta. Se o dia já tiver texto, o botão vira **Substituir** e há também **Acrescentar ao texto atual**.

A chave só consegue **criar** entradas pendentes: não lê, não altera e não apaga nada do seu ponto. O banco guarda só o hash dela e a chave aparece uma única vez, dentro do prompt. Gerar uma nova conexão invalida a anterior.

O envio é um POST sem login na caixa de entrada do seu usuário (o prompt já traz o endereço e o formato):

```
POST https://firestore.googleapis.com/v1/projects/<projectId>/databases/(default)/documents/users/<uid>/entrada?key=<apiKey do firebase-config.js>

{ "fields": {
    "chave":     { "stringValue": "<sua chave>" },
    "data":      { "stringValue": "2026-11-25" },
    "descricao": { "stringValue": "Texto do dia" } } }
```

As regras que garantem isso estão em `firestore.rules` e precisam ser publicadas no Firebase (`npx firebase deploy --only firestore:rules --project <projectId>`).

## Testes das regras

Os testes rodam no emulador do Firestore, sem tocar no Firebase de verdade. Precisam de Node 18+ e Java 11+.

```
npm install
npm test
```

Cobrem o isolamento entre usuários (ninguém lê, lista, altera nem apaga os dados de outro, nem com buscas por todos os usuários), a validação da chave e do conteúdo da caixa de entrada, e o acesso total do dono aos próprios dados. Rode de novo sempre que mudar o `firestore.rules`.
