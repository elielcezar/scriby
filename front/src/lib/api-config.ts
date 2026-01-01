// Configuração da API
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3010/api',
  timeout: 300000, // 5 minutos (necessário para busca de feed que processa múltiplas fontes com IA)
  headers: {
    'Content-Type': 'application/json',
  },
};

export const TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const USER_KEY = 'user_data';

