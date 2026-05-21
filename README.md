# 語彙クイズ — Vocabulário Quiz (v8)

Web app de quiz de vocabulário japonês com listas pessoais de kanji.

## Novidades da v8

- **Botão "Aplicar top N em todos os kanji"** dentro do detalhe da lista:
  marca rapidamente as N palavras mais frequentes para todos os kanji,
  útil para listas grandes vindas de v7.
- **Aba Histórico**: registra automaticamente as últimas 50 sessões,
  com resumo (total, hoje, 7 dias) e detalhe por sessão.
- **Ordenação aprimorada**: verbos e adjetivos básicos têm prioridade
  pedagógica (alguns ainda não chegam ao top 10 — ver Limitações).

## Features acumuladas

- Sincronização GitHub via Personal Access Token (com merge inteligente).
- Auto-marcação configurável (10/15/25/50/todas).
- Botão re-aplicar top N por kanji ativo.
- Múltiplos significados visíveis.
- SRS leve, direção inversa, indicador de domínio, filtro "só erradas"
  e "pular dominadas".
- Lembrar último estado, salvar quiz interrompido.
- Renomear/excluir listas, modal próprio, modo escuro.
- Backup local (arquivo JSON).

## Limitações conhecidas

- A frequência das palavras vem do JMdict (corpus jornalístico). Verbos
  cotidianos como 食べる, 見る podem aparecer fora do top 10 em alguns kanji.
- Histórico não inclui detalhes (quais palavras erradas), só resumo.

## Atalhos (quiz)

- `1`-`4`: alternativa
- `Espaço`/`Enter`: próxima
