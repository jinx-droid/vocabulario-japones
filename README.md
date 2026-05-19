# 語彙クイズ — Vocabulário Quiz (v4)

Web app de quiz de vocabulário japonês, organizado por listas pessoais de kanji.

## Novidades da v4

- **Indicador visual de domínio**: cada palavra mostra uma bolinha colorida:
  • sem cor = nunca vista
  • amarela = vista, mas inconsistente
  • verde = dominada (≥3 acertos com taxa ≥80%)
  • vermelha = erra mais do que acerta
- **Filtro "Só erradas"** na configuração de quiz: pratica apenas palavras
  com pelo menos um erro registrado. Útil para revisão focada.
- **Lembrar último estado**: ao reabrir o app, retoma na última lista
  e kanji que você estava vendo.

## Outras features (vindas da v3)

- Múltiplos significados visíveis.
- SRS leve (peso por acertos/erros).
- Direção inversa do quiz (significado → kanji).
- Backup/sync via arquivo JSON (Listas → Exportar tudo / Importar).

## Fluxo de uso

1. **Listas** → criar uma lista (ex: "JLPT N5 - lição 3").
2. Adicionar kanji à lista (cole um bloco ou um por vez).
3. Tocar em cada kanji → marcar com ♡ as palavras a estudar.
4. **Estudar** → configurar fonte, direção, modo, filtro, quantidade.
5. Quiz mostra acerto/erro com feedback rico.

## Hospedagem

Suba os 5 arquivos (`index.html`, `style.css`, `app.js`, `words.json`,
`index.json`) num repositório público no GitHub. Settings → Pages →
branch `main`, pasta `/(root)`. Após 1-2 minutos, URL acessível.

## Privacidade

Tudo em `localStorage`. Backup só é gerado/lido localmente.

## Atalhos (quiz)

- `1`-`4`: alternativa
- `Espaço` / `Enter`: próxima
