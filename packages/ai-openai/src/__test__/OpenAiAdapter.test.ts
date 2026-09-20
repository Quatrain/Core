import { OpenAiAdapter, OpenAiChatResponse } from '../OpenAiAdapter'

function createMockResponse(body: unknown, status = 200, statusText = 'OK'): Response {
   return new Response(JSON.stringify(body), {
      status,
      statusText,
      headers: { 'Content-Type': 'application/json' },
   })
}

function createMockStreamResponse(ssePayload: string): Response {
   const stream = new ReadableStream<Uint8Array>({
      start(controller) {
         const encoder = new TextEncoder()
         controller.enqueue(encoder.encode(ssePayload))
         controller.close()
      },
   })
   return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
   })
}

describe('OpenAiAdapter', () => {
   const originalFetch = globalThis.fetch

   afterEach(() => {
      globalThis.fetch = originalFetch
      jest.restoreAllMocks()
   })

   describe('Fail-Fast Validations', () => {
      it('throws an error if apiKey is empty or whitespace', () => {
         expect(() => new OpenAiAdapter('')).toThrow(
            'OpenAiAdapter: apiKey is required and cannot be empty',
         )
         expect(() => new OpenAiAdapter({ apiKey: '   ' })).toThrow(
            'OpenAiAdapter: apiKey is required and cannot be empty',
         )
      })

      it('throws an error if baseUrl is empty string', () => {
         expect(() => new OpenAiAdapter({ apiKey: 'valid-key', baseUrl: '  ' })).toThrow(
            'OpenAiAdapter: baseUrl cannot be an empty string',
         )
      })

      it('throws an error if defaultModel is empty string', () => {
         expect(() => new OpenAiAdapter({ apiKey: 'valid-key', defaultModel: '' })).toThrow(
            'OpenAiAdapter: defaultModel cannot be an empty string',
         )
      })
   })

   describe('Presets and Instantiation', () => {
      it('creates an adapter via constructor with default parameters', () => {
         const adapter = new OpenAiAdapter('test-api-key')
         expect(adapter).toBeInstanceOf(OpenAiAdapter)
      })

      it('creates an adapter for DeepSeek', () => {
         const adapter = OpenAiAdapter.forDeepSeek('sk-deepseek')
         expect(adapter).toBeInstanceOf(OpenAiAdapter)
      })

      it('creates an adapter for Qwen', () => {
         const adapter = OpenAiAdapter.forQwen('sk-qwen')
         expect(adapter).toBeInstanceOf(OpenAiAdapter)
      })

      it('creates an adapter for Ollama', () => {
         const adapter = OpenAiAdapter.forOllama()
         expect(adapter).toBeInstanceOf(OpenAiAdapter)
      })

      it('creates an adapter for OpenRouter', () => {
         const adapter = OpenAiAdapter.forOpenRouter('sk-or')
         expect(adapter).toBeInstanceOf(OpenAiAdapter)
      })
   })

   describe('generateText', () => {
      it('sends authorized request and returns completion text', async () => {
         const mockData: OpenAiChatResponse = {
            id: 'chatcmpl-123',
            object: 'chat.completion',
            created: 123456789,
            model: 'gpt-4o',
            choices: [
               {
                  index: 0,
                  message: {
                     role: 'assistant',
                     content: 'Hello, crop health looks optimal!',
                  },
                  finish_reason: 'stop',
               },
            ],
         }

         const mockFetch = jest.fn().mockResolvedValue(createMockResponse(mockData))
         globalThis.fetch = mockFetch

         const adapter = new OpenAiAdapter('test-api-key')
         const result = await adapter.generateText('Assess vineyard health', {
            systemPrompt: 'You are an agronomy AI assistant.',
         })

         expect(result).toBe('Hello, crop health looks optimal!')
         expect(mockFetch).toHaveBeenCalledTimes(1)

         const calledUrl = mockFetch.mock.calls[0][0] as string
         const calledInit = mockFetch.mock.calls[0][1] as RequestInit
         expect(calledUrl).toBe('https://api.openai.com/v1/chat/completions')
         expect(calledInit.method).toBe('POST')

         const headers = calledInit.headers as Record<string, string>
         expect(headers.Authorization).toBe('Bearer test-api-key')
         expect(headers['Content-Type']).toBe('application/json')

         const sentBody = JSON.parse(calledInit.body as string) as {
            model: string
            messages: Array<{ role: string; content: string }>
         }
         expect(sentBody.model).toBe('gpt-4o')
         expect(sentBody.messages).toHaveLength(2)
         expect(sentBody.messages[0].role).toBe('system')
         expect(sentBody.messages[0].content).toBe('You are an agronomy AI assistant.')
         expect(sentBody.messages[1].role).toBe('user')
         expect(sentBody.messages[1].content).toBe('Assess vineyard health')
      })

      it('throws descriptive error on API failure', async () => {
         const mockError = {
            error: {
               message: 'Incorrect API key provided',
               type: 'invalid_request_error',
            },
         }

         const mockFetch = jest.fn().mockResolvedValue(createMockResponse(mockError, 401, 'Unauthorized'))
         globalThis.fetch = mockFetch

         const adapter = new OpenAiAdapter('invalid-key')

         await expect(adapter.generateText('Hello')).rejects.toThrow(
            'OpenAiAdapter API error (401): Incorrect API key provided',
         )
      })
   })

   describe('generateStructured', () => {
      it('returns parsed structured JSON conforming to schema', async () => {
         const parsedTarget = {
            status: 'warning',
            moistureLevel: 18.5,
            recommendation: 'Trigger irrigation tomorrow',
         }

         const mockData: OpenAiChatResponse = {
            id: 'chatcmpl-struct-123',
            object: 'chat.completion',
            created: 123456789,
            model: 'deepseek-chat',
            choices: [
               {
                  index: 0,
                  message: {
                     role: 'assistant',
                     content: `\`\`\`json\n${JSON.stringify(parsedTarget)}\n\`\`\``,
                  },
               },
            ],
         }

         const mockFetch = jest.fn().mockResolvedValue(createMockResponse(mockData))
         globalThis.fetch = mockFetch

         const adapter = OpenAiAdapter.forDeepSeek('sk-deepseek')
         const schema = {
            type: 'object',
            properties: {
               status: { type: 'string' },
               moistureLevel: { type: 'number' },
               recommendation: { type: 'string' },
            },
         }

         const result = await adapter.generateStructured<{ status: string; moistureLevel: number }>(
            'Analyze probe telemetry',
            schema,
         )

         expect(result).toEqual(parsedTarget)
         expect(result.status).toBe('warning')
         expect(result.moistureLevel).toBe(18.5)
      })

      it('throws an error if model returns empty content', async () => {
         const mockData: OpenAiChatResponse = {
            id: 'chatcmpl-empty',
            object: 'chat.completion',
            created: 123456789,
            model: 'gpt-4o',
            choices: [
               {
                  index: 0,
                  message: {
                     role: 'assistant',
                     content: null,
                  },
               },
            ],
         }

         const mockFetch = jest.fn().mockResolvedValue(createMockResponse(mockData))
         globalThis.fetch = mockFetch

         const adapter = new OpenAiAdapter('test-key')

         await expect(adapter.generateStructured('prompt', {})).rejects.toThrow(
            'OpenAiAdapter: No content returned for structured output request',
         )
      })
   })

   describe('generateTextStream', () => {
      it('streams SSE response chunks asynchronously', async () => {
         const sseData = [
            'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Couvert "}}]}\n\n',
            'data: {"id":"2","object":"chat.completion.chunk","created":2,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"végétal "}}]}\n\n',
            'data: {"id":"3","object":"chat.completion.chunk","created":3,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"recommandé"}}]}\n\n',
            'data: [DONE]\n\n',
         ].join('')

         const mockFetch = jest.fn().mockResolvedValue(createMockStreamResponse(sseData))
         globalThis.fetch = mockFetch

         const adapter = new OpenAiAdapter('test-key')
         const stream = await adapter.generateTextStream('Quel couvert végétal choisir ?')

         const receivedTokens: string[] = []
         for await (const chunk of stream) {
            receivedTokens.push(chunk)
         }

         expect(receivedTokens.join('')).toBe('Couvert végétal recommandé')
      })
   })
})
