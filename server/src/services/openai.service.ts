import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import config from '../config/config';
import { redisService } from './redis.service';
import { ChatMessage, ChatConfig, ERROR_CODES, ErrorResponse } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';

class OpenAIService {
  private openai: OpenAI;
  private readonly config: ChatConfig;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    this.config = {
      model: 'gpt-4-turbo-preview',
      temperature: 0.7,
      max_tokens: 150, // Reduced for shorter responses
      presence_penalty: 0.6,
      frequency_penalty: 0.5,
    };

    this.salesAgentPrompt += '\n\nIMPORTANT: Keep your responses concise and to the point, ideally under 100 words.';
  }

  private readonly salesAgentPrompt = `You are an experienced and friendly AI sales agent. Your role is to:
- Engage customers professionally and courteously
- Understand customer needs through active listening
- Provide relevant product information and recommendations
- Address concerns and objections effectively
- Guide customers through the sales process
- Maintain a helpful and non-pushy approach

Remember to:
- Be natural and conversational
- Show empathy and understanding
- Focus on value and solutions
- Be honest and transparent
- Follow up on customer questions
- Maintain professional boundaries`;

  private async getSystemMessage(): Promise<ChatCompletionMessageParam> {
    return {
      role: 'system',
      content: this.salesAgentPrompt,
    };
  }

  private async buildMessages(
    sessionId: string,
    userMessage: string
  ): Promise<ChatCompletionMessageParam[]> {
    const recentMessages = await redisService.getRecentMessages(sessionId);
    const messages: ChatCompletionMessageParam[] = [
      await this.getSystemMessage(),
      ...recentMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];
    return messages;
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.maxRetries) {
        throw this.handleError(error);
      }
      await new Promise((resolve) => 
        setTimeout(resolve, this.retryDelay * attempt)
      );
      return this.retryOperation(operation, attempt + 1);
    }
  }

  private handleError(error: any): ErrorResponse {
    console.error('OpenAI Service Error:', error);

    if (error instanceof OpenAI.APIError) {
      return {
        error: error.message,
        code: ERROR_CODES.AI_SERVICE_ERROR,
        details: {
          status: error.status,
          type: error.type,
        },
      };
    }

    return {
      error: 'An unexpected error occurred',
      code: ERROR_CODES.SERVER_ERROR,
      details: error,
    };
  }

  async generateResponse(
    sessionId: string,
    userMessage: string
  ): Promise<AsyncGenerator<ChatMessage>> {
    const messages = await this.buildMessages(sessionId, userMessage);

    async function* streamResponse(
      this: OpenAIService
    ): AsyncGenerator<ChatMessage> {
      try {
        const stream = await this.retryOperation(() =>
          this.openai.chat.completions.create({
            ...this.config,
            messages,
            stream: true,
          })
        );

        let accumulatedContent = '';
        
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            accumulatedContent += content;
            
            const message: ChatMessage = {
              id: uuidv4(),
              role: 'assistant',
              content: accumulatedContent,
              timestamp: Date.now(),
            };

            yield message;
          }
        }

        // Save the complete message to Redis
        if (accumulatedContent) {
          const finalMessage: ChatMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: accumulatedContent,
            timestamp: Date.now(),
          };
          await redisService.addMessageToSession(sessionId, finalMessage);
        }
      } catch (error) {
        throw this.handleError(error);
      }
    }

    return streamResponse.call(this);
  }

  async updateContext(sessionId: string, context: string): Promise<void> {
    try {
      await redisService.updateContext(sessionId, context);
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// Export as singleton
export const openAIService = new OpenAIService();
export default openAIService;