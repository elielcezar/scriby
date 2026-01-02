import express from 'express';
import prisma from '../config/prisma.js';
import { uploadS3 } from '../config/s3.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate, postCreateSchema } from '../middleware/validation.js';
import { NotFoundError } from '../utils/errors.js';
import { fetchContentWithJinaAndMarkdown, generateNewsWithAI, generateSlug, categorizePostWithAI, generateTagsWithAI } from '../services/aiService.js';
import { processImageFromSource } from '../services/imageService.js';
import { getPlaceholderImageUrl } from '../utils/imagePlaceholder.js';

const router = express.Router();

const baseUrl = 'https://cms.ecwd.cloud';

// Middleware para tratamento de erros do multer
const handleMulterError = (upload) => {
    return (req, res, next) => {
        upload(req, res, (err) => {
            if (err) {
                console.error('❌ Erro no upload de arquivos:', err.message);
                console.error('Stack:', err.stack);
                console.error('Detalhes do erro:', {
                    code: err.code,
                    field: err.field,
                    name: err.name
                });

                if (err.code === 'LIMIT_FILE_SIZE') {
                    const maxSizeMB = 10;
                    const fileName = err.field ? `O arquivo "${err.field}"` : 'Um arquivo';
                    return res.status(400).json({
                        error: 'Arquivo muito grande',
                        message: `${fileName} excede o limite de ${maxSizeMB}MB. Por favor, comprima a imagem antes de enviar.`
                    });
                }

                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({
                        error: 'Muitos arquivos',
                        message: 'O número máximo de arquivos é 18'
                    });
                }

                if (err.message && err.message.includes('Tipo de arquivo inválido')) {
                    return res.status(400).json({
                        error: 'Tipo de arquivo inválido',
                        message: err.message
                    });
                }

                // Erros do S3/AWS - capturar qualquer erro relacionado ao S3
                const isS3Error = err.name === 'S3Client' ||
                    err.$metadata ||
                    err.Code ||
                    err.code === 'CredentialsError' ||
                    err.name === 'NoCredentialsError' ||
                    err.name === 'AccessDenied' ||
                    err.code === 'AccessDenied' ||
                    err.message?.includes('S3') ||
                    err.message?.includes('AWS') ||
                    err.message?.includes('bucket') ||
                    err.stack?.includes('s3') ||
                    err.stack?.includes('S3');

                if (isS3Error) {
                    console.error('❌ Erro no S3/AWS:', err);
                    console.error('   Tipo:', err.name || err.constructor?.name);
                    console.error('   Código:', err.code || err.Code);
                    console.error('   Mensagem:', err.message);
                    console.error('   Stack completo:', err.stack);
                    if (err.$metadata) {
                        console.error('   Metadata:', JSON.stringify(err.$metadata, null, 2));
                    }

                    let errorMessage = 'Erro ao fazer upload para S3';
                    let statusCode = 500;

                    if (err.name === 'NoCredentialsError' || err.code === 'CredentialsError' || err.message?.includes('credentials')) {
                        errorMessage = 'Credenciais AWS não configuradas ou inválidas. Verifique as variáveis AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no servidor.';
                        statusCode = 500;
                    } else if (err.Code === 'NoSuchBucket' || err.message?.includes('bucket') || err.message?.includes('does not exist')) {
                        errorMessage = `Bucket S3 não encontrado. Verifique se o bucket "${process.env.AWS_S3_BUCKET}" existe na região ${process.env.AWS_REGION}.`;
                        statusCode = 500;
                    } else if (err.Code === 'AccessDenied' || err.name === 'AccessDenied' || err.message?.includes('Access Denied') || err.message?.includes('not authorized')) {
                        errorMessage = 'Acesso negado ao S3. O usuário IAM não tem permissão s3:PutObject. Verifique as permissões IAM.';
                        statusCode = 403;
                    } else if (err.message?.includes('region') || err.message?.includes('Região')) {
                        errorMessage = `Erro de região AWS. Verifique se a região "${process.env.AWS_REGION}" está correta.`;
                        statusCode = 500;
                    } else if (err.Code === 'AccessControlListNotSupported' || err.name === 'AccessControlListNotSupported' || err.message?.includes('does not allow ACLs')) {
                        errorMessage = 'O bucket S3 não permite ACLs. Remova a configuração ACL do código e use política de bucket para acesso público.';
                        statusCode = 400;
                    } else {
                        errorMessage = `Erro S3: ${err.message || 'Erro desconhecido'}`;
                    }

                    return res.status(statusCode).json({
                        error: 'Erro ao fazer upload para S3',
                        message: errorMessage,
                        details: {
                            type: err.name || err.constructor?.name,
                            code: err.code || err.Code || 'N/A'
                        }
                    });
                }

                return res.status(500).json({
                    error: 'Erro ao processar upload',
                    message: process.env.NODE_ENV === 'development' ? err.message : 'Erro ao fazer upload de imagens'
                });
            }
            next();
        });
    };
};

// Criar post (protegido)
router.post('/posts', authenticateToken, handleMulterError(uploadS3.array('imagens', 18)), async (req, res, next) => {
    try {
        console.log('📥 Recebendo requisição POST /posts');
        console.log('📦 Files recebidos:', req.files ? req.files.length : 0);
        console.log('📋 Headers:', {
            'content-type': req.headers['content-type'],
            'content-length': req.headers['content-length']
        });

        const {
            titulo,
            chamada,
            conteudo,
            urlAmigavel,
            status,
            destaque,
            dataPublicacao,
            categorias,
            tags
        } = req.body;

        console.log('📝 Dados body recebidos:', {
            titulo,
            chamada,
            conteudo,
            urlAmigavel,
            status,
            destaque,
            dataPublicacao,
            categorias,
            tags
        });

        // URLs das imagens no S3
        const imagens = req.files ? req.files.map(file => {
            console.log('📸 Arquivo processado:', {
                originalname: file.originalname,
                location: file.location,
                size: file.size,
                mimetype: file.mimetype
            });
            return file.location;
        }) : [];

        console.log('🔗 URLs das imagens:', imagens);

        // Validações básicas
        if (!titulo || !chamada || !conteudo || !urlAmigavel) {
            return res.status(400).json({
                error: 'Campos obrigatórios faltando',
                message: 'Título, chamada, conteúdo e URL amigável são obrigatórios'
            });
        }

        console.log('💾 Criando post no banco de dados...');

        // Criar relacionamentos de categorias e tags
        const categoriasData = categorias ? JSON.parse(categorias).map(categoriaId => ({
            categoriaId: parseInt(categoriaId)
        })) : [];

        const tagsData = tags ? JSON.parse(tags).map(tagId => ({
            tagId: parseInt(tagId)
        })) : [];

        // Verificar se URL amigável já existe
        let urlFinal = urlAmigavel;
        let contador = 1;
        while (await prisma.post.findUnique({ where: { urlAmigavel: urlFinal } })) {
            urlFinal = `${urlAmigavel}-${contador}`;
            contador++;
        }

        const postCriado = await prisma.post.create({
            data: {
                userId: req.user.id, // Associar ao usuário logado
                titulo,
                chamada,
                conteudo,
                urlAmigavel: urlFinal,
                status: status || 'RASCUNHO',
                destaque: destaque === 'true' || destaque === true,
                dataPublicacao: dataPublicacao ? new Date(dataPublicacao) : null,
                imagens: imagens,
                categorias: {
                    create: categoriasData
                },
                tags: {
                    create: tagsData
                }
            },
            include: {
                categorias: {
                    include: {
                        categoria: true
                    }
                },
                tags: {
                    include: {
                        tag: true
                    }
                }
            }
        });

        // Formatar resposta
        const response = {
            id: postCriado.id,
            titulo: postCriado.titulo,
            chamada: postCriado.chamada,
            conteudo: postCriado.conteudo,
            urlAmigavel: postCriado.urlAmigavel,
            imagens: postCriado.imagens,
            status: postCriado.status,
            destaque: postCriado.destaque,
            dataPublicacao: postCriado.dataPublicacao,
            createdAt: postCriado.createdAt,
            updatedAt: postCriado.updatedAt,
            categorias: postCriado.categorias.map(pc => ({
                id: pc.categoria.id,
                nome: pc.categoria.nome
            })),
            tags: postCriado.tags.map(pt => ({
                id: pt.tag.id,
                nome: pt.tag.nome
            }))
        };

        console.log('✅ Post criado com sucesso:', response.id);
        res.status(201).json(response);
    } catch (error) {
        console.error('❌ Erro ao criar post:', error);
        console.error('Erro completo:', {
            message: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack
        });
        next(error);
    }
})

// Listar posts para admin (protegido - retorna todos os posts)
router.get('/admin/posts', authenticateToken, async (req, res, next) => {
    try {
        console.log('Recebendo requisição GET /admin/posts (ADMIN)');
        console.log('Query params:', req.query);

        // Filtrar apenas posts do usuário logado
        const filtro = {
            userId: req.user.id
        };
        
        // Filtro por status (opcional para admin)
        if (req.query.status) {
            filtro.status = req.query.status;
        }

        // Filtro por destaque/featured
        const destaqueValue = req.query.featured || req.query.destaque;
        if (destaqueValue) filtro.destaque = destaqueValue === 'true';

        // Filtro por categoria
        const categoriaValue = req.query.category || req.query.categoria;
        if (categoriaValue) {
            const categoriaId = parseInt(categoriaValue);
            if (!isNaN(categoriaId)) {
                filtro.categorias = {
                    some: {
                        categoriaId: categoriaId
                    }
                };
            } else {
                filtro.categorias = {
                    some: {
                        categoria: {
                            nome: categoriaValue
                        }
                    }
                };
            }
        }

        // Filtro por tag
        if (req.query.tag) {
            const tagId = parseInt(req.query.tag);
            if (!isNaN(tagId)) {
                filtro.tags = {
                    some: {
                        tagId: tagId
                    }
                };
            } else {
                filtro.tags = {
                    some: {
                        tag: {
                            nome: req.query.tag
                        }
                    }
                };
            }
        }

        const posts = await prisma.post.findMany({
            where: filtro,
            include: {
                categorias: {
                    include: {
                        categoria: true
                    }
                },
                tags: {
                    include: {
                        tag: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc' // Ordenar por data de criação (mais recentes primeiro)
            }
        });

        // Transformar posts para incluir categorias formatadas
        const postsCompleto = posts.map(post => ({
            id: post.id,
            titulo: post.titulo,
            chamada: post.chamada,
            conteudo: post.conteudo,
            urlAmigavel: post.urlAmigavel,
            imagens: post.imagens,
            status: post.status,
            destaque: post.destaque,
            dataPublicacao: post.dataPublicacao,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            categorias: post.categorias.map(pc => ({
                id: pc.categoria.id,
                nome: pc.categoria.nome
            })),
            tags: post.tags.map(pt => ({
                id: pt.tag.id,
                nome: pt.tag.nome
            }))
        }));

        console.log(`✅ Posts encontrados (ADMIN): ${postsCompleto.length}`);
        res.status(200).json(postsCompleto);

    } catch (error) {
        next(error);
    }
});

// Listar posts por usuário (público)
// IMPORTANTE: Esta rota deve vir DEPOIS de todas as outras rotas de posts
// para evitar conflitos com rotas como /posts, /admin/posts, etc.
router.get('/:userId/posts', async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        // Validar que userId não é uma rota reservada
        const reservedRoutes = ['posts', 'admin', 'register', 'login', 'usuarios', 'categorias', 'tags', 'pautas', 'fontes', 'upload'];
        if (reservedRoutes.includes(userId)) {
            return next(); // Passar para a próxima rota
        }
        
        console.log(`Recebendo requisição GET /${userId}/posts`);
        console.log('Query params:', req.query);

        // Verificar se usuário existe
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Criar objeto de filtro apenas com parâmetros definidos
        // IMPORTANTE: Endpoint público sempre retorna apenas posts PUBLICADOS do usuário
        const filtro = {
            userId: userId,
            status: 'PUBLICADO' // Sempre filtrar por status PUBLICADO
        };

        // Filtro por destaque/featured
        const destaqueValue = req.query.featured || req.query.destaque;
        if (destaqueValue) filtro.destaque = destaqueValue === 'true';

        // Filtro por categoria
        const categoriaValue = req.query.category || req.query.categoria;
        if (categoriaValue) {
            const categoriaId = parseInt(categoriaValue);
            if (!isNaN(categoriaId)) {
                filtro.categorias = {
                    some: {
                        categoriaId: categoriaId
                    }
                };
            } else {
                filtro.categorias = {
                    some: {
                        categoria: {
                            nome: categoriaValue
                        }
                    }
                };
            }
        }

        // Filtro por tag
        if (req.query.tag) {
            const tagId = parseInt(req.query.tag);
            if (!isNaN(tagId)) {
                filtro.tags = {
                    some: {
                        tagId: tagId
                    }
                };
            } else {
                filtro.tags = {
                    some: {
                        tag: {
                            nome: req.query.tag
                        }
                    }
                };
            }
        }

        const posts = await prisma.post.findMany({
            where: filtro,
            include: {
                categorias: {
                    include: {
                        categoria: true
                    }
                },
                tags: {
                    include: {
                        tag: true
                    }
                }
            },
            orderBy: {
                dataPublicacao: 'desc'
            }
        });

        // Transformar posts
        const postsCompleto = posts.map(post => ({
            id: post.id,
            titulo: post.titulo,
            chamada: post.chamada,
            conteudo: post.conteudo,
            urlAmigavel: post.urlAmigavel,
            imagens: post.imagens,
            status: post.status,
            destaque: post.destaque,
            dataPublicacao: post.dataPublicacao,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            categorias: post.categorias.map(pc => ({
                id: pc.categoria.id,
                nome: pc.categoria.nome
            })),
            tags: post.tags.map(pt => ({
                id: pt.tag.id,
                nome: pt.tag.nome
            })),
            url: `${baseUrl}/posts/${post.urlAmigavel}`
        }));

        console.log(`Posts encontrados para usuário ${userId}: ${postsCompleto.length}`);
        res.status(200).json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            posts: postsCompleto
        });

    } catch (error) {
        next(error);
    }
});

// Listar posts (público - todos os usuários, mantido para compatibilidade)
router.get('/posts', async (req, res, next) => {
    try {
        console.log('Recebendo requisição GET /posts');
        console.log('Query params:', req.query);

        // Criar objeto de filtro apenas com parâmetros definidos
        // IMPORTANTE: Endpoint público sempre retorna apenas posts PUBLICADOS
        const filtro = {
            status: 'PUBLICADO' // Sempre filtrar por status PUBLICADO
        };

        // Filtro por destaque/featured (aceita 'destaque' ou 'featured' para compatibilidade)
        const destaqueValue = req.query.featured || req.query.destaque;
        if (destaqueValue) filtro.destaque = destaqueValue === 'true';

        // Filtro por categoria (aceita 'category' ou 'categoria' para compatibilidade)
        const categoriaValue = req.query.category || req.query.categoria || req.query.site;
        if (categoriaValue) {
            const categoriaId = parseInt(categoriaValue);
            if (!isNaN(categoriaId)) {
                // Filtrar por ID da categoria
                filtro.categorias = {
                    some: {
                        categoriaId: categoriaId
                    }
                };
            } else {
                // Filtrar por nome da categoria
                filtro.categorias = {
                    some: {
                        categoria: {
                            nome: categoriaValue
                        }
                    }
                };
            }
        }

        // Filtro por tag (nome ou ID)
        if (req.query.tag) {
            const tagId = parseInt(req.query.tag);
            if (!isNaN(tagId)) {
                // Filtrar por ID da tag
                filtro.tags = {
                    some: {
                        tagId: tagId
                    }
                };
            } else {
                // Filtrar por nome da tag
                filtro.tags = {
                    some: {
                        tag: {
                            nome: req.query.tag
                        }
                    }
                };
            }
        }

        const posts = await prisma.post.findMany({
            where: filtro,
            include: {
                categorias: {
                    include: {
                        categoria: true
                    }
                },
                tags: {
                    include: {
                        tag: true
                    }
                }
            },
            orderBy: {
                dataPublicacao: 'desc'
            }
        });

        // Transformar posts
        const postsCompleto = posts.map(post => ({
            id: post.id,
            titulo: post.titulo,
            chamada: post.chamada,
            conteudo: post.conteudo,
            urlAmigavel: post.urlAmigavel,
            imagens: post.imagens,
            status: post.status,
            destaque: post.destaque,
            dataPublicacao: post.dataPublicacao,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            categorias: post.categorias.map(pc => ({
                id: pc.categoria.id,
                nome: pc.categoria.nome
            })),
            tags: post.tags.map(pt => ({
                id: pt.tag.id,
                nome: pt.tag.nome
            })),
            url: `${baseUrl}/posts/${post.urlAmigavel}`
        }));

        console.log(`Posts encontrados: ${postsCompleto.length}`);
        res.status(200).json(postsCompleto);

    } catch (error) {
        next(error);
    }
});

// Obter post pelo ID (público)
// Obter post por ID para admin (protegido - retorna todos os status)
router.get('/admin/posts/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        console.log(`📥 Recebendo requisição GET /admin/posts/${id} (ADMIN)`);

        const post = await prisma.post.findFirst({
            where: {
                id: parseInt(id),
                userId: req.user.role === 'ADMIN' ? undefined : req.user.id
            },
            include: {
                categorias: {
                    include: {
                        categoria: true
                    }
                },
                tags: {
                    include: {
                        tag: true
                    }
                }
            }
        });

        if (!post) {
            throw new NotFoundError('Post não encontrado');
        }

        // Montar resposta
        const postCompleto = {
            id: post.id,
            titulo: post.titulo,
            chamada: post.chamada,
            conteudo: post.conteudo,
            urlAmigavel: post.urlAmigavel,
            imagens: post.imagens || [],
            status: post.status,
            destaque: post.destaque,
            dataPublicacao: post.dataPublicacao,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            categorias: post.categorias.map(pc => ({
                id: pc.categoria.id,
                nome: pc.categoria.nome
            })),
            tags: post.tags.map(pt => ({
                id: pt.tag.id,
                nome: pt.tag.nome
            }))
        };

        console.log(`✅ Post encontrado (ADMIN): ${postCompleto.titulo}`);
        res.json(postCompleto);
    } catch (error) {
        next(error);
    }
});

// Obter post por ID (público - apenas PUBLICADOS)
// Esta rota deve vir ANTES de /posts/:slug para evitar conflito
router.get('/posts/id/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const post = await prisma.post.findFirst({
            where: {
                id: parseInt(id),
                status: 'PUBLICADO' // Apenas posts publicados
            },
            include: {
                categorias: {
                    include: {
                        categoria: true
                    }
                },
                tags: {
                    include: {
                        tag: true
                    }
                }
            }
        });

        if (!post) {
            throw new NotFoundError('Post não encontrado');
        }

        // Montar resposta
        const postCompleto = {
            id: post.id,
            titulo: post.titulo,
            chamada: post.chamada,
            conteudo: post.conteudo,
            urlAmigavel: post.urlAmigavel,
            imagens: post.imagens,
            status: post.status,
            destaque: post.destaque,
            dataPublicacao: post.dataPublicacao,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            categorias: post.categorias.map(pc => ({
                id: pc.categoria.id,
                nome: pc.categoria.nome
            })),
            tags: post.tags.map(pt => ({
                id: pt.tag.id,
                nome: pt.tag.nome
            }))
        };

        res.json(postCompleto);
    } catch (error) {
        next(error);
    }
});


// Obter post pela URL amigável (público)
router.get('/posts/:slug', async (req, res, next) => {
    try {
        console.log('Recebendo requisição GET /posts/:slug');
        const { slug } = req.params;
        console.log('Slug:', slug);

        // Buscar post pela URL amigável
        const post = await prisma.post.findUnique({
            where: {
                urlAmigavel: slug
            },
            include: {
                categorias: {
                    include: {
                        categoria: true
                    }
                },
                tags: {
                    include: {
                        tag: true
                    }
                }
            }
        });

        if (!post) {
            throw new NotFoundError('Post não encontrado');
        }

        // Verificar se o post está publicado (endpoint público - apenas posts PUBLICADOS)
        if (post.status !== 'PUBLICADO') {
            throw new NotFoundError('Post não encontrado');
        }

        // Montar resposta
        const postCompleto = {
            id: post.id,
            titulo: post.titulo,
            chamada: post.chamada,
            conteudo: post.conteudo,
            urlAmigavel: post.urlAmigavel,
            imagens: post.imagens,
            status: post.status,
            destaque: post.destaque,
            dataPublicacao: post.dataPublicacao,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            categorias: post.categorias.map(pc => ({
                id: pc.categoria.id,
                nome: pc.categoria.nome
            })),
            tags: post.tags.map(pt => ({
                id: pt.tag.id,
                nome: pt.tag.nome
            }))
        };

        res.json(postCompleto);
        console.log('Post encontrado:', post.titulo);
    } catch (error) {
        next(error);
    }
});

// Atualizar post (protegido)
router.put('/posts/:id', authenticateToken, handleMulterError(uploadS3.array('imagens', 18)), async (req, res, next) => {
    try {
        console.log('Recebendo requisição PUT /posts');

        const { id } = req.params;
        const {
            titulo,
            chamada,
            conteudo,
            urlAmigavel,
            status,
            destaque,
            dataPublicacao,
            categorias,
            tags,
            oldImages
        } = req.body;

        // Verificar se post existe
        const postExistente = await prisma.post.findUnique({
            where: { id: parseInt(id) }
        });

        if (!postExistente) {
            throw new NotFoundError('Post não encontrado');
        }

        // Verificar ownership (usuário só pode editar seus próprios posts, exceto admin)
        if (postExistente.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Você só pode editar seus próprios posts'
            });
        }

        // Processar imagens
        let imagens = [];

        // Se oldImages foi enviado (mesmo que vazio), usar esse valor
        // Isso permite remover todas as imagens ao enviar array vazio
        if (oldImages !== undefined) {
            try {
                imagens = JSON.parse(oldImages);
            } catch (error) {
                console.warn('⚠️  Erro ao parsear oldImages, usando imagens existentes:', error.message);
                imagens = postExistente.imagens || [];
            }
        } else {
            // Se oldImages não foi enviado, manter imagens existentes
            imagens = postExistente.imagens || [];
        }

        // Adicionar novas imagens enviadas
        if (req.files && req.files.length > 0) {
            const novasImagens = req.files.map(file => file.location);
            imagens = [...imagens, ...novasImagens];
        }

        console.log(`📸 Imagens processadas: ${imagens.length} total (${req.files?.length || 0} novas)`);

        // Verificar se URL amigável já existe (se mudou)
        let urlFinal = urlAmigavel || postExistente.urlAmigavel;
        if (urlAmigavel && urlAmigavel !== postExistente.urlAmigavel) {
            let contador = 1;
            let urlTemp = urlFinal;
            while (await prisma.post.findUnique({ where: { urlAmigavel: urlTemp } })) {
                urlTemp = `${urlAmigavel}-${contador}`;
                contador++;
            }
            urlFinal = urlTemp;
        }

        // Atualizar dados do post
        const dataPost = {
            titulo: titulo || postExistente.titulo,
            chamada: chamada || postExistente.chamada,
            conteudo: conteudo || postExistente.conteudo,
            urlAmigavel: urlFinal,
            status: status || postExistente.status,
            destaque: destaque === 'true' || destaque === true,
            dataPublicacao: dataPublicacao ? new Date(dataPublicacao) : postExistente.dataPublicacao,
            imagens
        };

        console.log(`Atualizando post #${id}...`);

        // Atualizar categorias
        if (categorias !== undefined && categorias !== null) {
            // Deletar categorias existentes
            await prisma.postCategoria.deleteMany({
                where: { postId: parseInt(id) }
            });

            // Adicionar novas categorias se houver
            let categoriasArray = [];
            if (typeof categorias === 'string') {
                try {
                    categoriasArray = JSON.parse(categorias);
                } catch (e) {
                    console.error('Erro ao fazer parse de categorias:', e);
                    categoriasArray = [];
                }
            } else if (Array.isArray(categorias)) {
                categoriasArray = categorias;
            }

            if (categoriasArray.length > 0) {
                for (const categoriaId of categoriasArray) {
                    try {
                        await prisma.postCategoria.create({
                            data: {
                                postId: parseInt(id),
                                categoriaId: parseInt(categoriaId)
                            }
                        });
                    } catch (error) {
                        console.error(`Erro ao criar relacionamento categoria ${categoriaId}:`, error);
                        // Continuar mesmo se uma categoria falhar
                    }
                }
            }
        }

        // Atualizar tags
        if (tags) {
            await prisma.postTag.deleteMany({
                where: { postId: parseInt(id) }
            });

            const tagsArray = JSON.parse(tags);
            for (const tagId of tagsArray) {
                await prisma.postTag.create({
                    data: {
                        postId: parseInt(id),
                        tagId: parseInt(tagId)
                    }
                });
            }
        }

        // Atualizar post
        await prisma.post.update({
            where: { id: parseInt(id) },
            data: dataPost
        });

        // Buscar post atualizado
        const postAtualizado = await prisma.post.findUnique({
            where: { id: parseInt(id) },
            include: {
                categorias: {
                    include: {
                        categoria: true
                    }
                },
                tags: {
                    include: {
                        tag: true
                    }
                }
            }
        });

        // Formatar resposta
        const response = {
            id: postAtualizado.id,
            titulo: postAtualizado.titulo,
            chamada: postAtualizado.chamada,
            conteudo: postAtualizado.conteudo,
            urlAmigavel: postAtualizado.urlAmigavel,
            imagens: postAtualizado.imagens,
            status: postAtualizado.status,
            destaque: postAtualizado.destaque,
            dataPublicacao: postAtualizado.dataPublicacao,
            createdAt: postAtualizado.createdAt,
            updatedAt: postAtualizado.updatedAt,
            categorias: postAtualizado.categorias.map(pc => ({
                id: pc.categoria.id,
                nome: pc.categoria.nome
            })),
            tags: postAtualizado.tags.map(pt => ({
                id: pt.tag.id,
                nome: pt.tag.nome
            }))
        };

        console.log('Post atualizado com sucesso');
        res.status(200).json(response);
    } catch (error) {
        next(error);
    }
});

// Deletar post (protegido)
router.delete('/posts/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        const post = await prisma.post.findUnique({
            where: { id: parseInt(id) }
        });

        if (!post) {
            throw new NotFoundError('Post não encontrado');
        }

        // Verificar ownership (usuário só pode deletar seus próprios posts, exceto admin)
        if (post.userId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Você só pode deletar seus próprios posts'
            });
        }

        await prisma.post.delete({
            where: { id: parseInt(id) }
        });

        res.status(200).json({ message: 'Post deletado com sucesso' });
    } catch (error) {
        next(error);
    }
});

/**
 * Gerar post a partir de prompt (link + instruções)
 * POST /api/posts/gerar-de-prompt
 */
router.post('/posts/gerar-de-prompt', authenticateToken, async (req, res, next) => {
    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({
                error: 'Prompt inválido',
                message: 'O prompt é obrigatório e não pode estar vazio'
            });
        }

        console.log(`🤖 Recebendo requisição POST /posts/gerar-de-prompt`);
        console.log(`📝 Prompt recebido: ${prompt.substring(0, 100)}...`);

        // Extrair URLs do texto usando regex
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = prompt.match(urlRegex) || [];
        const urlPrincipal = urls[0]; // Primeira URL encontrada
        const promptLimpo = prompt.replace(urlRegex, '').trim(); // Remove URLs do prompt

        console.log(`🔗 URLs encontradas: ${urls.length}`);
        if (urlPrincipal) {
            console.log(`   URL principal: ${urlPrincipal}`);
        }
        console.log(`📝 Prompt limpo: ${promptLimpo.substring(0, 100)}...`);

        // Buscar conteúdo da URL usando Jina AI (se houver URL)
        let conteudoComMarkdown = null;
        let conteudoJina = null;
        if (urlPrincipal) {
            try {
                console.log('🔍 Buscando conteúdo da URL com Jina AI...');
                conteudoComMarkdown = await fetchContentWithJinaAndMarkdown(urlPrincipal);
                if (conteudoComMarkdown && conteudoComMarkdown.content.length > 100) {
                    conteudoJina = conteudoComMarkdown.content;
                    console.log(`✅ Conteúdo obtido (${conteudoJina.length} chars)`);
                } else {
                    console.warn('⚠️ Conteúdo obtido é muito curto, usando prompt como conteúdo');
                }
            } catch (error) {
                console.error('❌ Erro ao buscar conteúdo da URL:', error.message);
                console.log('   Continuando sem conteúdo da URL...');
            }
        }

        // Extrair imagem (se houver URL e conteúdo)
        let imagemUrl = null;
        if (urlPrincipal && conteudoComMarkdown) {
            try {
                console.log('🖼️  Tentando extrair imagem...');
                imagemUrl = await processImageFromSource(
                    urlPrincipal,
                    conteudoComMarkdown.markdown
                );
                if (imagemUrl) {
                    console.log(`✅ Imagem extraída e enviada para S3: ${imagemUrl}`);
                }
            } catch (error) {
                console.error('❌ Erro ao processar imagem (continuando sem imagem):', error.message);
            }
        }

        // Preparar dados para a IA
        // Se houver prompt limpo, usar como assunto/resumo
        // Se não houver, usar uma parte do conteúdo ou URL
        const assunto = promptLimpo || (urlPrincipal ? `Conteúdo de ${urlPrincipal}` : 'Post gerado');
        const resumo = promptLimpo || (conteudoJina ? conteudoJina.substring(0, 200) : assunto);
        const conteudos = conteudoJina ? [conteudoJina] : [prompt]; // Se não houver conteúdo Jina, usar o prompt original

        // Gerar notícia com IA apenas em português
        console.log('🤖 Gerando notícia em português com IA...');
        const newsData = await generateNewsWithAI({
            assunto: assunto,
            resumo: resumo,
            conteudos: conteudos
        });

        console.log(`✅ Notícia gerada em português`);

        // Buscar categorias disponíveis para categorização automática
        const categoriasDisponiveis = await prisma.categoria.findMany({
            where: { userId: req.user.id }
        });

        // Preparar categorias no formato esperado pela IA
        const categoriasFormatadas = categoriasDisponiveis.map(cat => ({
            id: cat.id,
            nomePt: cat.nome
        }));

        // Categorizar post usando IA
        let categoriaId = null;
        try {
            console.log('🏷️  Categorizando post com IA...');
            categoriaId = await categorizePostWithAI({
                titulo: newsData.titulo,
                conteudo: newsData.conteudo,
                categoriasDisponiveis: categoriasFormatadas
            });
            if (categoriaId) {
                console.log(`✅ Categoria determinada: ID ${categoriaId}`);
            } else {
                console.log('⚠️  Nenhuma categoria foi determinada');
            }
        } catch (error) {
            console.error('❌ Erro ao categorizar post (continuando sem categoria):', error.message);
        }

        // Gerar tags usando IA
        let tagsNomes = [];
        try {
            console.log('🏷️  Gerando tags com IA...');
            tagsNomes = await generateTagsWithAI({
                titulo: newsData.titulo,
                conteudo: newsData.conteudo,
                quantidade: 5
            });
            console.log(`✅ ${tagsNomes.length} tags geradas`);
        } catch (error) {
            console.error('❌ Erro ao gerar tags (continuando sem tags):', error.message);
        }

        // Criar ou buscar tags no banco de dados
        const tagsIds = [];
        for (const tagNome of tagsNomes) {
            try {
                // Tentar encontrar tag existente
                let tag = await prisma.tag.findUnique({
                    where: {
                        userId_nome: {
                            userId: req.user.id,
                            nome: tagNome
                        }
                    }
                });

                // Se não existe, criar
                if (!tag) {
                    tag = await prisma.tag.create({
                        data: {
                            userId: req.user.id,
                            nome: tagNome
                        }
                    });
                    console.log(`   ✅ Tag criada: ${tagNome}`);
                }

                tagsIds.push(tag.id);
            } catch (error) {
                console.warn(`⚠️  Erro ao processar tag "${tagNome}":`, error.message);
                // Continuar com outras tags mesmo se uma falhar
            }
        }

        // Gerar slug único
        let baseSlug = generateSlug(newsData.titulo);
        let slugFinal = baseSlug;
        let contador = 1;

        // Verificar se slug já existe
        while (await prisma.post.findUnique({ where: { urlAmigavel: slugFinal } })) {
            slugFinal = `${baseSlug}-${contador}`;
            contador++;
        }

        console.log(`   📝 Slug: ${slugFinal}`);

        // Preparar array de imagens (sempre incluir imagem - extraída ou placeholder)
        // Se não encontrou imagem, usar placeholder padrão
        const imagens = imagemUrl ? [imagemUrl] : [getPlaceholderImageUrl()];

        // Preparar dados de categorias e tags para criação
        const categoriasData = categoriaId ? [{ categoriaId: categoriaId }] : [];
        const tagsData = tagsIds.map(tagId => ({ tagId: tagId }));

        // Criar post
        const post = await prisma.post.create({
            data: {
                userId: req.user.id, // Associar ao usuário logado
                titulo: newsData.titulo,
                chamada: newsData.chamada,
                conteudo: newsData.conteudo,
                urlAmigavel: slugFinal,
                status: 'RASCUNHO',
                destaque: false,
                imagens: imagens,
                dataPublicacao: new Date(),
                categorias: {
                    create: categoriasData
                },
                tags: {
                    create: tagsData
                }
            },
            include: {
                categorias: {
                    include: {
                        categoria: true
                    }
                },
                tags: {
                    include: {
                        tag: true
                    }
                }
            }
        });

        // Formatar resposta
        const response = {
            id: post.id,
            titulo: post.titulo,
            chamada: post.chamada,
            conteudo: post.conteudo,
            urlAmigavel: post.urlAmigavel,
            imagens: post.imagens,
            status: post.status,
            destaque: post.destaque,
            dataPublicacao: post.dataPublicacao,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            categorias: post.categorias.map(pc => ({
                id: pc.categoria.id,
                nome: pc.categoria.nome
            })),
            tags: post.tags.map(pt => ({
                id: pt.tag.id,
                nome: pt.tag.nome
            }))
        };

        console.log(`✅ Post criado com sucesso! ID: ${post.id}`);

        res.status(201).json({
            message: 'Post criado em português com sucesso',
            postId: post.id,
            post: response
        });

    } catch (error) {
        console.error('❌ Erro ao gerar post do prompt:', error);
        
        // Mensagens de erro mais amigáveis
        if (error.message.includes('OPENAI_API_KEY')) {
            return res.status(500).json({ 
                error: 'Serviço de IA não configurado. Contate o administrador.' 
            });
        }

        if (error.message.includes('Jina')) {
            return res.status(400).json({ 
                error: 'Não foi possível obter conteúdo da URL',
                message: 'Verifique se a URL é válida e acessível'
            });
        }

        next(error);
    }
});

export default router;

