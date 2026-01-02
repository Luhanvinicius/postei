const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');

// Tentar usar bibliotecas que incluem os binários do FFmpeg diretamente
// Se não estiverem disponíveis (erro no deploy), usar do sistema
console.log('🔧 Configurando FFmpeg e FFprobe...');

let ffmpegPath = null;
let ffprobePath = null;

// Tentar usar ffmpeg-static
try {
  const ffmpegStatic = require('ffmpeg-static');
  if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
    ffmpegPath = ffmpegStatic;
    console.log(`✅ FFmpeg configurado via ffmpeg-static: ${ffmpegStatic}`);
  }
} catch (err) {
  console.warn('⚠️  ffmpeg-static não disponível, tentando usar do sistema:', err.message);
}

// Tentar usar ffprobe-static
try {
  const ffprobeStatic = require('ffprobe-static');
  if (ffprobeStatic && ffprobeStatic.path) {
    ffmpeg.setFfprobePath(ffprobeStatic.path);
    ffprobePath = ffprobeStatic.path;
    console.log(`✅ FFprobe configurado via ffprobe-static: ${ffprobeStatic.path}`);
  }
} catch (err) {
  console.warn('⚠️  ffprobe-static não disponível, tentando usar do sistema:', err.message);
}

// Se não conseguiu configurar, tentar usar do sistema (PATH)
if (!ffmpegPath) {
  console.log('ℹ️  Tentando usar FFmpeg do sistema (PATH)');
}

if (!ffprobePath) {
  console.log('ℹ️  Tentando usar FFprobe do sistema (PATH)');
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// VALIDAÇÃO DO MÓDULO GEMINI
let genAI = null;
let geminiModuleAvailable = false;

try {
  // Verificar se o módulo está instalado
  const geminiModule = require('@google/generative-ai');
  geminiModuleAvailable = !!geminiModule;
  console.log('✅ Módulo @google/generative-ai está instalado');
  
  if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('✅ Gemini API inicializada com sucesso');
  } else {
    console.warn('⚠️  GEMINI_API_KEY não configurada');
  }
} catch (err) {
  console.error('❌ ERRO: Módulo @google/generative-ai NÃO está instalado!');
  console.error('   Erro:', err.message);
  console.error('   Stack:', err.stack);
  console.error('   SOLUÇÃO: Execute "npm install @google/generative-ai"');
  geminiModuleAvailable = false;
  genAI = null;
}

// Função para garantir que FFmpeg está configurado
function ensureFFmpegConfigured() {
  // Verificar se FFmpeg está disponível (pode ser do sistema ou estático)
  // Não bloquear se não estiver, apenas avisar
  console.log('ℹ️  Verificando disponibilidade do FFmpeg...');
}

// Extrair frames do vídeo
async function extractVideoFrames(videoPath, numFrames = 3) {
  console.log(`📸 Iniciando extração de frames de: ${videoPath}`);
  
  // Garantir que FFmpeg está configurado antes de usar
  try {
    ensureFFmpegConfigured();
  } catch (error) {
    console.error('❌', error.message);
    return [];
  }
  
  if (!fs.existsSync(videoPath)) {
    console.error(`❌ Vídeo não encontrado: ${videoPath}`);
    return [];
  }

  try {
    const tempDir = path.join(__dirname, '../temp_frames');
    fs.ensureDirSync(tempDir);

    const videoName = path.basename(videoPath, path.extname(videoPath));
    const frames = [];

    return new Promise((resolve, reject) => {
      console.log(`🔍 Analisando vídeo: ${videoPath}`);
      
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          console.error('❌ Erro ao analisar vídeo:', err);
          return resolve([]);
        }

        const duration = metadata.format.duration;
        console.log(`⏱️  Duração do vídeo: ${duration.toFixed(2)} segundos`);
        
        if (!duration || duration <= 0) {
          console.error('❌ Duração inválida do vídeo');
          return resolve([]);
        }

        const frameTimes = [];

        if (numFrames === 1) {
          frameTimes.push(duration / 2);
        } else if (numFrames === 2) {
          frameTimes.push(duration * 0.25, duration * 0.75);
        } else {
          // Extrair frames em momentos estratégicos: início, meio e fim
          frameTimes.push(duration * 0.1, duration / 2, duration * 0.9);
        }
        
        console.log(`📅 Momentos para extrair frames: ${frameTimes.map(t => t.toFixed(2) + 's').join(', ')}`);

        let processed = 0;
        frameTimes.forEach((time, index) => {
          const framePath = path.join(tempDir, `${videoName}_frame_${index + 1}.jpg`);
          console.log(`📸 Extraindo frame ${index + 1}/${frameTimes.length} em ${time.toFixed(2)}s...`);
          
          ffmpeg(videoPath)
            .seekInput(time)
            .frames(1)
            .output(framePath)
            .on('end', () => {
              if (fs.existsSync(framePath)) {
                frames.push(framePath);
                console.log(`✅ Frame ${index + 1} extraído: ${framePath}`);
              } else {
                console.warn(`⚠️  Frame ${index + 1} não foi criado: ${framePath}`);
              }
              processed++;
              if (processed === frameTimes.length) {
                console.log(`✅ Total de frames extraídos: ${frames.length}/${frameTimes.length}`);
                resolve(frames);
              }
            })
            .on('error', (err) => {
              console.error(`❌ Erro ao extrair frame ${index + 1}:`, err.message);
              processed++;
              if (processed === frameTimes.length) {
                console.log(`✅ Processamento finalizado. Frames extraídos: ${frames.length}/${frameTimes.length}`);
                resolve(frames);
              }
            })
            .run();
        });
      });
    });
  } catch (error) {
    console.error('Erro ao extrair frames:', error);
    return [];
  }
}

// Extrair thumbnail do vídeo (igual bot antigo)
async function extractThumbnail(videoPath, outputPath = null) {
  console.log(`📸 extractThumbnail chamado para: ${videoPath}`);
  
  // Garantir que FFmpeg está configurado antes de usar
  try {
    ensureFFmpegConfigured();
  } catch (error) {
    console.error('❌', error.message);
    return null;
  }
  
  if (!fs.existsSync(videoPath)) {
    console.error(`❌ Vídeo não existe: ${videoPath}`);
    return null;
  }

  try {
    const thumbnailsDir = path.join(__dirname, '../thumbnails');
    fs.ensureDirSync(thumbnailsDir);
    console.log(`📸 Pasta de thumbnails: ${thumbnailsDir}`);

    const videoName = path.basename(videoPath, path.extname(videoPath));
    // Limpar nome do arquivo para evitar caracteres inválidos (igual bot antigo)
    const safeName = videoName.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim() || 'video';
    console.log(`📸 Nome do vídeo: ${videoName} -> Nome seguro: ${safeName}`);
    
    if (!outputPath) {
      outputPath = path.join(thumbnailsDir, `${safeName}_thumb.jpg`);
    }
    
    console.log(`📸 Caminho de saída do thumbnail: ${outputPath}`);

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          console.error('❌ Erro ao analisar vídeo para thumbnail:', err);
          return resolve(null);
        }

        const duration = metadata.format.duration;
        if (!duration || duration <= 0) {
          console.error('❌ Duração inválida do vídeo');
          return resolve(null);
        }

        // Pega o frame do meio do vídeo (ou 1 segundo se muito curto)
        const timePosition = duration > 2 ? duration / 2 : Math.min(1.0, duration - 0.1);
        
        console.log(`📸 Extraindo thumbnail em ${timePosition.toFixed(2)}s...`);

        ffmpeg(videoPath)
          .seekInput(timePosition)
          .frames(1)
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log(`📸 Comando ffmpeg: ${commandLine}`);
          })
          .on('end', async () => {
            console.log(`📸 Processamento do thumbnail finalizado`);
            if (fs.existsSync(outputPath)) {
              try {
                // Otimizar thumbnail com sharp (redimensionar se necessário)
                const image = sharp(outputPath);
                const metadata = await image.metadata();
                
                console.log(`📸 Thumbnail criado: ${outputPath}`);
                console.log(`   Dimensões: ${metadata.width}x${metadata.height}`);
                
                // Se a imagem for muito grande, redimensiona
                if (metadata.width > 1280 || metadata.height > 720) {
                  console.log(`📸 Redimensionando thumbnail...`);
                  await image
                    .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 90 })
                    .toFile(outputPath);
                  console.log(`✅ Thumbnail redimensionado`);
                }
                
                console.log(`✅ Thumbnail gerado com sucesso: ${outputPath}`);
                resolve(outputPath);
              } catch (sharpError) {
                console.error('⚠️  Erro ao otimizar thumbnail:', sharpError);
                // Se o arquivo existe, retorna mesmo assim
                if (fs.existsSync(outputPath)) {
                  resolve(outputPath);
                } else {
                  resolve(null);
                }
              }
            } else {
              console.error('❌ Thumbnail não foi criado - arquivo não existe');
              resolve(null);
            }
          })
          .on('error', (err) => {
            console.error('❌ Erro ao extrair thumbnail:', err);
            console.error('   Mensagem:', err.message);
            resolve(null);
          })
          .on('stderr', (stderrLine) => {
            // Log do ffmpeg (pode ser verbose, mas útil para debug)
            if (stderrLine.includes('error') || stderrLine.includes('Error')) {
              console.error('   FFmpeg stderr:', stderrLine);
            }
          })
          .run();
      });
    });
  } catch (error) {
    console.error('❌ Erro ao extrair thumbnail:', error);
    return null;
  }
}

// Gerar conteúdo com Gemini
async function generateContentWithGemini(videoPath, videoName) {
  const startTime = Date.now();
  console.log('🔑 Verificando configuração do Gemini...');
  console.log('   GEMINI_API_KEY existe?', !!GEMINI_API_KEY);
  console.log('   genAI inicializado?', !!genAI);
  
  // Verificar se o vídeo existe antes de processar
  if (!fs.existsSync(videoPath)) {
    console.error(`❌ Vídeo não encontrado: ${videoPath}`);
    throw new Error(`Vídeo não encontrado: ${videoPath}`);
  }
  
  const videoStats = fs.statSync(videoPath);
  console.log(`📊 Tamanho do vídeo: ${(videoStats.size / (1024 * 1024)).toFixed(2)} MB`);
  
  // VALIDAÇÃO DO GEMINI
  if (!geminiModuleAvailable) {
    console.error('❌ Módulo @google/generative-ai não está instalado!');
    console.error('   Execute: npm install @google/generative-ai');
    throw new Error('Módulo Gemini não está instalado. Execute: npm install @google/generative-ai');
  }
  
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY não configurada!');
    console.error('   Configure a variável de ambiente GEMINI_API_KEY');
    throw new Error('GEMINI_API_KEY não configurada');
  }
  
  if (!genAI) {
    console.error('❌ Gemini não está inicializado!');
    throw new Error('Gemini não está inicializado');
  }

  try {
    console.log(`🎬 Iniciando geração de conteúdo para: ${videoName}`);
    console.log(`📁 Caminho do vídeo: ${videoPath}`);
    
    // EXTRAIR FRAMES PRIMEIRO (igual bot antigo)
    console.log('📸 ===== EXTRAINDO FRAMES DO VÍDEO =====');
    console.log(`📸 Caminho do vídeo: ${videoPath}`);
    console.log(`📸 Vídeo existe? ${fs.existsSync(videoPath)}`);
    
    let frames = await extractVideoFrames(videoPath, 3);
    console.log(`✅ ${frames.length} frames extraídos com sucesso!`);
    
    if (frames.length > 0) {
      console.log('📸 Lista de frames extraídos:');
      for (let i = 0; i < frames.length; i++) {
        const frameExists = fs.existsSync(frames[i]);
        console.log(`   Frame ${i + 1}: ${frames[i]} (existe: ${frameExists})`);
        if (!frameExists) {
          console.error(`   ⚠️  ATENÇÃO: Frame ${i + 1} não existe no sistema de arquivos!`);
        }
      }
    } else {
      console.error('❌ NENHUM FRAME FOI EXTRAÍDO! O vídeo pode estar corrompido ou o FFmpeg não está funcionando.');
    }
    
    // Se não conseguiu extrair frames, tenta gerar thumbnail como fallback
    let thumbnailPath = null;
    if (frames.length === 0) {
      console.warn('⚠️  Nenhum frame extraído! Tentando gerar thumbnail como fallback...');
      try {
        thumbnailPath = await extractThumbnail(videoPath);
        if (thumbnailPath) {
          console.log(`   ✅ Thumbnail gerado como fallback: ${thumbnailPath}`);
          // Usa o thumbnail como frame para análise
          frames = [thumbnailPath];
        } else {
          console.log('   ⚠️  Não foi possível gerar thumbnail');
        }
      } catch (thumbnailError) {
        console.error(`   ⚠️  Erro ao gerar thumbnail: ${thumbnailError.message}`);
        thumbnailPath = null;
      }
    } else {
      // Usa o primeiro frame como thumbnail (igual bot antigo)
      if (frames.length > 0) {
        thumbnailPath = frames[0];
        console.log(`📸 Usando primeiro frame como thumbnail: ${thumbnailPath}`);
        console.log(`📸 Frame existe? ${fs.existsSync(thumbnailPath)}`);
      } else {
        console.warn('⚠️  Nenhum frame disponível para usar como thumbnail');
        thumbnailPath = null;
      }
    }
    
    if (frames.length === 0) {
      console.warn('⚠️  NENHUM frame disponível para análise visual - usando modo texto');
    }
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 1.0,  // Máxima criatividade
        topP: 0.95,
        topK: 40
      }
    });

    const genericPatterns = [
      'você não vai acreditar',
      'não vai acreditar',
      'isso vai mudar',
      'você precisa ver'
    ];

    let title = null;
    let description = '#shorts';

    // ===== REFATORAÇÃO COMPLETA: VALIDAR FRAMES PRIMEIRO =====
    console.log('\n🔍 ===== VALIDAÇÃO DE FRAMES =====');
    console.log(`📸 Total de frames extraídos: ${frames.length}`);
    
    if (frames.length === 0) {
      console.error('❌ ERRO CRÍTICO: NENHUM FRAME FOI EXTRAÍDO!');
      console.error('   O Gemini NÃO pode analisar o vídeo sem frames!');
      throw new Error('Nenhum frame disponível para análise visual. Verifique se o FFmpeg está funcionando corretamente.');
    }
    
    // Carregar e validar TODOS os frames ANTES de enviar
    console.log('📤 Carregando frames para envio ao Gemini...');
    const frameData = await Promise.all(
      frames.map(async (framePath, index) => {
        try {
          if (!fs.existsSync(framePath)) {
            console.error(`❌ Frame ${index + 1} não existe: ${framePath}`);
            return null;
          }
          
          const imageData = await fs.readFile(framePath);
          const base64Data = imageData.toString('base64');
          
          console.log(`✅ Frame ${index + 1} carregado:`);
          console.log(`   - Caminho: ${framePath}`);
          console.log(`   - Tamanho original: ${imageData.length} bytes`);
          console.log(`   - Tamanho base64: ${base64Data.length} caracteres`);
          console.log(`   - Primeiros 50 chars base64: ${base64Data.substring(0, 50)}...`);
          
          return {
            inlineData: {
              data: base64Data,
              mimeType: 'image/jpeg'
            }
          };
        } catch (error) {
          console.error(`❌ Erro ao carregar frame ${index + 1}:`, error);
          return null;
        }
      })
    );
    
    // Remover frames nulos
    const validFrameData = frameData.filter(f => f !== null);
    console.log(`\n✅ VALIDAÇÃO CONCLUÍDA:`);
    console.log(`   - Frames válidos: ${validFrameData.length}/${frames.length}`);
    console.log(`   - Frames nulos: ${frames.length - validFrameData.length}`);
    
    if (validFrameData.length === 0) {
      console.error('❌ ERRO CRÍTICO: NENHUM FRAME VÁLIDO PARA ENVIAR AO GEMINI!');
      throw new Error('Nenhum frame válido disponível. Verifique se os frames foram extraídos corretamente.');
    }
    
    // Validar que os dados base64 estão presentes
    console.log('\n🔍 Validando dados dos frames...');
    validFrameData.forEach((frame, idx) => {
      if (!frame.inlineData || !frame.inlineData.data) {
        console.error(`❌ Frame ${idx + 1} não tem dados base64!`);
      } else {
        console.log(`✅ Frame ${idx + 1}: Dados base64 presentes (${frame.inlineData.data.length} chars)`);
      }
    });
    
    console.log('\n✅ TODOS OS FRAMES ESTÃO PRONTOS PARA ENVIO AO GEMINI!');
    console.log(`📤 Enviando ${validFrameData.length} frame(s) para análise visual...\n`);

    // PROMPT SIMPLIFICADO E DIRETO - FOCO EM ANÁLISE VISUAL
    console.log('\n📤 ===== ENVIANDO FRAMES PARA ANÁLISE VISUAL =====');
    console.log(`📸 Total de frames: ${validFrameData.length}`);
    console.log(`🎬 Modelo: gemini-2.0-flash (Vision)`);
    
    // PROMPT ULTRA ESPECÍFICO - FORÇA ANÁLISE VISUAL DETALHADA FRAME A FRAME
    const prompt = `Você está recebendo ${validFrameData.length} imagem(ns) REAL(IS) extraída(s) de um vídeo do YouTube Shorts.

═══════════════════════════════════════════════════════════════
⚠️ INSTRUÇÕES CRÍTICAS - ANALISE CADA FRAME INDIVIDUALMENTE:
═══════════════════════════════════════════════════════════════

PASSO 1: ANÁLISE FRAME A FRAME (OBRIGATÓRIO - FAÇA ISSO PRIMEIRO!)
Para CADA uma das ${validFrameData.length} imagem(ns) acima, descreva DETALHADAMENTE:

FRAME 1:
- O que você VÊ exatamente? (objetos, pessoas, animais, cenário)
- Quem aparece? (descreva características físicas: cor de cabelo, roupa, idade, expressão facial)
- O que estão fazendo? (ação específica: cozinhando, rindo, trabalhando, dançando, etc.)
- Onde estão? (local específico: cozinha, escritório, rua, estúdio, natureza, etc.)
- Qual é a emoção/expressão? (alegre, sério, surpreso, concentrado, etc.)
- Há texto visível? (se sim, transcreva exatamente)
- Há objetos específicos? (descreva: tipo de comida, ferramentas, equipamentos, etc.)

${validFrameData.length > 1 ? `FRAME 2:
- Repita a análise detalhada acima para esta segunda imagem
- Compare com o Frame 1: o que mudou? O que é diferente?
- Há progressão na ação? Descreva a sequência.

${validFrameData.length > 2 ? `FRAME 3:
- Repita a análise detalhada acima para esta terceira imagem
- Compare com os Frames anteriores: qual é a evolução da cena?
- Qual é o momento mais interessante visualmente?` : ''}` : ''}

PASSO 2: CRIAR TÍTULO ESPECÍFICO BASEADO NA ANÁLISE VISUAL
Baseado EXCLUSIVAMENTE na sua análise detalhada acima, crie um título que:
- Descreva ESPECIFICAMENTE o que você VÊ nas imagens (não genérico!)
- Mencione elementos visuais concretos que você identificou (ex: "Duas pessoas se abraçando", "Galinhas no quintal", "Pessoa cozinhando", "Reunião de trabalho")
- Seja criativo e chamativo para redes sociais
- Use emojis que correspondam EXATAMENTE ao conteúdo visual que você vê
- Tenha entre 30-60 caracteres
- NUNCA use o nome do arquivo no título
- NUNCA use frases genéricas como "A cena mais icônica" ou "O momento mais"

EXEMPLOS DE TÍTULOS ESPECÍFICOS (baseados em análise visual real):
- Se vê duas pessoas se abraçando: "O abraço mais emocionante que você vai ver! 💙"
- Se vê galinhas: "Galinhas no quintal: o momento mais engraçado! 🐔"
- Se vê alguém cozinhando: "Receita simples que vai mudar sua vida! 👨‍🍳"
- Se vê pessoas rindo: "A reação mais genuína que você vai ver hoje! 😂"
- Se vê tutorial: "Como fazer [ação específica que você vê] passo a passo! 📝"

IMPORTANTE: O título DEVE mencionar elementos visuais específicos que você identificou na análise!

PASSO 3: CRIAR DESCRIÇÃO DETALHADA
Crie uma descrição de 2-3 linhas que:
- Descreva ESPECIFICAMENTE o conteúdo visual que você analisou
- Mencione elementos visuais concretos das imagens
- Inclua hashtags relevantes ao conteúdo REAL (#shorts, #viral, etc.)
- Seja específica e não genérica

═══════════════════════════════════════════════════════════════
❌ PROIBIÇÕES ABSOLUTAS - NUNCA USE ESTES PADRÕES:
═══════════════════════════════════════════════════════════════

- "A cena mais icônica" ou "A cena mais icônica de [qualquer coisa]"
- "O momento mais" ou "O momento mais [qualquer coisa]"
- "Por que [qualquer coisa] está viralizando?"
- Títulos que mencionam o nome do arquivo (V01, V02, thechosenoficial, etc.)
- Títulos genéricos sem descrição visual específica
- Descrições vazias ou apenas "#shorts"
- Títulos que não descrevem o que você VÊ nas imagens
- Frases como "você não vai acreditar", "isso vai mudar", "você precisa ver"

⚠️ SE VOCÊ USAR QUALQUER UM DESSES PADRÕES GENÉRICOS, SUA RESPOSTA SERÁ REJEITADA E VOCÊ PRECISARÁ REFAZER COM ANÁLISE VISUAL CORRETA!

═══════════════════════════════════════════════════════════════
FORMATO DE RESPOSTA (OBRIGATÓRIO):
═══════════════════════════════════════════════════════════════

IMPORTANTE: Analise as imagens PRIMEIRO, depois responda em JSON.

Responda APENAS em JSON válido (sem markdown, sem código, sem explicações):

{
    "title": "título ESPECÍFICO que descreve exatamente o que você VÊ nas imagens acima",
    "description": "Descrição detalhada de 2-3 linhas do conteúdo visual específico com hashtags relevantes como #shorts #viral"
}

Lembre-se: O título DEVE descrever o conteúdo visual específico, não ser genérico!`;

    console.log(`📝 Prompt: ${prompt.length} caracteres`);
    console.log(`📤 Enviando ${validFrameData.length} frame(s) + prompt para Gemini Vision...`);
    
    try {
      // VALIDAÇÃO FINAL ANTES DE ENVIAR
      console.log('\n🔍 Validação final dos frames:');
      validFrameData.forEach((frame, idx) => {
        if (!frame.inlineData || !frame.inlineData.data) {
          throw new Error(`Frame ${idx + 1} não tem dados base64!`);
        }
        console.log(`   ✅ Frame ${idx + 1}: OK (${frame.inlineData.data.length} chars base64)`);
      });
      
      console.log('\n📤 ENVIANDO PARA GEMINI VISION...');
      console.log('   ⚠️  O Gemini DEVE analisar as imagens e criar título baseado no conteúdo visual!');
      
      // Enviar frames PRIMEIRO, depois o prompt (ordem importante!)
      const result = await model.generateContent([...validFrameData, prompt]);
      const response = result.response.text();
      
      console.log('\n✅ Resposta recebida do Gemini Vision!');
      console.log(`📝 Tamanho da resposta: ${response.length} caracteres`);
      console.log(`📝 Primeiros 500 caracteres: ${response.substring(0, 500)}`);
      
      // Parse JSON - tentar múltiplas formas
      console.log('🔍 Tentando fazer parse da resposta do Gemini...');
      
      // Tentar 1: Procurar JSON completo
      let jsonMatch = response.match(/\{[\s\S]*\}/);
      
      // Tentar 2: Se não encontrou, procurar por markdown code block
      if (!jsonMatch) {
        jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonMatch = [jsonMatch[1], jsonMatch[1]];
        }
      }
      
      // Tentar 3: Procurar apenas o conteúdo entre chaves
      if (!jsonMatch) {
        jsonMatch = response.match(/\{[\s\S]*?\}/);
      }
      
      if (jsonMatch) {
        try {
          const jsonStr = jsonMatch[0].trim();
          console.log('📝 JSON encontrado:', jsonStr.substring(0, 200));
          
          const content = JSON.parse(jsonStr);
          console.log('📦 JSON parseado completo:', JSON.stringify(content, null, 2));
          
          title = content.title || null;
          description = content.description || content.desc || null;
          
          console.log(`✅ Título extraído: "${title}"`);
          console.log(`✅ Descrição extraída: "${description}"`);
          
          // VALIDAÇÃO: Rejeitar títulos genéricos ou que mencionam nome do arquivo
          if (title) {
            const titleLower = title.toLowerCase().trim();
            const videoNameLower = videoName.toLowerCase();
            
            // Verificar se o título menciona o nome do arquivo
            if (titleLower.includes(videoNameLower.replace(/\.[^/.]+$/, '')) || 
                titleLower.includes('v01') || titleLower.includes('v02') ||
                titleLower.match(/v\d+/i)) {
              console.error('❌ Título rejeitado: menciona nome do arquivo!');
              console.error(`   Título: "${title}"`);
              console.error(`   Nome do arquivo: "${videoName}"`);
              throw new Error('Título genérico detectado: menciona nome do arquivo. O Gemini deve analisar apenas o conteúdo visual.');
            }
            
            const genericPatterns = [
              /cena mais icônica/i,
              /por que.*viralizando/i,
              /está viralizando/i,
              /você não vai acreditar/i,
              /a cena mais/i,
              /cena mais/i,
              /momento mais icônico/i,
              /o momento mais/i,
              /isso vai mudar/i,
              /você precisa ver/i,
              /não vai acreditar/i,
              /isso é incrível/i,
              /você não vai acreditar no que/i
            ];
            
            const isGeneric = genericPatterns.some(pattern => pattern.test(titleLower));
            
            if (isGeneric) {
              console.error(`❌ TÍTULO GENÉRICO REJEITADO: "${title}"`);
              console.error(`   Padrão genérico detectado!`);
              console.error(`   O Gemini não analisou os frames corretamente!`);
              throw new Error(`Título genérico detectado: "${title}". O Gemini deve analisar o conteúdo visual específico das imagens e criar um título que descreva exatamente o que aparece nos frames, não usar frases genéricas.`);
            }
            
            // Verificar se o título é muito curto ou muito genérico
            if (title.length < 20) {
              console.warn('⚠️  Título muito curto, pode ser genérico');
            }
            
            // Verificar se o título tem palavras específicas que indicam análise visual
            const hasVisualDescription = /(pessoa|pessoas|homem|mulher|gato|cachorro|galinha|animal|comida|cozinha|rua|casa|escritório|trabalho|dança|riso|abraço|abraçando|vestindo|usando|segurando|com|em|no|na)/i.test(titleLower);
            
            if (!hasVisualDescription && title.length < 40) {
              console.warn('⚠️  Título pode ser genérico - não menciona elementos visuais específicos');
            }
            
            console.log(`✅ Título aceito: "${title}"`);
          }
          
          // VALIDAÇÃO: Garantir que descrição não é apenas "#shorts"
          if (!description || description.trim() === '#shorts' || description.trim().length < 10) {
            console.warn('⚠️  Descrição está vazia ou muito genérica, gerando descrição baseada no título...');
            if (title) {
              description = `${title}\n\n#shorts #viral #youtube`;
            } else {
              description = '#shorts #viral #youtube';
            }
            console.log(`✅ Descrição gerada: "${description}"`);
          }
          
          // Validação mínima - apenas verificar se não está vazio
          if (!title || title.trim().length < 3) {
            console.warn('⚠️  Título extraído está vazio ou muito curto');
            // Tentar extrair título do texto da resposta
            const titleMatch = response.match(/["']title["']\s*:\s*["']([^"']+)["']/i) || 
                              response.match(/title["']?\s*:\s*["']([^"']+)["']/i);
            if (titleMatch) {
              title = titleMatch[1];
              console.log(`✅ Título extraído do texto: "${title}"`);
            }
          } else {
            console.log(`✅ Título aceito: "${title}"`);
          }
        } catch (parseError) {
          console.error('❌ Erro ao fazer parse do JSON:', parseError);
          console.error('JSON encontrado:', jsonMatch[0].substring(0, 200));
          
          // Tentar extrair título manualmente do texto
          console.log('🔍 Tentando extrair título manualmente...');
          const titleMatch = response.match(/["']title["']\s*:\s*["']([^"']+)["']/i) || 
                            response.match(/title["']?\s*:\s*["']([^"']+)["']/i) ||
                            response.match(/título["']?\s*:\s*["']([^"']+)["']/i);
          if (titleMatch) {
            title = titleMatch[1];
            console.log(`✅ Título extraído manualmente: ${title}`);
          }
        }
      } else {
        console.error('❌ Nenhum JSON encontrado na resposta do Gemini');
        console.error('Resposta completa:', response);
        
        // Última tentativa: procurar título no texto livre
        console.log('🔍 Tentando extrair título do texto livre...');
        const titlePatterns = [
          /título[:\s]+["']?([^"'\n]+)["']?/i,
          /title[:\s]+["']?([^"'\n]+)["']?/i,
          /"title"\s*:\s*"([^"]+)"/i
        ];
        
        for (const pattern of titlePatterns) {
          const match = response.match(pattern);
          if (match && match[1] && match[1].trim().length > 5) {
            title = match[1].trim();
            console.log(`✅ Título extraído do texto livre: ${title}`);
            break;
          }
        }
      }
    } catch (geminiError) {
      console.error('❌ ERRO ao chamar Gemini API:', geminiError);
      console.error('   Detalhes:', geminiError.message);
      console.error('   Stack:', geminiError.stack);
      // Não lançar erro, usar fallback
      title = null;
    }
    
    // Se não conseguiu gerar título, lançar erro (não usar fallback genérico)
    if (!title || title.trim().length < 3) {
      console.error('❌ ERRO: Título não foi gerado ou está vazio!');
      console.error('   O Gemini deve analisar os frames e criar um título específico.');
      throw new Error('Não foi possível gerar um título específico baseado no conteúdo visual. O Gemini deve analisar os frames do vídeo e criar um título que descreva exatamente o que aparece nas imagens.');
    }
    
    // Garantir que description não está vazia ou muito genérica
    if (!description || description.trim().length === 0 || description.trim() === '#shorts') {
      console.warn('⚠️  Descrição está vazia ou muito genérica, gerando descrição baseada no título...');
      if (title && title.trim().length > 0) {
        // Criar descrição baseada no título
        description = `${title}\n\n#shorts #viral #youtube #trending`;
      } else {
        description = '#shorts #viral #youtube #trending';
      }
      console.log(`✅ Descrição gerada: "${description}"`);
    }
    
    console.log(`\n✅ ===== RESULTADO FINAL =====`);
    console.log(`✅ Título: ${title}`);
    console.log(`✅ Descrição: ${description}`);
    console.log(`✅ Thumbnail: ${thumbnailPath || 'N/A'}`);

    // Thumbnail é um dos frames extraídos (igual bot antigo)
    // SEMPRE copiar frame para pasta de thumbnails ANTES de retornar
    console.log(`\n📸 ===== PROCESSANDO THUMBNAIL =====`);
    console.log(`📸 thumbnailPath inicial: ${thumbnailPath}`);
    console.log(`📸 thumbnailPath existe? ${thumbnailPath ? fs.existsSync(thumbnailPath) : 'N/A'}`);
    console.log(`📸 Frames extraídos: ${frames.length}`);
    
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      console.log(`✅ Thumbnail (frame) existe: ${thumbnailPath}`);
      
      // SEMPRE copiar frame para pasta de thumbnails (igual bot antigo)
      const thumbnailsDir = path.join(__dirname, '../thumbnails');
      fs.ensureDirSync(thumbnailsDir);
      console.log(`📸 Pasta de thumbnails: ${thumbnailsDir}`);
      console.log(`📸 Pasta existe? ${fs.existsSync(thumbnailsDir)}`);
      
      const videoNameSafe = path.basename(videoPath, path.extname(videoPath));
      const safeName = videoNameSafe.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim() || 'video';
      const finalThumbnailPath = path.join(thumbnailsDir, `${safeName}_thumb.jpg`);
      
      console.log(`📸 Caminho final do thumbnail: ${finalThumbnailPath}`);
      console.log(`📸 Nome seguro: ${safeName}`);
      
      // SEMPRE copiar (mesmo que já esteja na pasta)
      try {
        console.log(`📸 Copiando ${thumbnailPath} para ${finalThumbnailPath}...`);
        fs.copyFileSync(thumbnailPath, finalThumbnailPath);
        console.log(`✅ Arquivo copiado!`);
        
        // Verificar se foi copiado
        if (fs.existsSync(finalThumbnailPath)) {
          const stats = fs.statSync(finalThumbnailPath);
          console.log(`✅ Thumbnail copiado com sucesso! Tamanho: ${stats.size} bytes`);
          console.log(`✅ Caminho absoluto: ${path.resolve(finalThumbnailPath)}`);
          thumbnailPath = finalThumbnailPath;
        } else {
          console.error(`❌ Thumbnail não foi copiado! Arquivo não existe: ${finalThumbnailPath}`);
          // Usar frame original como fallback
          console.log(`   Usando frame original: ${thumbnailPath}`);
        }
      } catch (copyError) {
        console.error(`❌ Erro ao copiar frame para thumbnails: ${copyError.message}`);
        console.error(`   Stack: ${copyError.stack}`);
        // Usar frame original como fallback
        console.log(`   Usando frame original: ${thumbnailPath}`);
      }
    } else if (thumbnailPath) {
      console.error(`❌ Thumbnail path retornado mas arquivo não existe: ${thumbnailPath}`);
      console.error(`   Caminho absoluto tentado: ${path.resolve(thumbnailPath)}`);
      thumbnailPath = null;
    } else {
      console.warn('⚠️  Nenhum thumbnail disponível - frames não foram extraídos');
      console.warn(`   Frames.length: ${frames.length}`);
      console.warn(`   thumbnailPath: ${thumbnailPath}`);
    }
    
    console.log(`📸 thumbnailPath FINAL: ${thumbnailPath}`);
    console.log(`📸 thumbnailPath FINAL existe? ${thumbnailPath ? fs.existsSync(thumbnailPath) : false}`);
    console.log(`📸 ===== FIM PROCESSAMENTO THUMBNAIL =====\n`);

    // Garantir que o thumbnail_path seja absoluto e válido
    let finalThumbnailPath = thumbnailPath;
    if (finalThumbnailPath && fs.existsSync(finalThumbnailPath)) {
      // Converter para caminho absoluto
      finalThumbnailPath = path.resolve(finalThumbnailPath);
      console.log(`✅ Thumbnail final (absoluto): ${finalThumbnailPath}`);
      console.log(`✅ Thumbnail existe? ${fs.existsSync(finalThumbnailPath)}`);
      console.log(`✅ Tamanho do arquivo: ${fs.statSync(finalThumbnailPath).size} bytes`);
    } else {
      console.warn(`⚠️  Thumbnail não disponível ou não existe`);
      if (thumbnailPath) {
        console.warn(`   Caminho tentado: ${thumbnailPath}`);
        console.warn(`   Existe? ${fs.existsSync(thumbnailPath)}`);
      }
      finalThumbnailPath = null;
    }

    const result = {
      title: title.substring(0, 60),
      description: description.substring(0, 200),
      thumbnail_path: finalThumbnailPath  // Mesmo nome do bot antigo
    };
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n⏱️  Tempo total de processamento: ${duration} segundos`);
    console.log('📦 Resultado final:', JSON.stringify(result, null, 2));
    console.log('📸 Thumbnail path no resultado:', result.thumbnail_path);
    console.log('📸 Thumbnail path existe?', result.thumbnail_path ? fs.existsSync(result.thumbnail_path) : false);
    
    if (!result.thumbnail_path) {
      console.error('❌ ATENÇÃO: thumbnail_path é NULL no resultado final!');
      console.error('   Frames extraídos:', frames.length);
      console.error('   thumbnailPath original:', thumbnailPath);
    }
    
    return result;
  } catch (error) {
    console.error('Erro ao gerar conteúdo:', error);
    return {
      title: videoName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
      description: '#shorts',
      thumbnail_path: null  // Mesmo nome do bot antigo
    };
  }
}

module.exports = {
  generateContentWithGemini,
  extractVideoFrames,
  extractThumbnail
};

