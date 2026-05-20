# 語彙クイズ — Vocabulário Quiz (v5)

Web app de quiz de vocabulário japonês, organizado por listas pessoais de kanji,
com dados de frequência reais.

## Novidades da v5

- **Auto-marcação por frequência**: ao adicionar um kanji a uma lista, as 15
  palavras mais frequentes que o utilizam são marcadas automaticamente. Zero
  cliques para começar a estudar.
- **Ordenação por frequência real**: as palavras agora aparecem na ordem
  em que aparecem no japonês moderno (baseado em corpus de notícias e
  prioridade JMdict), em vez de ordenação por posição/tamanho.

## Features acumuladas

- Múltiplos significados visíveis ao explorar e no feedback do quiz.
- SRS leve (peso por acertos/erros).
- Direção inversa do quiz (significado → kanji).
- Indicador visual de domínio (bolinhas de cor).
- Filtro "Só erradas" para revisão focada.
- Lembrar último estado ao reabrir.
- Backup via arquivo JSON (sincronização manual entre dispositivos).

## Fluxo de uso

1. **Listas** → criar uma lista.
2. Adicionar kanji (cole um bloco ou um por vez) — **15 palavras já vêm
   marcadas automaticamente para cada kanji novo**.
3. Tocar em qualquer kanji da lista para ajustar marcações se quiser.
4. **Estudar** → configurar e iniciar quiz.

## Hospedagem

GitHub Pages: suba `index.html`, `style.css`, `app.js`, `words.json`,
`index.json`. Settings → Pages → branch main, pasta root.

## Privacidade

Tudo em `localStorage`. Backup só local.

## Fonte dos dados

JMdict (eng-common) + dados de frequência do JMdict XML completo
(tags `nfXX`, `ichi1`, `news1`, `spec1`). Mantido pelo EDRDG, CC BY-SA 4.0.

## Atalhos (quiz)

- `1`-`4`: alternativa
- `Espaço` / `Enter`: próxima
