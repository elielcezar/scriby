import express from 'express';
import prisma from '../config/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate, tagSchema } from '../middleware/validation.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

const router = express.Router();

// Criar tag (protegido)
router.post('/tags', authenticateToken, validate(tagSchema), async (req, res, next) => {
    try {
        console.log('Recebendo requisição POST /tags');
        const { nome } = req.body;

        // Verificar se tag já existe para este usuário
        const existingTag = await prisma.tag.findFirst({
            where: {
                userId: req.user.id,
                nome: nome
            }
        });

        if (existingTag) {
            throw new ConflictError('Tag já existe');
        }

        const response = await prisma.tag.create({
            data: {
                userId: req.user.id,
                nome
            }
        });

        console.log('Tag criada:', response);
        res.status(201).json(response);
    } catch (error) {
        next(error);
    }
})

// Lista tags (protegido - filtra por usuário)
router.get('/tags', authenticateToken, async (req, res, next) => {
    try {
        console.log('Recebendo requisição GET /tags');

        const filtro = {
            userId: req.user.id
        };

        if (req.query.nome) {
            filtro.nome = { contains: req.query.nome };
        }

        const tags = await prisma.tag.findMany({
            where: filtro,
            orderBy: {
                nome: 'asc'
            }
        });

        console.log(`Tags encontradas: ${tags.length}`);
        res.status(200).json(tags);
    } catch (error) {
        next(error);
    }
});

// Atualizar tag (protegido)
router.put('/tags/:id', authenticateToken, validate(tagSchema), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nome } = req.body;

        // Verificar se tag existe e pertence ao usuário
        const tagExistente = await prisma.tag.findFirst({
            where: {
                id: parseInt(id),
                userId: req.user.id
            }
        });

        if (!tagExistente) {
            throw new NotFoundError('Tag não encontrada');
        }

        const tag = await prisma.tag.update({
            where: { id: parseInt(id) },
            data: { nome }
        });

        res.status(200).json(tag);
    } catch (error) {
        next(error);
    }
});

// Deletar tag (protegido)
router.delete('/tags/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Verificar se tag existe e pertence ao usuário
        const tag = await prisma.tag.findFirst({
            where: {
                id: parseInt(id),
                userId: req.user.id
            }
        });

        if (!tag) {
            throw new NotFoundError('Tag não encontrada');
        }

        await prisma.tag.delete({
            where: { id: parseInt(id) }
        });

        res.status(200).json({ message: 'Tag deletada com sucesso' });
    } catch (error) {
        next(error);
    }
});

export default router;
