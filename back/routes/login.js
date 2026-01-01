import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { validate, loginSchema, registerSchema } from '../middleware/validation.js';
import { UnauthorizedError, ConflictError } from '../utils/errors.js';

const router = express.Router();

// Cadastro público (qualquer um pode se cadastrar)
router.post('/register', validate(registerSchema), async (req, res, next) => {
    try {
        console.log('Recebendo requisição POST /register (cadastro público)');
        const { name, email, password } = req.body;

        // Verificar se email já existe
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            throw new ConflictError('Email já cadastrado');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                role: 'EDITOR' // Por padrão, novos usuários são EDITOR
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            }
        });

        console.log('Usuário cadastrado:', user);
        res.status(201).json({
            message: 'Usuário cadastrado com sucesso',
            user
        });
    } catch (error) {
        next(error);
    }
});

// Login do usuario
router.post('/login', validate(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        console.log('Tentativa de login:', email);

        // Buscar usuário pelo email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            throw new UnauthorizedError('Email ou senha inválidos');
        }

        // Verificar senha
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            throw new UnauthorizedError('Email ou senha inválidos');
        }

        // Gerar tokens JWT
        const payload = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };

        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        // Retornar tokens e dados do usuário (sem a senha)
        res.status(200).json({
            message: 'Login bem-sucedido',
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                createdAt: user.createdAt,
            }
        });

    } catch (error) {
        next(error);
    }
});

// Rota para refresh do token
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new UnauthorizedError('Refresh token não fornecido');
        }

        // Verificar refresh token (vai lançar erro se inválido)
        const { verifyToken } = await import('../utils/jwt.js');
        const decoded = verifyToken(refreshToken);

        // Buscar usuário para garantir que ainda existe
        const user = await prisma.user.findUnique({
            where: { id: decoded.id }
        });

        if (!user) {
            throw new UnauthorizedError('Usuário não encontrado');
        }

        // Gerar novo access token
        const payload = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };

        const newAccessToken = generateAccessToken(payload);

        res.status(200).json({
            accessToken: newAccessToken,
        });

    } catch (error) {
        next(error);
    }
});

export default router;