export interface Provider {
    sendRequest(request: any): Promise<any>;
    getUsage(): Promise<any>;
}

export interface Config {
    server: {
        api: {
            key: string;
        };
        logLevel?: 'info' | 'debug';
    };
    provider: {
        [key: string]: {
            class: string;
            defaultModel?: string;
            api: {
                keys: string[];
            };
        };
    };
}
