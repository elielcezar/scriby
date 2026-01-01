# 📋 Parâmetros da API - Referência Rápida

## Query Parameters - Endpoint GET /posts

### Parâmetros Disponíveis

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `featured` | boolean | Filtrar por destaque (`true`/`false`) | `?featured=true` |
| `category` | number/string | Filtrar por categoria (ID ou nome) | `?category=1` |
| `tag` | number/string | Filtrar por tag (ID ou nome) | `?tag=música` |
| `status` | string | Filtrar por status (`RASCUNHO`, `PUBLICADO`) | `?status=PUBLICADO` |

### Compatibilidade (Legado)

Os seguintes parâmetros ainda funcionam para compatibilidade, mas **não são recomendados**:

- `destaque` → Use `featured` em vez disso
- `categoria` → Use `category` em vez disso
- `site` → Use `category` em vez disso

---

## Exemplos de Uso

### Padrão (Recomendado)
```
GET /posts?featured=true&category=1
```

### Compatibilidade (Funciona, mas não recomendado)
```
GET /posts?destaque=true&categoria=1
```

---

## Resposta JSON

Os campos na resposta JSON mantêm os nomes em português (conforme banco de dados):

```json
{
  "destaque": true,
  "categorias": [...],
  "tags": [...]
}
```

**Nota:** Apenas os **parâmetros de query** foram traduzidos para inglês. Os campos do JSON permanecem em português.

