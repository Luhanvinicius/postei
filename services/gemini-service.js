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

if (!GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY não configurada');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

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
  console.log('🔑 Verificando configuração do Gemini...');
  console.log('   GEMINI_API_KEY existe?', !!GEMINI_API_KEY);
  console.log('   genAI inicializado?', !!genAI);
  
  if (!genAI) {
    console.error('❌ Gemini não está configurado! Verifique GEMINI_API_KEY no .env');
    return {
      title: videoName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
      description: '#shorts',
      thumbnail_path: null
    };
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

    // Tentar até 3 vezes para evitar títulos genéricos
    for (let attempt = 0; attempt < 3; attempt++) {
      let prompt = '';

      if (frames.length > 0) {
        console.log(`👁️  GEMINI VISION ATIVO! Analisando ${frames.length} frames do vídeo: ${videoName}`);
        console.log(`👁️  O Gemini vai VER o conteúdo real do vídeo e criar título baseado no que vê!`);
        
        // Modo visual - analisar frames (igual bot antigo)
        const frameData = await Promise.all(
          frames.map(async (framePath) => {
            try {
              if (!fs.existsSync(framePath)) {
                console.error(`⚠️  Frame não existe: ${framePath}`);
                return null;
              }
              const imageData = await fs.readFile(framePath);
              console.log(`✅ Frame carregado: ${framePath} (${imageData.length} bytes)`);
              return {
                inlineData: {
                  data: imageData.toString('base64'),
                  mimeType: 'image/jpeg'
                }
              };
            } catch (error) {
              console.error(`⚠️  Erro ao carregar frame ${framePath}:`, error);
              return null;
            }
          })
        );
        
        // Remove frames nulos
        const validFrameData = frameData.filter(f => f !== null);
        console.log(`📸 Frames válidos para análise: ${validFrameData.length}/${frames.length}`);
        
        if (validFrameData.length === 0) {
          console.error('❌ NENHUM FRAME VÁLIDO PARA ANÁLISE! Caindo para modo texto...');
          // Não limpar frames aqui, apenas marcar que não temos dados válidos
          // Isso vai fazer cair no else abaixo
        } else {
          console.log(`✅ ${validFrameData.length} frames prontos para enviar ao Gemini!`);
          
          // Continuar apenas se tiver frames válidos
          if (validFrameData.length > 0) {
            // Prompt melhorado baseado no bot antigo
            prompt = `Você está vendo frames reais de um vídeo do YouTube Shorts.

SUA TAREFA:
Analise ATENTAMENTE o que você VÊ nas imagens acima e crie um título e descrição COMPLETAMENTE ÚNICOS baseados APENAS no conteúdo visual que você observa.

⚠️ PROIBIÇÕES ABSOLUTAS - SEU TÍTULO SERÁ REJEITADO SE CONTIVER:
❌ "Você NÃO vai acreditar" (QUALQUER variação)
❌ "Você não vai acreditar nesse"
❌ "Você não vai acreditar no"
❌ "Isso vai mudar tudo"
❌ "Você precisa ver"
❌ Qualquer fórmula genérica ou template
❌ Títulos repetitivos

Se você usar qualquer uma dessas fórmulas, seu título será REJEITADO e você terá que criar outro.

O QUE FAZER:
✅ Analise CADA frame individualmente - o que você REALMENTE vê?
✅ Descreva EXATAMENTE o conteúdo visual:
   - Se vê uma pessoa: "Pessoa fazendo [ação específica]"
   - Se vê um objeto: "Objeto [nome] sendo usado para [ação]"
   - Se vê uma cena: "Cena de [tipo] com [elementos visíveis]"
✅ Crie um título ESPECÍFICO baseado no que você VÊ, não em fórmulas
✅ Use emojis relevantes ao conteúdo visual que você observa
✅ Seja CRIATIVO e ORIGINAL - cada vídeo é diferente!

EXEMPLOS DO QUE CRIAR (baseado no que você vê):
- Se vê uma cena de ação: "A cena mais épica que você vai ver hoje! 💥"
- Se vê um tutorial: "Aprenda isso em 30 segundos! 🎓"
- Se vê algo engraçado: "Isso é hilário demais! 😂"
- Se vê um produto: "Este produto vai mudar sua vida! 🛍️"
- Baseie-se no que você REALMENTE VÊ nas imagens!

Informações técnicas:
- Nome do arquivo: ${videoName}

Responda APENAS em formato JSON (sem markdown, sem código):
{
    "title": "título único e específico baseado no conteúdo visual que você vê",
    "description": "#shorts descrição detalhada com hashtags relevantes ao conteúdo visual"
}`;

        console.log('🤖 Enviando frames para análise do Gemini...');
        console.log(`   Modelo: gemini-2.0-flash`);
        console.log(`   Frames válidos: ${validFrameData.length}`);
        console.log(`   Prompt length: ${prompt.length}`);
        
        try {
          // Envia frames + prompt (igual bot antigo)
          if (validFrameData.length === 0) {
            throw new Error('Nenhum frame válido para enviar ao Gemini');
          }
          console.log(`📤 Enviando ${validFrameData.length} frames + prompt para Gemini...`);
          const result = await model.generateContent([...validFrameData, prompt]);
          const response = result.response.text();
          
          console.log('✅ Resposta recebida do Gemini!');
          console.log('📝 Resposta completa:', response);
          console.log('📝 Primeiros 200 caracteres:', response.substring(0, 200));
          
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
              title = content.title || content.title || null;
              description = content.description || content.desc || '#shorts';
              
              console.log(`✅ Título extraído: ${title}`);
              console.log(`✅ Descrição extraída: ${description.substring(0, 50)}...`);
              
              // Validar se título foi extraído
              if (!title || title.length < 3) {
                console.warn('⚠️  Título extraído está vazio ou muito curto, tentando extrair do texto...');
                // Tentar extrair título do texto da resposta
                const titleMatch = response.match(/["']title["']\s*:\s*["']([^"']+)["']/i) || 
                                  response.match(/title["']?\s*:\s*["']([^"']+)["']/i);
                if (titleMatch) {
                  title = titleMatch[1];
                  console.log(`✅ Título extraído do texto: ${title}`);
                }
              }
            } catch (parseError) {
              console.error('❌ Erro ao fazer parse do JSON:', parseError);
              console.error('JSON encontrado:', jsonMatch[0].substring(0, 200));
              console.error('Resposta completa:', response.substring(0, 500));
              
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
          // Se deu erro, tentar modo texto na próxima tentativa
          frames = [];
        }
          } else {
            console.error('❌ Nenhum frame válido disponível, pulando modo visual');
            frames = [];
          }
        }
      }
      
      // Se não tem frames válidos, usar modo texto
      if (frames.length === 0) {
        console.log(`⚠️  Nenhum frame disponível para ${videoName}, usando modo texto`);
        // Modo texto - mas ainda usa Gemini
        prompt = `Crie um título ÚNICO e ESPECÍFICO para este vídeo do YouTube Shorts.

Nome do arquivo: ${videoName}

⚠️ PROIBIÇÕES ABSOLUTAS:
❌ "Você NÃO vai acreditar" (QUALQUER variação)
❌ "Isso vai mudar tudo"
❌ "Você precisa ver"
❌ Qualquer fórmula genérica

O QUE FAZER:
✅ Analise o nome do arquivo e crie algo ESPECÍFICO
✅ Seja CRIATIVO e ORIGINAL
✅ Use emojis relevantes
✅ Cada vídeo precisa de um título TOTALMENTE DIFERENTE

Responda APENAS em formato JSON:
{
    "title": "título único e específico baseado no nome do arquivo",
    "description": "#shorts descrição com hashtags relevantes"
}`;

        console.log('🤖 Enviando prompt de texto para Gemini...');
        try {
          const result = await model.generateContent(prompt);
          const response = result.response.text();
          
          console.log('✅ Resposta recebida do Gemini (modo texto)!');
          console.log('📝 Resposta:', response);
          
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const content = JSON.parse(jsonMatch[0]);
              title = content.title;
              description = content.description || '#shorts';
              console.log(`✅ Título gerado pelo Gemini: ${title}`);
            } catch (parseError) {
              console.error('❌ Erro ao fazer parse do JSON (modo texto):', parseError);
            }
          }
        } catch (geminiError) {
          console.error('❌ ERRO ao chamar Gemini API (modo texto):', geminiError);
        }
      }

      // Validar se não é genérico
      if (title) {
        const titleLower = title.toLowerCase();
        const isGeneric = genericPatterns.some(pattern => titleLower.includes(pattern));
        
        if (!isGeneric) {
          break; // Título OK
        }
        
        if (attempt < 2) {
          console.log(`⚠️  Título genérico detectado, tentando novamente...`);
        }
      }
    }

    // Fallback se ainda for genérico ou vazio
    if (!title || title.length < 5) {
      console.warn('⚠️  Título ainda está vazio ou muito curto após todas as tentativas');
      console.warn(`   Título atual: "${title}"`);
      console.warn('   Usando fallback baseado no nome do arquivo...');
      
      const nameClean = videoName.replace(/\.[^/.]+$/, '').replace(/[()]/g, ' ').trim();
      const words = nameClean.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        title = `Por que ${words[0]} está viralizando? 🚀`;
      } else {
        title = 'Conteúdo que você precisa ver! 🚀';
      }
      console.log(`✅ Título fallback gerado: ${title}`);
    }
    
    // Garantir que description não está vazia
    if (!description || description.trim().length === 0) {
      console.warn('⚠️  Descrição está vazia, usando padrão...');
      description = '#shorts';
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

