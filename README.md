# 語彙クイズ — Vocabulário Quiz (v3)

Web app de quiz de vocabulário japonês, organizado por listas pessoais de kanji.

## Novidades da v3

- **Múltiplos significados visíveis**: palavras com vários sentidos exibem todos
  ao explorar e ao receber o feedback do quiz.
- **SRS leve**: o quiz prioriza palavras que você errou ou nunca viu, evitando
  desperdiçar tempo com palavras já dominadas. Pode ser desligado nas opções.
- **Direção inversa**: além do tradicional kanji → significado/leitura, agora
  tem significado/leitura → kanji (recall ativo).
- **Backup/sync via arquivo**: exporte um JSON com tudo (listas, palavras
  marcadas, estatísticas), importe em outro dispositivo. Sincronização manual.

## Fluxo de uso

1. **Listas** → criar uma lista (ex: "JLPT N5 - lição 3").
2. Adicionar kanji à lista (cole um bloco ou um por vez).
3. Tocar em cada kanji → marcar com ♡ as palavras a estudar.
4. **Estudar** → escolher fonte, direção, modo e quantidade.
5. Quiz mostra acerto/erro com feedback rico (todos os significados, leitura).

## Backup entre dispositivos

- **Exportar**: na aba Listas, botão "Exportar tudo" → baixa um arquivo
  `vocab-backup-AAAA-MM-DD.json`.
- **Importar**: no outro dispositivo, transfira o arquivo (Drive, e-mail,
  AirDrop, etc.) e use "Importar…". Opção de mesclar ou substituir.

## Estrutura técnica

```
words.json   18.000 palavras (JMdict eng-common), ~1.9 MB
index.json   índice kanji → palavras, ~210 KB
app.js       lógica do app
style.css    visual editorial japonês
index.html   estrutura
```

JMdict mantido pelo EDRDG, licença CC BY-SA 4.0.

## Hospedagem no GitHub Pages

1. Repositório público no GitHub.
2. Upload de: `index.html`, `style.css`, `app.js`, `words.json`, `index.json`.
3. Settings → Pages → branch `main`, pasta `/(root)`.
4. URL fica acessível após 1-2 minutos.

## Privacidade

Tudo em `localStorage` do navegador. O arquivo de backup é gerado e
lido localmente — nada é enviado para servidor externo.

## Atalhos de teclado (no quiz)

- `1`-`4`: escolher alternativa
- `Espaço` / `Enter`: próxima pergunta
