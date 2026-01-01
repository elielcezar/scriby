# 📡 API Endpoints - Documentação Completa

## Base URL
```
http://localhost:3010/api
```

---

## 📰 Posts

### 1. Listar Posts (Filtros Disponíveis)

**Endpoint:** `GET /posts`

**Query Parameters:**
- `status` (opcional): Filtrar por status (`RASCUNHO`, `PUBLICADO`)
- `destaque` (opcional): Filtrar por destaque (`true`, `false`)
- `categoria` (opcional): Filtrar por ID da categoria (número) ou nome da categoria (string)
- `tag` (opcional): Filtrar por ID da tag (número) ou nome da tag (string)

**Exemplos de Uso:**

#### 1.1. Todos os Posts Publicados
```
GET http://localhost:3010/api/posts
```

#### 1.2. Posts em Destaque
```
GET http://localhost:3010/api/posts?destaque=true
```

#### 1.3. Posts Publicados
```
GET http://localhost:3010/api/posts?status=PUBLICADO
```

#### 1.4. Posts de uma Categoria Específica
```
GET http://localhost:3010/api/posts?categoria=1
```
*Nota: Aceita ID da categoria (número) ou nome da categoria (string)*

#### 1.5. Posts com uma Tag Específica
```
GET http://localhost:3010/api/posts?tag=música
```
*Nota: Aceita ID da tag (número) ou nome da tag (string)*

**Exemplo com ID de tag:**
```
GET http://localhost:3010/api/posts?tag=1
```

#### 1.6. Combinação de Filtros
```
GET http://localhost:3010/api/posts?destaque=true&status=PUBLICADO&categoria=1
```

**Resposta de Sucesso (200):**
```json
[
  {
    "id": 1,
    "titulo": "Título do Post",
    "chamada": "Chamada/resumo do post",
    "conteudo": "<p>Conteúdo HTML completo...</p>",
    "urlAmigavel": "titulo-do-post",
    "imagens": ["https://s3.../imagem.jpg"],
    "status": "PUBLICADO",
    "destaque": true,
    "dataPublicacao": "2024-01-15T10:00:00.000Z",
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "categorias": [
      {
        "id": 1,
        "nome": "Música"
      }
    ],
    "tags": [
      {
        "id": 1,
        "nome": "música"
      }
    ],
    "url": "http://localhost:3010/posts/titulo-do-post",
    "translationsAvailable": ["pt", "en", "es"]
  }
]
```

---

### 2. Obter Post por ID

**Endpoint:** `GET /posts/id/:id`

**Exemplo:**
```
GET http://localhost:3010/api/posts/id/1
```

**Resposta de Sucesso (200):**
```json
{
  "id": 1,
  "titulo": "Título do Post",
  "chamada": "Chamada/resumo",
  "conteudo": "<p>Conteúdo HTML...</p>",
  "urlAmigavel": "titulo-do-post",
  "imagens": ["https://s3.../imagem.jpg"],
  "status": "PUBLICADO",
  "destaque": true,
  "dataPublicacao": "2024-01-15T10:00:00.000Z",
  "categorias": [
    {
      "id": 1,
      "nome": "Música"
    }
  ],
  "tags": [
    {
      "id": 1,
      "nome": "música"
    }
  ]
}
```

---

### 3. Obter Post por URL Amigável

**Endpoint:** `GET /posts/:slug`

**Exemplo:**
```
GET http://localhost:3010/api/posts/titulo-do-post
```

**Resposta:** Similar ao endpoint por ID

---

## 🏷️ Categorias

### Listar Categorias

**Endpoint:** `GET /categorias`

**Exemplo:**
```
GET http://localhost:3010/api/categorias
```

**Resposta:**
```json
[
  {
    "id": 1,
    "nome": "Música",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
]
```

---

## 🏷️ Tags

### Listar Tags

**Endpoint:** `GET /tags`

**Query Parameters:**
- `nome` (opcional): Filtrar por nome (busca parcial)

**Exemplos:**

#### Todas as tags
```
GET http://localhost:3010/api/tags
```

#### Buscar tags por nome
```
GET http://localhost:3010/api/tags?nome=música
```

**Resposta:**
```json
[
  {
    "id": 1,
    "nome": "música",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  },
  {
    "id": 2,
    "nome": "festival",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
]
```

---

## 📋 Resumo dos Endpoints para Testes

### Posts
1. ✅ `GET /posts` - Todos os posts publicados
2. ✅ `GET /posts?destaque=true` - Posts em destaque
3. ✅ `GET /posts?status=PUBLICADO` - Apenas posts publicados
4. ✅ `GET /posts?categoria=1` - Posts de uma categoria específica
5. ✅ `GET /posts?tag=música` - Posts com uma tag específica

### Combinações
6. ✅ `GET /posts?destaque=true&status=PUBLICADO` - Destaques publicados
7. ✅ `GET /posts?categoria=1&destaque=true` - Destaques de uma categoria
8. ✅ `GET /posts?categoria=1&tag=música` - Posts de uma categoria com uma tag específica

---

## ✅ Correções Aplicadas

### 1. Filtro de Categoria
- ✅ Agora aceita `categoria` (ID numérico ou nome)
- ✅ Mantém compatibilidade com `site` (legado)
- ✅ Filtra corretamente por ID ou nome traduzido

### 2. Estrutura de Tags Simplificada
- ✅ Tags agora retornam apenas `{ id, nome }`
- ✅ Removida estrutura aninhada desnecessária

### 3. Filtro por Tag Melhorado
- ✅ Aceita ID da tag (número) ou nome da tag (string)
- ✅ Mais flexível para uso no frontend

