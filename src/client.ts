// Standalone client for LLM wrapper service - can be used in other projects

export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface LLMRequest {
    provider: string;
    model: string;
    messages: Message[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    [key: string]: any; // Allow additional provider-specific fields
}

export interface LLMResponse {
    id?: string;
    model: string;
    choices: Array<{
        message: Message;
        finish_reason?: string;
        index: number;
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
    [key: string]: any; // Allow additional provider-specific fields
}

export interface ErrorResponse {
    error: {
        message: string;
        type: string;
        provider_error?: any;
    };
}

export class Client {
    private apiUrl: string;
    private apiKey: string;

    constructor(apiUrl: string, apiKey: string) {
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
    }

    async send(request: LLMRequest): Promise<LLMResponse> {
        // Send provider in X-Provider header
        const response = await fetch(`${this.apiUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'X-Provider': request.provider
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const errorData: ErrorResponse = await response.json();
            throw new Error(`LLM API Error: ${errorData.error.message}`);
        }

        return await response.json();
    }

    async usage(provider: string): Promise<any> {
        // Send provider in X-Provider header
        const response = await fetch(`${this.apiUrl}/v1/usage`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'X-Provider': provider
            }
        });

        if (!response.ok) {
            const errorData: ErrorResponse = await response.json();
            throw new Error(`LLM API Error: ${errorData.error.message}`);
        }

        return await response.json();
    }
}