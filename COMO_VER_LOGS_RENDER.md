# Como Ver Logs no Render

## Onde Ver os Logs

1. **Acesse o Dashboard do Render**: https://dashboard.render.com
2. **Selecione seu serviço** (ex: `postei`)
3. **Clique em "Logs"** no menu lateral (seção MONITOR)

## Como Ver Logs em Tempo Real

1. Na página de Logs, ative o toggle **"Live tail"** (canto superior direito)
2. Os logs aparecerão em tempo real conforme o servidor processa requisições

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

1. **Verifique se o "Live tail" está ativado**
2. **Atualize a página** (F5)
3. **Verifique se o serviço está rodando** (status deve ser "Live")
4. **Tente gerar conteúdo novamente** e observe os logs em tempo real

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
1. Aguarde 5-10 segundos
2. Atualize a página
3. Verifique se o "Live tail" está ativado

