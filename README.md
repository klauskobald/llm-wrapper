# LLM Wrapper Service

A TypeScript-based LLM wrapper service for Kubernetes deployment with round-robin API key rotation.

## Features

- 🔐 Simple API key authentication
- 🔄 Round-robin API key rotation for providers
- 🎯 Provider abstraction layer
- 📦 OpenAI-compatible API format
- 🚀 Ready for K8s deployment

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy and configure:
```bash
cp config.example.yml config.yml
# Edit config.yml with your API keys
```

### Running the Server

```bash
npm run dev
# or
npm start
```

Server will run on port 3000 (or PORT environment variable).

### Running the Example Client

```bash
npm run example
```

**Note:** Make sure the server is running before executing the example client.

## Configuration

Edit `config.yml` to configure:

- Server API key
- Provider configurations
- Provider API keys (round-robin)

```yaml
server:
  api:
    key: your-server-api-key

provider:
  ollama:
    class: ollamacloud
    api:
      keys:
        - key1
        - key2
        - key3
```

## API Usage

### Endpoint

`POST /v1/chat/completions`

### Headers

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### Request Body

```json
{
  "provider": "ollama",
  "model": "qwen3-coder:480b-cloud",
  "messages": [
    { "role": "user", "content": "Hello, how are you?" }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

### Response

OpenAI-compatible format:

```json
{
  "id": "...",
  "model": "qwen3-coder:480b-cloud",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I'm doing well, thank you!"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

## Using the Client in Other Projects

The `src/client.ts` file is standalone and can be copied to other projects:

```typescript
import { Client } from './client.ts';

const client = new Client('http://localhost:3000', 'your-api-key');

const response = await client.send({
  provider: 'ollama',
  model: 'qwen3-coder:480b-cloud',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response);
```

## Architecture

- **server.ts**: Express server with API key auth and request routing
- **client.ts**: Standalone client library with all types
- **provider/ollamacloud.ts**: OllamaCloud provider with round-robin key rotation

## Docker Build

```bash
docker build -t llm-wrapper:latest .
docker run -p 3000:3000 -v $(pwd)/config.yml:/app/config.yml llm-wrapper:latest
```

## K8s Deployment

The service is designed to run in Kubernetes. See `k8s-deployment.example.yml` for a complete example.

### Steps:

1. Edit `k8s-deployment.example.yml` with your API keys
2. Apply the configuration:

```bash
kubectl apply -f k8s-deployment.example.yml
```

### Environment Variables:

- `PORT`: Server port (default: 3000)

### Configuration:

Mount `config.yml` as a ConfigMap (as shown in the example) or use Kubernetes Secrets for sensitive data.

