import { Ollama } from 'ollama';
import { BaseProvider } from './BaseProvider';

export default class OllamaCloudProvider extends BaseProvider {
    constructor(apiKeys: string[], protected host: string, logLevel: 'info' | 'debug' = 'info') {
        super(apiKeys, logLevel);
    }

    protected async doSendRequest(apiKey: string, request: any): Promise<any> {
        try {
            // Create a new Ollama instance for each request with the current API key
            const ollama = new Ollama({
                host: this.host || 'https://ollama.com',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            // Check if tools are requested
            const hasTools = request.tools && request.tools.length > 0;

            // Preprocess messages to handle tool_calls (Ollama doesn't support them natively)
            let messages = this.preprocessMessages(request.messages);

            // If tools are present, inject system instruction for tool calling
            if (hasTools) {
                const toolInstruction = this.buildToolInstruction(request.tools);
                messages = this.injectToolInstruction(messages, toolInstruction);
            }

            // Use the ollama package to make the request
            const response = await ollama.chat({
                model: request.model,
                messages: messages,
                stream: false,
                options: {
                    temperature: request.temperature,
                    num_predict: request.max_tokens
                }
            });

            // If tools were requested, check if the response is a tool call
            if (hasTools) {
                const toolCallResponse = this.parseToolCallResponse(response.message.content);
                if (toolCallResponse) {
                    return toolCallResponse;
                }
            }

            // Convert Ollama response format to OpenAI-compatible format
            return {
                id: `chatcmpl-${Date.now()}`,
                model: request.model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: response.message.content
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 0, // Ollama doesn't provide token counts
                    completion_tokens: 0,
                    total_tokens: 0
                }
            };
        } catch (error: any) {
            const wrappedError: any = new Error(`Failed to connect to OllamaCloud: ${error.message}`);
            wrappedError.provider_error = error;
            throw wrappedError;
        }
    }

    // Preprocess messages to handle tool_calls (Ollama doesn't natively support them)
    private preprocessMessages(messages: any[]): any[] {
        return messages.map(msg => {
            // If message has tool_calls, convert to text format since Ollama doesn't support them
            if (msg.tool_calls) {
                const toolCallsText = msg.tool_calls.map((tc: any) => {
                    const args = typeof tc.function.arguments === 'string'
                        ? tc.function.arguments
                        : JSON.stringify(tc.function.arguments);
                    return `{"tool":"${tc.function.name}","arguments":${args}}`;
                }).join('\n');

                return {
                    role: msg.role,
                    content: toolCallsText
                };
            }

            // If this is a tool result message, convert to user message with the result
            // (Ollama doesn't support role: "tool", so we present it as a user message)
            if (msg.role === 'tool') {
                return {
                    role: 'user',
                    content: `Tool result from ${msg.name || 'tool'}:\n${msg.content}`
                };
            }

            return msg;
        });
    }

    // Build tool instruction for the model
    private buildToolInstruction(tools: any[]): string {
        const toolDescriptions = tools.map(tool => {
            const params = tool.function.parameters?.properties || {};
            const required = tool.function.parameters?.required || [];

            return `- ${tool.function.name}: ${tool.function.description}\n  Parameters: ${JSON.stringify({ properties: params, required })}`;
        }).join('\n');

        return `You have access to the following tools:

${toolDescriptions}

IMPORTANT: When you need to use a tool, respond with ONLY a JSON object in this exact format:
{"tool":"<tool_name>","arguments":{<argument_name>:<value>,...}}
Do not include any other text or explanation outside of the JSON object about what you were thinking or similar.

CRITICAL JSON FORMATTING RULES:
- All argument values must be valid JSON types (string, number, boolean, object, array, null)
- For string values, use double quotes: "value"
- For object values, use proper JSON syntax: {"key": "value"}
- For array values, use proper JSON syntax: ["item1", "item2"]
- Do NOT nest JSON strings inside other JSON strings
- Do NOT escape quotes inside object values
- All JSON must be valid and parseable by JSON.parse()

EXAMPLES:
✅ CORRECT: {"tool":"my_tool","arguments":{"param1":"string_value","param2":{"nested":"object"},"param3":["array","values"]}}
❌ WRONG: {"tool":"my_tool","arguments":{"param1":"{\"nested\":\"string\"}"}}

When you have the final answer and don't need any tools, respond with ONLY a JSON object in this exact format:
{"final":"<your response>"}

Do not include any other text or explanation outside of the JSON object.`;
    }

    // Inject tool instruction into messages
    private injectToolInstruction(messages: any[], instruction: string): any[] {
        // Check if there's already a system message
        const hasSystemMessage = messages.some(msg => msg.role === 'system');

        if (hasSystemMessage) {
            // Append to existing system message
            return messages.map(msg => {
                if (msg.role === 'system') {
                    return {
                        ...msg,
                        content: msg.content + '\n\n' + instruction
                    };
                }
                return msg;
            });
        } else {
            // Add new system message at the beginning
            return [
                { role: 'system', content: instruction },
                ...messages
            ];
        }
    }

    // Parse model response to detect tool calls
    private parseToolCallResponse(content: string): any | null {
        let tryLog: string[] = [];

        try {
            // Try to extract JSON from the response
            const trimmed = content.trim();

            // Try to parse the entire response as JSON first
            let parsed: any;
            try {
                parsed = JSON.parse(trimmed);
            } catch {
                // If that fails, try to extract JSON from markdown code blocks
                const jsonMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                tryLog.push("jsonMatch");
                if (jsonMatch) {
                    tryLog.push("> found");
                    parsed = JSON.parse(jsonMatch[1]);
                } else {
                    // Try to find any JSON object in the text
                    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
                    tryLog.push("objectMatch");
                    if (objectMatch) {
                        tryLog.push("> found");
                        parsed = JSON.parse(objectMatch[0]);
                    } else {
                        throw new Error("Cannot extract JSON from response");
                    }
                }
            }

            // Check if it's a tool call
            if (parsed.tool && parsed.arguments) {
                // Return OpenAI-compliant tool_calls response
                return {
                    id: `chatcmpl-${Date.now()}`,
                    model: 'ollama-cloud',
                    choices: [{
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: null,
                            tool_calls: [{
                                id: `call_${Date.now()}`,
                                type: 'function',
                                function: {
                                    name: parsed.tool,
                                    arguments: JSON.stringify(parsed.arguments)
                                }
                            }]
                        },
                        finish_reason: 'tool_calls'
                    }],
                    usage: {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0
                    }
                };
            }

            // Check if it's a final response
            if (parsed.final) {
                return {
                    id: `chatcmpl-${Date.now()}`,
                    model: 'ollama-cloud',
                    choices: [{
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: parsed.final
                        },
                        finish_reason: 'stop'
                    }],
                    usage: {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0
                    }
                };
            }
            tryLog.push("no 'tool' or final found");
            throw new Error("Cannot handle response");
        } catch (error) {
            console.error(error);
            console.error("Try log: ", tryLog.join(" -> "));
            console.error("This was the result: ", content);
            return null;
        }
    }

    protected async doGetUsage(apiKey: string): Promise<any> {
        // Usage endpoint not available for OllamaCloud yet
        return null;
    }

    protected isQuotaExceededError(error: any): boolean {
        // Check for common quota exceeded error patterns
        const errorMessage = error?.message?.toLowerCase() || '';
        const providerError = error?.provider_error;

        // Check error message for quota/rate limit keywords
        if (errorMessage.includes('quota') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('too many requests')) {
            return true;
        }

        // Check HTTP status codes (429 = Too Many Requests, sometimes 403 for quota)
        if (providerError?.status === 429) {
            return true;
        }

        // Check for temporary upstream errors that should be retried
        if (providerError?.status === 502 || // Bad Gateway
            providerError?.status === 503 || // Service Unavailable
            providerError?.status === 504) { // Gateway Timeout
            return true;
        }

        // Check for upstream error messages that indicate temporary issues
        if (errorMessage.includes('upstream error') ||
            errorMessage.includes('bad gateway') ||
            errorMessage.includes('service unavailable') ||
            errorMessage.includes('gateway timeout')) {
            return true;
        }

        // Check for Ollama-specific quota errors
        if (providerError?.error?.includes('quota') ||
            providerError?.error?.includes('rate limit')) {
            return true;
        }

        return false;
    }
}

