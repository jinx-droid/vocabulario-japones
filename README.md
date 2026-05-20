# 語彙クイズ — Vocabulário Quiz (v7)

Web app de quiz de vocabulário japonês com listas pessoais de kanji,
SRS leve, sincronização entre dispositivos via GitHub.

## Novidades da v7

- **Renomear listas**: botão ✎ ao lado do título da lista.
- **Configurar quantidade auto-marcada**: seletor ao lado de "Adicionar"
  na tela de detalhe (10, 15, 25, 50, todas, ou desligado).
- **Botão "Marcar N top"**: força re-aplicação da auto-marcação em um
  kanji já adicionado.
- **Filtro "Pular dominadas"**: novo modo de prática que exclui palavras
  já dominadas (≥3 acertos com taxa ≥80%).
- **Estatística por lista**: cabeçalho mostra breakdown visual de domínio
  (verde/amarelo/vermelho/cinza).
- **Salvar quiz interrompido**: se você sair de um quiz no meio,
  pode retomar de onde parou na próxima vez.
- **Modal próprio**: confirmações e prompts usam visual do app em vez
  dos diálogos padrão do navegador.
- **Modo escuro**: botão ☾/☀ no canto superior direito.

## Features acumuladas

- Sincronização GitHub via Personal Access Token.
- Auto-marcação das palavras mais frequentes ao adicionar kanji.
- Ordenação por frequência real (JMdict nfXX/ichi1/news1).
- Múltiplos significados visíveis.
- SRS leve.
- Direção inversa do quiz.
- Indicador visual de domínio (bolinhas).
- Filtro "Só erradas".
- Lembrar último estado.
- Backup local (arquivo JSON).

## Sincronização GitHub

Veja seções de configuração no README anterior (cria repo privado, gera
fine-grained PAT com permissão Contents: Read and write, configura no app).
