import type { ProviderManager } from '../provider';

interface TestResult {
    message: string;
    failed?: Array<{
        provider: string;
        response: any;
    }>;
}

export class ProviderTester {
    private providerManager: ProviderManager;
    private maxPromptLength: number = 100;

    constructor(providerManager: ProviderManager) {
        this.providerManager = providerManager;
    }

    async testAllProviders(prompt: string, expectedResponse: string): Promise<TestResult> {
        // Validate prompt length
        if (prompt.length > this.maxPromptLength) {
            throw new Error(`Prompt exceeds maximum length of ${this.maxPromptLength} characters`);
        }

        const availableProviders = this.providerManager.getAvailableProviders();
        const failed: Array<{ provider: string; response: any }> = [];

        console.log(`[ProviderTester] Testing ${availableProviders.length} providers with prompt: "${prompt}"`);

        // Test each provider
        for (const providerName of availableProviders) {
            try {
                console.log(`[ProviderTester] Testing provider: ${providerName}`);

                const provider = await this.providerManager.getProvider(providerName);
                const config = this.providerManager.getConfig();

                // Get default model from config for this provider
                const defaultModel = config.provider[providerName]?.defaultModel;

                if (!defaultModel) {
                    throw new Error(`No defaultModel configured for provider: ${providerName}`);
                }

                // Send test request
                const response = await provider.sendRequest({
                    model: defaultModel,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 150
                });

                // Check if expected response is in the actual response
                const actualContent = response.choices?.[0]?.message?.content || '';
                const containsExpected = actualContent.toLowerCase().includes(expectedResponse.toLowerCase());

                if (!containsExpected) {
                    console.log(`[ProviderTester] Provider ${providerName} FAILED - Expected "${expectedResponse}" not found in response`);
                    failed.push({
                        provider: providerName,
                        response: response
                    });
                } else {
                    console.log(`[ProviderTester] Provider ${providerName} PASSED`);
                }
            } catch (error: any) {
                console.error(`[ProviderTester] Provider ${providerName} ERROR:`, error);
                failed.push({
                    provider: providerName,
                    response: {
                        error: error.message,
                        details: error
                    }
                });
            }
        }

        // Build result
        const totalProviders = availableProviders.length;

        if (failed.length === 0) {
            return {
                message: `tested ${totalProviders} providers. all ok.`
            };
        } else {
            return {
                message: `tested ${totalProviders} providers.`,
                failed: failed
            };
        }
    }
}

