import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { generateChatResponse, fetchContentWithJinaAndMarkdown } from '../services/aiService.js';

const router = express.Router();

/**
 * Endpoint de Chat Conversacional
 * POST /api/chat
 */
router.post('/', authenticateToken, async (req, res, next) => {
    try {
        const { messages, url } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Histórico de mensagens é obrigatório' });
        }

        let contextContent = null;
        
        // Se for a primeira mensagem e houver uma URL, buscar conteúdo
        if (url && messages.length <= 1) {
            try {
                console.log(`🔍 Chat buscando contexto de: ${url}`);
                const jinaResult = await fetchContentWithJinaAndMarkdown(url);
                contextContent = jinaResult.content;
            } catch (error) {
                console.warn('⚠️ Erro ao buscar contexto da URL para o chat:', error.message);
            }
        }

        const response = await generateChatResponse({
            messages,
            contextContent
        });

        res.json({ response });
    } catch (error) {
        console.error('❌ Erro no Chat IA:', error);
        next(error);
    }
});

export default router;
