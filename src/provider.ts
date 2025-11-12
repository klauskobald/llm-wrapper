import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import type { Provider, Config } from './types';

export class ProviderManager {
    private providers = new Map<string, Provider>();
    private config: Config;

    constructor(configPath: string = './config.yml') {
        const configFile = readFileSync(configPath, 'utf8');
        this.config = load(configFile) as Config;
        console.log(`[ProviderManager] Loaded config with providers: ${Object.keys(this.config.provider).join(', ')}`);
    }

    private async loadProvider(providerName: string): Promise<Provider> {
        // Check if already loaded
        if (this.providers.has(providerName)) {
            return this.providers.get(providerName)!;
        }

        const providerConfig = this.config.provider[providerName];
        if (!providerConfig) {
            throw new Error(`Provider ${providerName} not found in config`);
        }

        try {
            // Dynamic import based on class name
            const modulePath = `./provider/${providerConfig.class}`;
            const module = await import(modulePath);

            // Get the class constructor (assuming it's the default export)
            const ProviderClass = module.default || module[providerConfig.class];

            if (!ProviderClass) {
                throw new Error(`Provider class ${providerConfig.class} not found in module ${modulePath}`);
            }

            // Get log level from server config
            const logLevel = this.config.server.logLevel || 'info';

            // Instantiate the provider with its configuration and log level
            const provider = new ProviderClass(providerConfig.api.keys, providerConfig.host || null, logLevel);
            this.providers.set(providerName, provider);

            console.log(`[ProviderManager] Loaded provider: ${providerName} (${providerConfig.class})`);
            return provider;
        } catch (error) {
            console.error(`[ProviderManager] Failed to load provider ${providerName}:`, error);
            throw new Error(`Failed to load provider ${providerName}: ${error}`);
        }
    }

    async getProvider(providerName: string): Promise<Provider> {
        return await this.loadProvider(providerName);
    }

    getAvailableProviders(): string[] {
        return Object.keys(this.config.provider);
    }

    getConfig(): Config {
        return this.config;
    }
}
