import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ProviderManager } from './provider';
import { ProviderTester } from './utils/ProviderTester';

interface LLMRequest {
    provider: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    [key: string]: any;
}

// Extend Express Request to include extracted provider
interface AuthenticatedRequest extends Request {
    extractedProvider?: string;
}

// Initialize provider manager
const providerManager = new ProviderManager();

// Initialize provider tester
const providerTester = new ProviderTester(providerManager);

const app = express();
app.use(express.json());

// API Key authentication middleware
const authenticateApiKey = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            error: {
                message: 'Missing or invalid authorization header',
                type: 'authentication_error'
            }
        });
        return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const config = providerManager.getConfig();

    // Prefer X-Provider header, fall back to encoded format (provider//apiKey)
    const providerHeader = req.headers['x-provider'] as string | undefined;

    let provider: string;
    let apiKey: string;

    if (providerHeader) {
        // Use provider from header
        provider = providerHeader;
        apiKey = token;
    } else {
        // Fall back to encoded format (provider//apiKey)
        const parts = token.split('//');
        if (parts.length !== 2) {
            res.status(401).json({
                error: {
                    message: 'Missing X-Provider header or invalid token format. Expected: X-Provider header OR token format provider//apiKey',
                    type: 'authentication_error'
                }
            });
            return;
        }
        [provider, apiKey] = parts;
    }

    if (apiKey !== config.server.api.key) {
        res.status(401).json({
            error: {
                message: 'Invalid API key',
                type: 'authentication_error'
            }
        });
        return;
    }

    // Store extracted provider in request for use in endpoint
    req.extractedProvider = provider;

    next();
};

// Main endpoint
app.post('/v1/chat/completions', authenticateApiKey, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const request: LLMRequest = req.body;

        // Use provider from authentication header (extracted in middleware)
        const providerName = req.extractedProvider!;

        // Validate required fields
        if (!request.messages) {
            res.status(400).json({
                error: {
                    message: 'Missing required field: messages',
                    type: 'invalid_request_error'
                }
            });
            return;
        }

        // Get the provider (loads on demand)
        const provider = await providerManager.getProvider(providerName);
        const config = providerManager.getConfig();

        // Use defaultModel from config if model is not provided
        if (!request.model) {
            const defaultModel = config.provider[providerName]?.defaultModel;
            if (defaultModel) {
                request.model = defaultModel;
                console.log(`[Server] Using default model for ${providerName}: ${defaultModel}`);
            } else {
                res.status(400).json({
                    error: {
                        message: 'Missing required field: model (and no defaultModel configured)',
                        type: 'invalid_request_error'
                    }
                });
                return;
            }
        }

        // Remove our custom fields before sending to provider
        const { provider: _provider, ...providerRequest } = request;

        // Send request to provider
        const response = await provider.sendRequest(providerRequest);

        res.json(response);
    } catch (error: any) {
        console.error('Error processing request:', error);

        res.status(500).json({
            error: {
                message: error.message || 'Internal server error',
                type: 'server_error',
                provider_error: error.provider_error || error
            }
        });
    }
});

// Usage endpoint
app.get('/v1/usage', authenticateApiKey, async (req: AuthenticatedRequest, res: Response) => {
    try {
        // Use provider from authentication header (extracted in middleware)
        const providerName = req.extractedProvider!;

        // Get the provider (loads on demand)
        const provider = await providerManager.getProvider(providerName);

        // Get usage information from provider
        const usage = await provider.getUsage();

        res.json(usage);
    } catch (error: any) {
        console.error('Error getting usage:', error);

        res.status(500).json({
            error: {
                message: error.message || 'Internal server error',
                type: 'server_error',
                provider_error: error.provider_error || error
            }
        });
    }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

// Test endpoint for all providers
app.get('/test-all/:prompt/:expectedResponse', async (req: Request, res: Response) => {
    try {
        const { prompt, expectedResponse } = req.params;

        console.log(`[TestAll] Starting test with prompt: "${prompt}", expected: "${expectedResponse}"`);

        const result = await providerTester.testAllProviders(prompt, expectedResponse);

        res.json(result);
    } catch (error: any) {
        console.error('Error testing providers:', error);

        res.status(500).json({
            error: {
                message: error.message || 'Internal server error',
                type: 'server_error'
            }
        });
    }
});

// Catch-all GET route - must be last
app.get('*', (req: Request, res: Response) => {
    res.send('+ ok');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`LLM Wrapper Service running on port ${PORT}`);
    console.log(`Registered providers: ${providerManager.getAvailableProviders().join(', ')}`);
});

