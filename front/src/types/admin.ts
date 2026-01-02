// Tag
export interface Tag {
  id: number;
  nome: string;
  createdAt: string;
  updatedAt: string;
}



// Fonte (Feed de notícias para IA)
export interface Fonte {
  id: number;
  titulo: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface FonteFormData {
  titulo: string;
  url: string;
}

// FeedItem (Notícia extraída de uma fonte)
export interface FeedItem {
  id: number;
  fonteId: number;
  titulo: string;
  url: string;
  chamada: string | null;
  imagemUrl: string | null;
  dataPublicacao: string | null;
  lida: boolean;
  createdAt: string;
  updatedAt: string;
  fonte?: {
    id: number;
    titulo: string;
    url: string;
  };
}

// Resposta paginada de FeedItems
export interface FeedItemsResponse {
  items: FeedItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Fonte com contagem de items para filtro
export interface FonteComContagem {
  id: number;
  titulo: string;
  totalItems: number;
}

// Categoria
export interface Categoria {
  id: number;
  nome: string;
  createdAt: string;
  updatedAt: string;
}

// Alias para compatibilidade (removido após migração completa)
export type Site = Categoria;

// Post
export interface Post {
  id: number;
  userId: string;
  titulo: string;
  chamada: string;
  conteudo: string;
  urlAmigavel: string;
  imagens: string[];      // URLs do S3
  status: 'RASCUNHO' | 'PUBLICADO';
  destaque: boolean;
  dataPublicacao: string | null;
  createdAt: string;
  updatedAt: string;
  categorias?: Categoria[];
  tags?: Tag[];
}

// Para criar/editar post
export interface PostFormData {
  titulo: string;
  chamada: string;
  conteudo: string;
  urlAmigavel: string;
  status?: 'RASCUNHO' | 'PUBLICADO';
  destaque?: boolean;
  dataPublicacao?: string;
  categorias?: number[];  // Array de IDs de categorias
  tags?: number[];        // Array de IDs de tags
  imagens?: File[];       // Arquivos para upload
  oldImages?: string[];   // URLs existentes
}

// Usuário
export interface User {
  id: string; // UUID
  name: string;
  email: string;
  role: 'ADMIN' | 'EDITOR';
  createdAt: string;
  updatedAt: string;
}

// Para criar/editar usuário
export interface UserFormData {
  name: string;
  email: string;
  password?: string;
}

// Resposta de Login
export interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Dados de autenticação (para o contexto)
export interface AdminUser extends User {
  role: 'ADMIN' | 'EDITOR'; // Agora vem do backend
}

// Respostas da API
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

// MANTIDOS PARA COMPATIBILIDADE TEMPORÁRIA (serão removidos após migração completa)
// Aliases para facilitar transição gradual
export type Property = Post;
export type PropertyFormData = PostFormData;
