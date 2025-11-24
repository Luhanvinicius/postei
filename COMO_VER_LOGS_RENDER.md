# Como Ver Logs no Render

## Onde Ver os Logs

1. **Acesse o Dashboard do Render**: https://dashboard.render.com
2. **Selecione seu serviço** (ex: `postei`)
3. **Clique em "Logs"** no menu lateral (seção MONITOR)

## Como Ver Logs em Tempo Real

### Opção 1: Live Tail (se disponível)

1. Na página de Logs, procure por **"Cauda viva"** ou **"Live tail"** no canto superior direito
2. Pode estar em um dropdown ou toggle
3. Se não encontrar, os logs aparecem automaticamente (atualize a página)

### Opção 2: Atualizar Manualmente

1. Clique em **F5** ou atualize a página
2. Os logs mais recentes aparecerão no topo
3. Role para cima para ver os logs mais recentes

### Opção 3: Usar o Shell do Render

1. No menu lateral, clique em **"Concha"** (Shell)
2. Execute: `tail -f /proc/1/fd/1` (se disponível)
3. Ou apenas observe os logs na página principal

## O que Procurar nos Logs

Quando você clicar em "Gerar com IA", procure por estas mensagens nos logs:

### 1. Início da Geração
```
🎬 ===== INICIANDO GERAÇÃO DE CONTEÚDO =====
📹 Vídeo: [nome do vídeo]
📁 Caminho: [caminho do vídeo]
```

### 2. Extração de Frames
```
📸 ===== EXTRAINDO FRAMES DO VÍDEO =====
📸 Caminho do vídeo: [caminho]
📸 Vídeo existe? true/false
✅ X frames extraídos com sucesso!
```

### 3. Modo Visual ou Texto
```
👁️  ===== MODO VISUAL ATIVO =====
👁️  GEMINI VISION ATIVO! Analisando X frames do vídeo
```

OU

```
⚠️  Nenhum frame disponível para [nome], usando modo texto
```

### 4. Resposta do Gemini
```
✅ Resposta recebida do Gemini!
📝 Resposta completa: [resposta]
✅ Título extraído: [título]
✅ Descrição extraída: [descrição]
```

### 5. Resultado Final
```
✅ ===== RESULTADO FINAL =====
✅ Título: [título]
✅ Descrição: [descrição]
✅ Thumbnail: [caminho]
```

## Filtrar Logs

Use a barra de pesquisa (Q Search) para filtrar:
- `Gerando` - para ver logs de geração
- `Gemini` - para ver logs do Gemini
- `Frame` - para ver logs de frames
- `Título` - para ver logs de título
- `Erro` ou `❌` - para ver erros

## Se Não Estiver Vendo Logs

1. **Atualize a página** (F5) - os logs aparecem automaticamente
2. **Verifique se o serviço está rodando** (status deve ser "Live" ou "Ativo")
3. **Role para cima** na página de logs para ver os mais recentes
4. **Tente gerar conteúdo novamente** e observe os logs (atualize a página após alguns segundos)
5. **Use a busca** (Q Procurar) para filtrar por palavras-chave como "Gerando", "Gemini", "Frame"

## Logs Importantes para Debug

Se algo não estiver funcionando, procure por:
- `❌` - Erros
- `⚠️` - Avisos
- `✅` - Sucessos
- `📸` - Relacionados a frames/thumbnails
- `👁️` - Modo visual
- `🤖` - Gemini API

## Dica

Os logs no Render podem ter um pequeno delay. Se você não ver os logs imediatamente:
1. **Aguarde 5-10 segundos** após clicar em "Gerar com IA"
2. **Atualize a página** (F5)
3. **Role para cima** para ver os logs mais recentes
4. **Use a busca** para filtrar: digite "Gerando" ou "Gemini" na barra de busca

## Como Testar Agora

1. **Mantenha a página de Logs aberta**
2. **Em outra aba**, acesse sua aplicação (https://www.postei.pro)
3. **Faça login** e vá em "Gerenciar Vídeos"
4. **Clique em "Gerar com IA"** em um vídeo
5. **Volte para a aba de Logs** e **atualize a página** (F5)
6. **Procure pelas mensagens** listadas acima

