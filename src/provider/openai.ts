import { OpenAI } from 'openai';
import { BaseProvider } from './BaseProvider';

export default class OpenAIProvider extends BaseProvider {
    constructor(apiKeys: string[], protected host: string, logLevel: 'info' | 'debug' = 'info') {
        super(apiKeys, logLevel);
    }

    protected async doSendRequest(apiKey: string, request: any): Promise<any> {
        try {
            // Create a new Ollama instance for each request with the current API key
            const ollama = new OpenAI({
                baseURL: this.host || 'https://api.openai.com',
                apiKey: apiKey,
            });

            const response = await ollama.chat.completions.create({
                model: request.model,
                messages: request.messages,
                stream: false,
                temperature: request.temperature,
                max_tokens: request.max_tokens as number,
                tools: request.tools,
                tool_choice: request.tool_choice || 'auto',
            });
            return response;
        } catch (error: any) {
            const wrappedError: any = new Error(`Failed to connect to OpenAI: ${error.message}`);
            wrappedError.provider_error = error;
            throw wrappedError;
        }
    }

    protected async doGetUsage(apiKey: string): Promise<any> {
        return null;
    }

    protected isQuotaExceededError(error: any): boolean {
        return error.code === 'quota_exceeded';
    }
}
