import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ChatConfig, ChatMessage, ERROR_CODES, ErrorResponse } from '../types/chat';
import { openAIService } from './openai.service';
import { v4 as uuidv4 } from 'uuid';

class AIService {
  async generateResponse(
    sessionId: string,
    userMessage: string,
    config?: Partial<ChatConfig>
  ): Promise<ChatMessage> {
    try {
      const responseGenerator = await openAIService.generateResponse(sessionId, userMessage);
      let lastMessage: ChatMessage | undefined;

      for await (const message of responseGenerator) {
        lastMessage = message;
      }

      if (!lastMessage) {
        throw new Error('No response generated');
      }

      return lastMessage;
    } catch (error) {
      console.error('AI Service Error:', error);
      if ((error as ErrorResponse).code) {
        throw error;
      }
      throw {
        error: 'Failed to generate response',
        code: ERROR_CODES.AI_SERVICE_ERROR,
        details: error
      };
    }
  }

  async generateStreamingResponse(
    sessionId: string,
    userMessage: string,
    onToken: (token: string) => void,
    config?: Partial<ChatConfig>
  ): Promise<ChatMessage> {
    try {
      const responseGenerator = await openAIService.generateResponse(sessionId, userMessage);
      let lastMessage: ChatMessage | undefined;

      for await (const message of responseGenerator) {
        // Calculate the new content by removing the previous content
        const newContent = lastMessage
          ? message.content.slice(lastMessage.content.length)
          : message.content;
        
        if (newContent) {
          onToken(newContent);
        }
        
        lastMessage = message;
      }

      if (!lastMessage) {
        throw new Error('No response generated');
      }

      return lastMessage;
    } catch (error) {
      console.error('AI Streaming Error:', error);
      if ((error as ErrorResponse).code) {
        throw error;
      }
      throw {
        error: 'Failed to generate streaming response',
        code: ERROR_CODES.AI_SERVICE_ERROR,
        details: error
      };
    }
  }

  async updateContext(sessionId: string, context: string): Promise<void> {
    return openAIService.updateContext(sessionId, context);
  }
}

// Export as singleton
export const aiService = new AIService();
export default aiService;