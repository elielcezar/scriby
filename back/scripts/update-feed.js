import prisma from '../config/prisma.js';
import { syncSource } from '../services/feedSyncService.js';

// Configuração
const CONCURRENCY_LIMIT = 3;

async function main() {
    console.log('🚀 Iniciando script de atualização de feeds...');
    const startTime = Date.now();

    try {
        // 1. Buscar todas as fontes ativas
        const fontes = await prisma.fonte.findMany({
            where: { ativo: true },
            orderBy: { id: 'asc' } // Processar em ordem determinística
        });

        if (fontes.length === 0) {
            console.log('⚠️ Nenhuma fonte ativa encontrada.');
            return;
        }

        console.log(`📚 ${fontes.length} fontes encontradas.`);

        // 2. Processar com concorrência limitada
        const stats = {
            processadas: 0,
            erros: 0,
            novosItens: 0,
            duplicados: 0
        };

        for (let i = 0; i < fontes.length; i += CONCURRENCY_LIMIT) {
            const chunk = fontes.slice(i, i + CONCURRENCY_LIMIT);
            console.log(`\n--- Processando lote ${Math.floor(i / CONCURRENCY_LIMIT) + 1} (${chunk.length} fontes) ---`);

            const results = await Promise.allSettled(
                chunk.map(fonte => syncSource(fonte))
            );

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const s = result.value;
                    stats.novosItens += s.novos;
                    stats.duplicados += s.duplicados;
                    if (s.erro) {
                        stats.erros++;
                    } else {
                        stats.processadas++;
                    }
                } else {
                    console.error(`❌ Erro crítico no worker:`, result.reason);
                    stats.erros++;
                }
            });
        }

        // 3. Relatório final
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('\n==========================================');
        console.log('✅ Atualização concluída!');
        console.log(`⏱️  Tempo total: ${duration}s`);
        console.log(`📊 Fontes processadas: ${stats.processadas}/${fontes.length}`);
        console.log(`❌ Fontes com erro: ${stats.erros}`);
        console.log(`✨ Notícias novas: ${stats.novosItens}`);
        console.log(`🔄 Duplicadas: ${stats.duplicados}`);
        console.log('==========================================\n');

    } catch (error) {
        console.error('❌ Erro fatal no script:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Executar
main();
