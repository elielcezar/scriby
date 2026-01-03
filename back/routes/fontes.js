import express from 'express';
import prisma from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { authenticateJwtOrApiKey } from '../middleware/apiKeyAuth.js';
import { validate, fonteCreateSchema, fonteUpdateSchema } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { fetchContentWithJina, extractFeedItemsWithAI } from '../services/aiService.js';

const router = express.Router();

/**
 * Testar fonte antes de salvar (protegido por JWT)
 * POST /api/fontes/testar
 */
router.post('/fontes/testar', authenticateToken, async (req, res, next) => {
    try {
        const { url, titulo } = req.body;
        console.log(`🧪 Testando fonte: ${titulo || url}`);

        if (!url) {
            return res.status(400).json({ error: 'URL é obrigatória para o teste.' });
        }

        // 1. Tentar buscar conteúdo
        console.log('   📡 Conectando ao site...');
        let conteudo;
        try {
            conteudo = await fetchContentWithJina(url);
        } catch (error) {
            console.error('   ❌ Falha na conexão:', error.message);
            return res.status(400).json({ 
                error: 'Não foi possível acessar a URL. O site pode estar offline ou bloqueando acesso.',
                details: error.message
            });
        }

        if (!conteudo || conteudo.length < 100) {
            return res.status(400).json({ 
                error: 'Conteúdo retornado é muito curto ou vazio. Verifique a URL.' 
            });
        }

        // 2. Tentar extrair notícias
        console.log('   🤖 Extraindo notícias...');
        try {
            const items = await extractFeedItemsWithAI({
                fonteUrl: url,
                fonteTitulo: titulo || 'Teste',
                conteudoJina: conteudo,
                limite: 5 // Limite menor para teste rápido
            });

            if (items.length === 0) {
                return res.status(200).json({
                    success: false,
                    message: 'O site foi acessado, mas a IA não encontrou nenhuma notícia clara na página.',
                    items: []
                });
            }

            console.log(`   ✅ Sucesso! ${items.length} itens encontrados.`);
            return res.status(200).json({
                success: true,
                message: `Sucesso! Encontramos ${items.length} notícias nesta página.`,
                items: items
            });

        } catch (error) {
            console.error('   ❌ Falha na extração:', error.message);
            return res.status(400).json({ 
                error: 'Falha ao analisar o conteúdo da página.',
                details: error.message 
            });
        }

    } catch (error) {
        console.error('❌ Erro inesperado no teste:', error);
        next(error);
    }
});

/**
 * Criar fonte (protegido por JWT)
 * POST /api/fontes
 */
router.post('/fontes', authenticateToken, validate(fonteCreateSchema), async (req, res, next) => {
    try {
        console.log('📥 Recebendo requisição POST /fontes');
        const { titulo, url } = req.body;

        const fonte = await prisma.fonte.create({
            data: {
                userId: req.user.id,
                titulo,
                url,
            }
        });

        console.log('✅ Fonte criada com sucesso:', fonte.id);
        res.status(201).json(fonte);
    } catch (error) {
        console.error('❌ Erro ao criar fonte:', error);
        next(error);
    }
});

/**
 * Listar todas as fontes (protegido por JWT ou API Key)
 * GET /api/fontes
 */
router.get('/fontes', authenticateJwtOrApiKey, async (req, res, next) => {
    try {
        console.log('📋 Recebendo requisição GET /fontes');

        const filtro = {
            userId: req.user?.id || req.user?.id // Filtrar por usuário se autenticado
        };

        // Se for chamada via API Key (n8n), buscar todas as fontes
        if (req.headers['x-api-key'] && !req.user) {
            delete filtro.userId;
        }

        // Filtro por busca no título ou URL
        if (req.query.search) {
            filtro.OR = [
                { titulo: { contains: req.query.search } },
                { url: { contains: req.query.search } }
            ];
        }

        const fontes = await prisma.fonte.findMany({
            where: filtro,
            orderBy: {
                titulo: 'asc'
            }
        });

        console.log(`✅ ${fontes.length} fontes encontradas`);
        
        // Se for chamada via API Key (N8N), retornar formato esperado
        if (req.headers['x-api-key']) {
            return res.status(200).json({ fontes });
        }
        
        // Se for chamada via JWT (admin), retornar array direto
        res.status(200).json(fontes);
    } catch (error) {
        console.error('❌ Erro ao listar fontes:', error);
        next(error);
    }
});

/**
 * Obter fonte por ID (protegido por JWT)
 * GET /api/fontes/:id
 */
router.get('/fontes/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;
        console.log(`📄 Recebendo requisição GET /fontes/${id}`);

        const fonte = await prisma.fonte.findUnique({
            where: { id: parseInt(id) }
        });

        if (!fonte) {
            throw new NotFoundError('Fonte não encontrada');
        }

        console.log('✅ Fonte encontrada:', fonte.id);
        res.status(200).json(fonte);
    } catch (error) {
        console.error('❌ Erro ao buscar fonte:', error);
        next(error);
    }
});

/**
 * Atualizar fonte (protegido por JWT)
 * PUT /api/fontes/:id
 */
router.put('/fontes/:id', authenticateToken, validate(fonteUpdateSchema), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { titulo, url } = req.body;
        console.log(`📝 Recebendo requisição PUT /fontes/${id}`);

        // Verificar se fonte existe
        const fonteExistente = await prisma.fonte.findUnique({
            where: { id: parseInt(id) }
        });

        if (!fonteExistente) {
            throw new NotFoundError('Fonte não encontrada');
        }

        // Verificar ownership
        if (fonteExistente.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Você só pode editar suas próprias fontes'
            });
        }

        const dataToUpdate = {};
        if (titulo !== undefined) dataToUpdate.titulo = titulo;
        if (url !== undefined) dataToUpdate.url = url;

        const fonte = await prisma.fonte.update({
            where: { id: parseInt(id) },
            data: dataToUpdate
        });

        console.log('✅ Fonte atualizada com sucesso');
        res.status(200).json(fonte);
    } catch (error) {
        console.error('❌ Erro ao atualizar fonte:', error);
        next(error);
    }
});

/**
 * Deletar fonte (protegido por JWT)
 * DELETE /api/fontes/:id
 */
router.delete('/fontes/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ Recebendo requisição DELETE /fontes/${id}`);

        // Verificar se fonte existe
        const fonte = await prisma.fonte.findUnique({
            where: { id: parseInt(id) }
        });

        if (!fonte) {
            throw new NotFoundError('Fonte não encontrada');
        }

        // Verificar ownership
        if (fonte.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Você só pode deletar suas próprias fontes'
            });
        }

        await prisma.fonte.delete({
            where: { id: parseInt(id) }
        });

        console.log('✅ Fonte deletada com sucesso');
        res.status(200).json({ message: 'Fonte deletada com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao deletar fonte:', error);
        next(error);
    }
});

export default router;

