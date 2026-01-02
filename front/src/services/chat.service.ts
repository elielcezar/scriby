import apiClient, { handleApiError } from '@/lib/api-client';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const chatService = {
  /**
   * Envia histórico de mensagens para a IA e recebe resposta
   */
  async sendMessage(messages: ChatMessage[], url?: string): Promise<string> {
    try {
      const response = await apiClient.post<{ response: string }>('/chat', {
        messages,
        url
      });
      return response.data.response;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};
