// Reusable round-robin key rotation utility
export class KeyRotator {
    private currentKeyIndex: number = -1;
    private readonly keys: string[];

    constructor(keys: string[]) {
        if (!keys || keys.length === 0) {
            throw new Error('KeyRotator requires at least one key');
        }
        this.keys = keys;
    }

    // Get the next key in round-robin fashion
    getNextKey(): string {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        return this.keys[this.currentKeyIndex];
    }

    // Get the current key (without incrementing)
    getCurrentKey(): string {
        return this.keys[this.currentKeyIndex];
    }

    // Get the current key index (useful for logging)
    getCurrentIndex(): number {
        return this.currentKeyIndex;
    }

    // Get total number of keys
    getKeyCount(): number {
        return this.keys.length;
    }
}

