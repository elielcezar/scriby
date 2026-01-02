import https from 'https';
import http from 'http';

/**
 * Busca conteúdo de uma URL usando Jina AI Reader
 * @param {string} url - URL para buscar
 * @returns {Promise<string>} - Conteúdo limpo em markdown
 */
export async function fetchContentWithJina(url) {
  return new Promise((resolve, reject) => {
    const jinaUrl = `https://r.jina.ai/${url}`;

    console.log(`🔍 Buscando conteúdo: ${url}`);

    https.get(jinaUrl, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ Conteúdo obtido (${data.length} chars)`);
          resolve(data);
        } else {
          reject(new Error(`Jina AI retornou status ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      console.error('❌ Erro ao buscar conteúdo:', err);
      reject(err);
    });
  });
}

/**
 * Busca conteúdo de uma URL usando Jina AI Reader e retorna conteúdo + markdown
 * @param {string} url - URL para buscar
 * @returns {Promise<{content: string, markdown: string}>} - Conteúdo e markdown (mesmo valor do Jina)
 */
export async function fetchContentWithJinaAndMarkdown(url) {
  const markdown = await fetchContentWithJina(url);
  return {
    content: markdown,
    markdown: markdown
  };
}

/**
 * Gera uma notícia usando IA (OpenAI ou similar)
 * @param {Object} params - Parâmetros
 * @param {string} params.assunto - Assunto da pauta
 * @param {string} params.resumo - Resumo da pauta
 * @param {Array} params.conteudos - Array com conteúdos das fontes
 * @param {boolean} params.multilingual - Se true, gera em PT, EN e ES
 * @returns {Promise<Object>} - Se multilingual: {pt: {...}, en: {...}, es: {...}}, senão: {titulo, chamada, conteudo}
 */
export async function generateNewsWithAI({ assunto, resumo, conteudos }) {
  // Verifica se tem OpenAI configurada
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no .env');
  }

  const tonsDeVoz = [
    {
      nome: 'Defensor do Consumidor',
      foco: 'Custo-Benefício',
      angulo: 'Isso vale o seu dinheiro?',
      abordagem: 'Analisa se a notícia é apenas marketing ou se realmente traz vantagem financeira ou prática para o usuário final.',
      expressoesChave: ['Investimento', 'durabilidade', 'vale a pena esperar', 'bolso do brasileiro']
    },
    {
      nome: 'Analista de Tendências',
      foco: 'Geopolítica/Mercado',
      angulo: 'O que isso muda no tabuleiro global?',
      abordagem: 'Conecta a notícia com movimentos de mercado, guerras comerciais e o impacto na indústria a longo prazo.',
      expressoesChave: ['Dominância de mercado', 'estratégia agressiva', 'mudança de paradigma', 'setor industrial']
    },
    {
      nome: 'Geek Técnico',
      foco: 'Especificações',
      angulo: 'O que tem debaixo do capô?',
      abordagem: 'Ignora o texto comercial e foca em processadores, eficiência de baterias, arquitetura de software e benchmarks.',
      expressoesChave: ['Desempenho bruto', 'arquitetura', 'eficiência energética', 'latência', 'hardware']
    },
    {
      nome: 'Observador Sustentável',
      foco: 'Ética e ESG',
      angulo: 'Qual o impacto para o planeta?',
      abordagem: 'Analisa a pegada de carbono, o uso de materiais recicláveis, a ética de trabalho da empresa ou o impacto cultural daquela música/evento.',
      expressoesChave: ['Sustentabilidade', 'pegada ecológica', 'ética corporativa', 'consciência']
    },
    {
      nome: 'Veterano Nostálgico',
      foco: 'Histórico/Comparação',
      angulo: 'Como era antes e como chegamos aqui?',
      abordagem: 'Relembra modelos antigos de celulares, carros clássicos ou a evolução de um gênero musical para contextualizar a notícia atual.',
      expressoesChave: ['Diferente do que víamos nos anos 90', 'evolução histórica', 'legado', 'raízes']
    },
    {
      nome: 'Educador/Professor',
      foco: 'Didática',
      angulo: 'Entenda de uma vez por todas',
      abordagem: 'Explica termos técnicos (o que é uma bateria de lâmina? o que é IA generativa?) enquanto reporta a notícia.',
      expressoesChave: ['Em termos simples', 'para você entender', 'basicamente', 'na prática']
    }
  ]

  const tomSelecionado = tonsDeVoz[Math.floor(Math.random() * tonsDeVoz.length)];



  const prompt = `
  PAUTA:
  Assunto: ${assunto}
  Resumo: ${resumo}

  CONTEÚDO DAS FONTES:
  ${conteudos.map((c, i) => `\n--- Fonte ${i + 1} ---\n${c.substring(0, 3000)}\n`).join('\n')}

  # PERSONA
  Você é um Jornalista Investigativo Sênior com 20 anos de experiência. 

  # PERFIL EDITORIAL DESTA MATÉRIA
  Para este artigo, você deve assumir o papel de **${tomSelecionado.nome}**.
  - **Foco Principal:** ${tomSelecionado.foco}
  - **Ângulo de Escrita:** ${tomSelecionado.angulo}
  - **Abordagem:** ${tomSelecionado.abordagem}
  - **Vocabulário Desejado:** Sempre que natural, utilize termos e conceitos como: ${tomSelecionado.expressoesChave.join(', ')}.

  # TAREFA
  Produza uma reportagem profunda e original SEMPRE em português (PT-BR) baseada na pauta fornecida, independente do idioma original da pauta.

  # DIRETRIZES DE CONTEÚDO (Foco em E-E-A-T):
  1. PRESERVAÇÃO DE FORMATO: Se a pauta original for uma lista (ex: "9 celulares", "5 dicas"), você DEVE manter esse formato, detalhando cada item com informações técnicas e análises que não estão no texto original.
  2. SUBTÍTULOS CRIATIVOS: Proibido usar "O Fato", "Análise" ou "Conclusão". Crie subtítulos jornalísticos chamativos que resumam o parágrafo (Ex: em vez de "Impacto", use "O tremor de terra no mercado de elétricos").
  3. INTEGRAÇÃO DE CONHECIMENTO: Insira o contexto histórico e as curiosidades de forma fluida no meio do texto, não como um bloco isolado.
  4. ANÁLISE CRÍTICA: Imagine as consequências práticas. Se a BYD passou a Tesla, o que isso significa para o preço dos carros no Brasil? Se novos celulares virão, o que o usuário deve fazer com o modelo atual?
  5. TAMANHO E DENSIDADE: Mínimo 700 palavras. Use parágrafos médios, negritos em termos-chave e listas de tópicos (bullet points) para quebrar o texto e melhorar a leitura.
  6. EVITE IA-ISMS: Não use "Em suma", "No cenário atual", "É importante notar", "Além disso". Seja direto e autoritário.

  # REGRAS PARA O BLOCO "SAIBA MAIS":
  - NÃO inclua o link da pauta original (referência).
  - Procure indicar sites de autoridade governamental (.gov), educacional (.edu) ou outros grandes portais que sejam reconhecidos por escreverem sobre o tema da reportagem (Ex.: se o assunto for celulares, recomende sites como tudocelular.com, se o assunto for carros, inclua a quatrorodas.abril.com.br).
  - Nunca recomende sites em inglês ou outro idioma que não seja o português do Brasil.
  - Coloque o título do site (que seja clicável) e uma breve descrição do que o leitor encontrará lá.

  # FORMATO DE SAÍDA (HTML):
  - Use <h2> e <h3> para hierarquia.
  - Use <strong> para destacar conceitos importantes.
  - Use <ul> e <li> para listas técnicas.

  FORMATO DE RESPOSTA (JSON):
  {
    "titulo": "Título em português",
    "chamada": "Subtítulo em português",
    "conteudo": "<p>Conteúdo completo em HTML...</p>"
  }

  Retorne APENAS o JSON, sem texto adicional.`;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um redator profissional de notícias em português. Sempre responda em JSON válido com titulo, chamada e conteudo.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_completion_tokens: 2000
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('🤖 Chamando OpenAI para gerar notícia...');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error('❌ OpenAI error:', data);
            reject(new Error(`OpenAI retornou status ${res.statusCode}`));
            return;
          }

          const response = JSON.parse(data);
          const content = response.choices[0].message.content;

          // Remove marcadores de código markdown se houver
          let jsonString = content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

          const newsData = JSON.parse(jsonString);

          // Validar formato
          if (!newsData.titulo || !newsData.chamada || !newsData.conteudo) {
            throw new Error('Resposta da IA não contém todos os campos necessários (titulo, chamada, conteudo)');
          }

          console.log('✅ Notícia gerada em português com sucesso!');

          resolve(newsData);
        } catch (error) {
          console.error('❌ Erro ao parsear resposta da IA:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição OpenAI:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Gera um slug a partir de um texto
 * @param {string} text - Texto para converter em slug
 * @returns {string} - Slug gerado
 */
export function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}



/**
 * Determina a categoria mais adequada para um post usando IA
 * @param {Object} params - Parâmetros
 * @param {string} params.titulo - Título do post
 * @param {string} params.conteudo - Conteúdo do post
 * @param {Array} params.categoriasDisponiveis - Array de categorias {id, nomePt, nomeEn, nomeEs}
 * @returns {Promise<number|null>} - ID da categoria ou null se não conseguir determinar
 */
export async function categorizePostWithAI({ titulo, conteudo, categoriasDisponiveis }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no .env');
  }

  const categoriasTexto = categoriasDisponiveis.map(cat =>
    `- ID ${cat.id}: ${cat.nomePt} (${cat.nomeEn} / ${cat.nomeEs})`
  ).join('\n');

  const prompt = `Você é um editor especializado em categorização de notícias sobre música eletrônica.

TÍTULO DA NOTÍCIA:
${titulo}

CONTEÚDO DA NOTÍCIA:
${conteudo.substring(0, 2000)}

CATEGORIAS DISPONÍVEIS:
${categoriasTexto}

TAREFA:
Analise o título e conteúdo da notícia e determine qual categoria é mais adequada.
Retorne APENAS o ID numérico da categoria escolhida (exemplo: 7).

Se a notícia falar sobre inteligencia artificial, serviços ou sites de música como spotify, soundcloud, etc, classifique na categoria Tecnologia.

Se a notícia falar sobre algum artista da latino, marque como América Latina.

Se a notícia falar sobre um evento, festival ou show, marque na categoria Festival.

Se nenhuma categoria for adequada, marque como Mundo.

FORMATO DE RESPOSTA:
Apenas o número do ID ou "null", sem texto adicional.`;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um editor especializado. Sempre responda apenas com o ID numérico da categoria ou "null".'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 10
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('🤖 Chamando OpenAI para categorizar post...');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error('❌ OpenAI error:', data);
            reject(new Error(`OpenAI retornou status ${res.statusCode}`));
            return;
          }

          const response = JSON.parse(data);
          const content = response.choices[0].message.content.trim();

          let categoriaId = content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .replace(/"/g, '')
            .trim();

          if (categoriaId.toLowerCase() === 'null' || categoriaId === '') {
            console.log('⚠️  IA não conseguiu determinar categoria');
            resolve(null);
            return;
          }

          const id = parseInt(categoriaId);
          if (isNaN(id)) {
            console.warn('⚠️  Resposta da IA não é um número válido:', categoriaId);
            resolve(null);
            return;
          }

          const categoriaExiste = categoriasDisponiveis.some(cat => cat.id === id);
          if (!categoriaExiste) {
            console.warn(`⚠️  Categoria ID ${id} não existe nas categorias disponíveis`);
            resolve(null);
            return;
          }

          console.log(`✅ Categoria determinada: ID ${id}`);
          resolve(id);
        } catch (error) {
          console.error('❌ Erro ao parsear resposta da IA:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição OpenAI:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Gera tags relacionadas ao conteúdo usando IA
 * @param {Object} params - Parâmetros
 * @param {string} params.titulo - Título do post
 * @param {string} params.conteudo - Conteúdo do post
 * @param {number} params.quantidade - Quantidade de tags desejadas (padrão: 5)
 * @returns {Promise<Array<string>>} - Array de tags geradas
 */
export async function generateTagsWithAI({ titulo, conteudo, quantidade = 5 }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no .env');
  }

  const prompt = `Você é um editor especializado em música eletrônica.

TÍTULO DA NOTÍCIA:
${titulo}

CONTEÚDO DA NOTÍCIA:
${conteudo.substring(0, 2000)}

TAREFA:
Gere ${quantidade} tags relevantes relacionadas ao conteúdo da notícia.
As tags devem ser:
- Palavras-chave importantes do texto
- Nomes de artistas, DJs, festivais mencionados
- Gêneros musicais relacionados
- Termos técnicos relevantes
- Em português, minúsculas, sem acentos (ex: "edm", "festival", "tiesto", "house music")

FORMATO DE RESPOSTA (JSON):
{
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Retorne APENAS o JSON, sem texto adicional.`;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um editor especializado. Sempre responda em JSON válido com array de tags.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`🤖 Chamando OpenAI para gerar ${quantidade} tags...`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error('❌ OpenAI error:', data);
            reject(new Error(`OpenAI retornou status ${res.statusCode}`));
            return;
          }

          const response = JSON.parse(data);
          const content = response.choices[0].message.content;

          let jsonString = content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

          const resultado = JSON.parse(jsonString);
          const tags = resultado.tags || [];

          const tagsLimpas = tags
            .map(tag => tag.toLowerCase().trim())
            .filter(tag => tag.length > 0 && tag.length <= 50)
            .slice(0, quantidade);

          console.log(`✅ ${tagsLimpas.length} tags geradas: ${tagsLimpas.join(', ')}`);
          resolve(tagsLimpas);
        } catch (error) {
          console.error('❌ Erro ao parsear resposta da IA:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição OpenAI:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}


/**
 * Extrai itens de feed (notícias) de uma página de listagem usando IA
 * @param {Object} params - Parâmetros
 * @param {string} params.fonteUrl - URL base da fonte (para resolver URLs relativas)
 * @param {string} params.fonteTitulo - Título da fonte
 * @param {string} params.conteudoJina - Conteúdo extraído pelo Jina AI Reader
 * @param {number} params.limite - Limite de notícias a extrair (padrão: 10)
 * @returns {Promise<Array>} - Array de itens do feed [{titulo, url, chamada?, imagemUrl?, dataPublicacao?}]
 */
export async function extractFeedItemsWithAI({ fonteUrl, fonteTitulo, conteudoJina, limite = 20 }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no .env');
  }

  // Extrair domínio base para resolver URLs relativas
  const urlObj = new URL(fonteUrl);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

  const prompt = `Você é um parser de notícias especializado em extrair informações estruturadas de páginas de listagem de notícias.

FONTE: ${fonteTitulo}
URL BASE: ${baseUrl}

CONTEÚDO DA PÁGINA (extraído via Jina AI Reader):
${conteudoJina.substring(0, 30000)}

TAREFA:
Analise o conteúdo acima e extraia as ${limite} notícias mais recentes encontradas na página.

Para cada notícia, extraia:
1. **titulo** (obrigatório): O título da notícia
2. **url** (obrigatório): Link completo para a notícia (se for relativo, combine com a URL base)
3. **chamada** (opcional): Resumo/subtítulo se disponível
4. **imagemUrl** (opcional): URL da imagem de capa se encontrada
5. **dataPublicacao** (opcional): Data de publicação no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ) se disponível

REGRAS:
- Extraia APENAS notícias reais, não menus, links de navegação ou anúncios
- URLs devem ser absolutas (começando com http:// ou https://)
- Se a URL for relativa (ex: /news/artigo), combine com a URL base: ${baseUrl}
- Não invente informações - se não encontrar, deixe o campo vazio ou null
- Priorize notícias mais recentes
- Retorne no máximo ${limite} itens

FORMATO DE RESPOSTA (JSON):
{
  "items": [
    {
      "titulo": "Título da notícia",
      "url": "https://exemplo.com/noticia-completa",
      "chamada": "Resumo ou subtítulo (opcional)",
      "imagemUrl": "https://exemplo.com/imagem.jpg (opcional)",
      "dataPublicacao": "2025-01-15T10:30:00.000Z (opcional)"
    }
  ]
}

Retorne APENAS o JSON, sem texto adicional.`;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um parser de notícias especializado. Sempre responda em JSON válido com array de items extraídos.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2, // Baixa temperatura para extração mais precisa
      max_tokens: 4000
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`🔍 Extraindo até ${limite} notícias de ${fonteTitulo}...`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error('❌ OpenAI error:', data);
            reject(new Error(`OpenAI retornou status ${res.statusCode}`));
            return;
          }

          const response = JSON.parse(data);
          const content = response.choices[0].message.content;

          // Remove marcadores de código markdown se houver
          let jsonString = content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

          const resultado = JSON.parse(jsonString);
          const items = resultado.items || [];

          // Validar e limpar items
          const itemsValidos = items
            .filter(item => item.titulo && item.url)
            .map(item => ({
              titulo: item.titulo.trim(),
              url: item.url.trim(),
              chamada: item.chamada?.trim() || null,
              imagemUrl: item.imagemUrl?.trim() || null,
              dataPublicacao: item.dataPublicacao ? new Date(item.dataPublicacao) : null
            }))
            .filter(item => {
              // Validar URL
              try {
                new URL(item.url);
                return true;
              } catch {
                console.warn(`⚠️ URL inválida ignorada: ${item.url}`);
                return false;
              }
            })
            .slice(0, limite);

          console.log(`✅ ${itemsValidos.length} notícias extraídas de ${fonteTitulo}`);
          resolve(itemsValidos);
        } catch (error) {
          console.error('❌ Erro ao parsear resposta da IA:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição OpenAI:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}