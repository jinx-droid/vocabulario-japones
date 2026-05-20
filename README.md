# 語彙クイズ — Vocabulário Quiz (v6)

Web app de quiz de vocabulário japonês, com listas pessoais por kanji,
SRS leve, e sincronização entre dispositivos via GitHub.

## Sincronização em nuvem (GitHub)

A v6 adiciona sync automática via repositório GitHub privado seu, sem OAuth.

### Configuração única

1. **Criar repositório privado no GitHub**
   - github.com → "New" → nome: `vocab-quiz-backup` (ou outro)
   - Marcar como **Private**, marcar "Add a README file"
   - "Create repository"

2. **Gerar Personal Access Token**
   - github.com → foto no canto superior direito → Settings
   - Final do menu lateral → Developer settings
   - Personal access tokens → Fine-grained tokens
   - "Generate new token":
     - Token name: "Vocab Quiz Sync"
     - Expiration: 1 year
     - Repository access: Only select repositories → escolha o repo criado
     - Permissions → Repository permissions → Contents: **Read and write**
   - "Generate token"
   - **Copie o token AGORA** (começa com `github_pat_...`). Não vai ser
     possível ver de novo depois.

3. **Configurar no app**
   - Aba Listas → seção "Sincronização em nuvem" → "configurar"
   - Preencha: usuário GitHub, nome do repositório, e o token
   - "Salvar configuração"

### Uso diário

- Toque em "↻ Sincronizar agora" antes de mudar de dispositivo.
- No outro dispositivo, toque em "↻ Sincronizar agora" para puxar as mudanças.
- Merge é por entidade (lista por lista, palavra por palavra), com last-write-wins.
- Se houver conflito em entidades específicas, vence a mais recente.

### Privacidade

- O repositório é privado.
- O token tem permissão restrita só a Contents desse repo (não acessa
  outros repos nem informações de conta).
- O token fica no localStorage do navegador. Use "Desconectar" para removê-lo.
- Se perder o celular: revogue o token no GitHub
  (Settings → Developer settings → token → Revoke).

## Features acumuladas

- Múltiplos significados visíveis ao explorar e no feedback do quiz.
- Auto-marcação das 15 palavras mais frequentes ao adicionar um kanji.
- Ordenação por frequência real (JMdict `nfXX`, `ichi1`, etc.).
- SRS leve (peso por acertos/erros).
- Direção inversa do quiz (significado → kanji).
- Indicador visual de domínio (bolinhas).
- Filtro "Só erradas" para revisão.
- Lembrar último estado ao reabrir.
- Backup local via arquivo JSON.
- **NOVO**: Sincronização entre dispositivos via GitHub.

## Hospedagem do app

GitHub Pages: `index.html`, `style.css`, `app.js`, `words.json`, `index.json`.
Settings → Pages → branch main, pasta root.

## Atalhos (quiz)

- `1`-`4`: alternativa
- `Espaço` / `Enter`: próxima
