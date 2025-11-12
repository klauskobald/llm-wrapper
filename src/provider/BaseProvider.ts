import type { Provider } from '../types';
import { KeyRotator } from '../utils/KeyRotator';

// Abstract base class that handles key rotation for providers
export abstract class BaseProvider implements Provider {
    protected keyRotator: KeyRotator;
    protected logLevel: 'info' | 'debug';

    constructor(apiKeys: string[], protected host: string | null = null, logLevel: 'info' | 'debug' = 'info') {
        this.keyRotator = new KeyRotator(apiKeys);
        this.logLevel = logLevel;
        console.log(`[${this.constructor.name}] Provider instance created with ${apiKeys.length} API keys (logLevel: ${logLevel})`);
    }

    // Public method that handles key rotation and retry logic
    async sendRequest(request: any): Promise<any> {
        const totalKeys = this.keyRotator.getKeyCount();
        let lastError: any = null;

        if (this.logLevel === 'debug') {
            console.log(`[${this.constructor.name}] [DEBUG] Forwarding request to provider:`, JSON.stringify(request, null, 2));
        }

        // Try all available keys
        for (let attempt = 0; attempt < totalKeys; attempt++) {
            const apiKey = this.keyRotator.getNextKey();
            console.log(`[${this.constructor.name}] Using API key index: ${this.keyRotator.getCurrentIndex()} (attempt ${attempt + 1}/${totalKeys})`);

            try {
                const response = await this.doSendRequest(apiKey, request);

                if (this.logLevel === 'debug') {
                    console.log(`[${this.constructor.name}] [DEBUG] Received response from provider:`, JSON.stringify(response, null, 2));
                }

                return response;
            } catch (error: any) {
                lastError = error;

                // Check if this is a quota exceeded error
                if (this.isQuotaExceededError(error)) {
                    console.log(`[${this.constructor.name}] Quota exceeded for key index ${this.keyRotator.getCurrentIndex()}, trying next key...`);
                    continue; // Try next key
                } else {
                    // Not a quota error, rethrow immediately
                    throw error;
                }
            }
        }

        // All keys exhausted, throw the last error
        console.error(`[${this.constructor.name}] All ${totalKeys} API keys exhausted due to quota limits`);
        throw lastError;
    }

    // Public method that handles key rotation for usage
    async getUsage(): Promise<any> {
        const apiKey = this.keyRotator.getCurrentKey();
        console.log(`[${this.constructor.name}] Getting usage for API key index: ${this.keyRotator.getCurrentIndex()}`);
        return await this.doGetUsage(apiKey);
    }

    // Abstract methods that derived classes must implement
    protected abstract doSendRequest(apiKey: string, request: any): Promise<any>;
    protected abstract doGetUsage(apiKey: string): Promise<any>;
    protected abstract isQuotaExceededError(error: any): boolean;
}

