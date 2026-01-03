import prisma from '../config/prisma.js';
import { fetchContentWithJina, extractFeedItemsWithAI } from './aiService.js';

/**
 * Sincroniza uma única fonte de notícias
 * @param {Object} fonte - Objeto da fonte (deve conter id, url, titulo)
 * @returns {Promise<Object>} - Estatísticas da sincronização
 */
export async function syncSource(fonte) {
    const stats = {
        novos: 0,
        duplicados: 0,
        erro: null
    };

    try {
        console.log(`\n🔄 Sincronizando: ${fonte.titulo}`);

        // 1. Buscar conteúdo
        const conteudo = await fetchContentWithJina(fonte.url);
        
        if (!conteudo || conteudo.length < 100) {
            throw new Error('Conteúdo insuficiente ou vazio retornado pelo Jina AI');
        }

        // 2. Extrair itens com IA
        const items = await extractFeedItemsWithAI({
            fonteUrl: fonte.url,
            fonteTitulo: fonte.titulo,
            conteudoJina: conteudo,
            limite: 10
        });

        // 3. Salvar no banco
        for (const item of items) {
            try {
                // Verificar duplicidade pela URL
                const existente = await prisma.feedItem.findUnique({
                    where: { url: item.url }
                });

                if (existente) {
                    stats.duplicados++;
                    continue;
                }

                // Criar novo item
                await prisma.feedItem.create({
                    data: {
                        fonteId: fonte.id,
                        titulo: item.titulo,
                        url: item.url,
                        chamada: item.chamada,
                        imagemUrl: item.imagemUrl,
                        dataPublicacao: item.dataPublicacao
                    }
                });

                stats.novos++;
                console.log(`   ✨ Novo: ${item.titulo.substring(0, 50)}...`);

            } catch (err) {
                if (err.code === 'P2002') { // Unique constraint
                    stats.duplicados++;
                } else {
                    console.error(`   ❌ Erro ao salvar item: ${err.message}`);
                }
            }
        }

    } catch (error) {
        console.error(`   ❌ Falha na fonte ${fonte.titulo}: ${error.message}`);
        stats.erro = error.message;
    }

    return stats;
}
