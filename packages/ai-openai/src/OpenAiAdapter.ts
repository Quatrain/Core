import { AbstractAiAdapter } from '@quatrain/ai'

/**
 * Chat message role for OpenAI-compatible completions.
 */
export type OpenAiMessageRole = 'system' | 'user' | 'assistant'

/**
 * Message payload format for chat completions.
 */
export interface OpenAiMessage {
   role: OpenAiMessageRole
   content: string
}

/**
 * Choice element returned in chat completion response.
 */
export interface OpenAiChatChoice {
   index: number
   message: {
      role: string
      content: string | null
   }
   finish_reason?: string
}

/**
 * API response structure from an OpenAI-compatible /chat/completions endpoint.
 */
export interface OpenAiChatResponse {
   id: string
   object: string
   created: number
   model: string
   choices: OpenAiChatChoice[]
   usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
   }
}

/**
 * Delta segment in streaming chunk.
 */
export interface OpenAiStreamDelta {
   role?: string
   content?: string
}

/**
 * Choice element in streaming chunk.
 */
export interface OpenAiStreamChoice {
   index: number
   delta: OpenAiStreamDelta
   finish_reason?: string | null
}

/**
 * Streaming chunk structure from an SSE /chat/completions endpoint.
 */
export interface OpenAiChatChunk {
   id: string
   object: string
   created: number
   model: string
   choices: OpenAiStreamChoice[]
}

/**
 * Configuration options for initializing OpenAiAdapter.
 */
export interface OpenAiAdapterConfig {
   /**
    * API secret key for authorization. Must not be empty.
    */
   apiKey: string

   /**
    * Base URL for the OpenAI-compatible API endpoint.
    * Defaults to 'https://api.openai.com/v1'.
    */
   baseUrl?: string

   /**
    * Default model name to use if not specified in individual calls.
    * Defaults to 'gpt-4o'.
    */
   defaultModel?: string

   /**
    * Default temperature (0.0 to 2.0).
    * Defaults to 0.7.
    */
   defaultTemperature?: number

   /**
    * Request timeout in milliseconds.
    * Defaults to 60000 (60s).
    */
   timeoutMs?: number

   /**
    * Additional headers sent with every request (e.g. org ID or custom routing).
    */
   customHeaders?: Record<string, string>
}

/**
 * Execution options passed to generate calls.
 */
export interface OpenAiGenerateOptions {
   /**
    * Model identifier overriding the default model.
    */
   model?: string

   /**
    * Sampling temperature (0.0 to 2.0).
    */
   temperature?: number

   /**
    * Maximum tokens to generate in the completion.
    */
   maxTokens?: number

   /**
    * Optional system prompt prepended before user message.
    */
   systemPrompt?: string

   /**
    * Explicit message array overriding prompt building.
    */
   messages?: OpenAiMessage[]

   /**
    * Additional HTTP headers for this specific call.
    */
   headers?: Record<string, string>

   /**
    * Response format configuration (e.g. { type: 'json_object' }).
    */
   responseFormat?: { type: 'text' | 'json_object' } | Record<string, unknown>
}

/**
 * AI Adapter implementation for OpenAI and OpenAI-compatible models (DeepSeek, Qwen, Mistral, Ollama).
 * Built with native fetch and Web Streams without external third-party SDK dependencies.
 */
export class OpenAiAdapter extends AbstractAiAdapter {
   protected _apiKey: string
   protected _baseUrl: string
   protected _defaultModel: string
   protected _defaultTemperature: number
   protected _timeoutMs: number
   protected _customHeaders: Record<string, string>
   protected _initialized = false

   /**
    * Construct a new OpenAiAdapter instance.
    *
    * @param config - String API key or complete OpenAiAdapterConfig object.
    * @throws {Error} If apiKey is empty or config is invalid (Fail-Fast).
    */
   constructor(config: string | OpenAiAdapterConfig) {
      super()

      const options: OpenAiAdapterConfig =
         typeof config === 'string' ? { apiKey: config } : config

      if (options.apiKey.trim() === '') {
         throw new Error('OpenAiAdapter: apiKey is required and cannot be empty')
      }

      if (options.baseUrl?.trim() === '') {
         throw new Error('OpenAiAdapter: baseUrl cannot be an empty string')
      }

      if (options.defaultModel?.trim() === '') {
         throw new Error('OpenAiAdapter: defaultModel cannot be an empty string')
      }

      let rawBaseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').trim()
      while (rawBaseUrl.endsWith('/')) {
         rawBaseUrl = rawBaseUrl.slice(0, -1)
      }

      this._apiKey = options.apiKey.trim()
      this._baseUrl = rawBaseUrl
      this._defaultModel = (options.defaultModel ?? 'gpt-4o').trim()
      this._defaultTemperature = options.defaultTemperature ?? 0.7
      this._timeoutMs = options.timeoutMs ?? 60000
      this._customHeaders = options.customHeaders ?? {}
   }

   /**
    * Preset for OpenAI official endpoint.
    *
    * @param apiKey - OpenAI API key.
    * @param defaultModel - Default model (defaults to 'gpt-4o').
    */
   static forOpenAi(apiKey: string, defaultModel = 'gpt-4o'): OpenAiAdapter {
      return new OpenAiAdapter({
         apiKey,
         baseUrl: 'https://api.openai.com/v1',
         defaultModel,
      })
   }

   /**
    * Preset for DeepSeek API endpoint (V3 & R1).
    *
    * @param apiKey - DeepSeek API key.
    * @param defaultModel - Default model (defaults to 'deepseek-chat').
    */
   static forDeepSeek(apiKey: string, defaultModel = 'deepseek-chat'): OpenAiAdapter {
      return new OpenAiAdapter({
         apiKey,
         baseUrl: 'https://api.deepseek.com/v1',
         defaultModel,
      })
   }

   /**
    * Preset for Alibaba Qwen API endpoint (DashScope OpenAI compatible).
    *
    * @param apiKey - DashScope API key.
    * @param defaultModel - Default model (defaults to 'qwen-plus').
    */
   static forQwen(apiKey: string, defaultModel = 'qwen-plus'): OpenAiAdapter {
      return new OpenAiAdapter({
         apiKey,
         baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
         defaultModel,
      })
   }

   /**
    * Preset for local or on-premise Ollama instance.
    *
    * @param baseUrl - Ollama endpoint URL (defaults to 'http://localhost:11434/v1').
    * @param defaultModel - Default model (defaults to 'llama3.2').
    */
   static forOllama(
      baseUrl = 'http://localhost:11434/v1',
      defaultModel = 'llama3.2',
   ): OpenAiAdapter {
      return new OpenAiAdapter({
         apiKey: 'ollama',
         baseUrl,
         defaultModel,
      })
   }

   /**
    * Preset for OpenRouter aggregator endpoint.
    *
    * @param apiKey - OpenRouter API key.
    * @param defaultModel - Default model (defaults to 'openrouter/auto').
    */
   static forOpenRouter(apiKey: string, defaultModel = 'openrouter/auto'): OpenAiAdapter {
      return new OpenAiAdapter({
         apiKey,
         baseUrl: 'https://openrouter.ai/api/v1',
         defaultModel,
      })
   }

   /**
    * Initialize the adapter and validate setup.
    */
   init(): void {
      this._initialized = true
   }

   /**
    * Sends a prompt to the OpenAI-compatible chat completions API and retrieves the response string.
    *
    * @param prompt - Text instruction or prompt query.
    * @param options - Execution options (model, messages, temperature, maxTokens).
    * @returns Generated text from model.
    */
   async generateText(prompt: string, options?: OpenAiGenerateOptions): Promise<string> {
      if (!this._initialized) {
         this.init()
      }

      const messages = this._buildMessages(prompt, options)
      const model = options?.model ?? this._defaultModel
      const temperature = options?.temperature ?? this._defaultTemperature

      const payload: Record<string, unknown> = {
         model,
         messages,
         temperature,
      }

      if (options?.maxTokens !== undefined) {
         payload.max_tokens = options.maxTokens
      }

      if (options?.responseFormat !== undefined) {
         payload.response_format = options.responseFormat
      }

      const response = await this._postChatCompletions(payload, options?.headers)
      const data = (await response.json()) as OpenAiChatResponse

      if (data.choices.length === 0) {
         return ''
      }

      const firstChoice = data.choices[0]
      return firstChoice.message.content ?? ''
   }

   /**
    * Strips optional markdown JSON codeblock fences from a response string.
    *
    * @param rawContent - Raw text output from model.
    * @returns Cleaned JSON text.
    */
   protected _cleanJsonFences(rawContent: string): string {
      let text = rawContent.trim()
      if (text.startsWith('```json')) {
         text = text.slice(7)
      } else if (text.startsWith('```')) {
         text = text.slice(3)
      }
      if (text.endsWith('```')) {
         text = text.slice(0, -3)
      }
      return text.trim()
   }

   /**
    * Generates structured data strictly conforming to a JSON schema.
    *
    * @param prompt - Context or instructions.
    * @param schema - Target JSON schema or contract.
    * @param options - Generation options.
    * @returns Parsed JSON object conforming to type T.
    */
   async generateStructured<T = unknown>(
      prompt: unknown,
      schema: unknown,
      options?: OpenAiGenerateOptions,
   ): Promise<T> {
      if (!this._initialized) {
         this.init()
      }

      const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt)
      const schemaInstruction = `You must return ONLY a valid JSON object strictly matching the following schema:\n${JSON.stringify(
         schema,
         null,
         2,
      )}`

      const messages: OpenAiMessage[] = [
         {
            role: 'system',
            content: options?.systemPrompt
               ? `${options.systemPrompt}\n\n${schemaInstruction}`
               : schemaInstruction,
         },
         {
            role: 'user',
            content: promptText,
         },
      ]

      const model = options?.model ?? this._defaultModel
      const temperature = options?.temperature ?? 0.2

      const payload: Record<string, unknown> = {
         model,
         messages,
         temperature,
         response_format: options?.responseFormat ?? { type: 'json_object' },
      }

      if (options?.maxTokens !== undefined) {
         payload.max_tokens = options.maxTokens
      }

      const response = await this._postChatCompletions(payload, options?.headers)
      const data = (await response.json()) as OpenAiChatResponse

      if (data.choices.length === 0) {
         throw new Error('OpenAiAdapter: No choices returned in chat completion response')
      }

      const firstChoice = data.choices[0]
      if (!firstChoice.message.content) {
         throw new Error('OpenAiAdapter: No content returned for structured output request')
      }

      const rawContent = firstChoice.message.content.trim()
      const cleaned = this._cleanJsonFences(rawContent)
      return JSON.parse(cleaned) as T
   }

   /**
    * Sends a prompt and returns an async iterable stream of generated text tokens.
    *
    * @param prompt - Text instruction or prompt query.
    * @param options - Execution options.
    * @returns Async iterable yielding chunks of text.
    */
   async generateTextStream(
      prompt: string,
      options?: OpenAiGenerateOptions,
   ): Promise<AsyncIterable<string>> {
      if (!this._initialized) {
         this.init()
      }

      const messages = this._buildMessages(prompt, options)
      const model = options?.model ?? this._defaultModel
      const temperature = options?.temperature ?? this._defaultTemperature

      const payload: Record<string, unknown> = {
         model,
         messages,
         temperature,
         stream: true,
      }

      if (options?.maxTokens !== undefined) {
         payload.max_tokens = options.maxTokens
      }

      const response = await this._postChatCompletions(payload, options?.headers)

      if (!response.body) {
         throw new Error('OpenAiAdapter: Stream response body is empty or unavailable')
      }

      return this._parseSseStream(response.body)
   }

   /**
    * Internal helper to build chat messages array.
    */
   protected _buildMessages(prompt: string, options?: OpenAiGenerateOptions): OpenAiMessage[] {
      if (options?.messages && options.messages.length > 0) {
         return options.messages
      }

      const messages: OpenAiMessage[] = []

      if (options?.systemPrompt) {
         messages.push({
            role: 'system',
            content: options.systemPrompt,
         })
      }

      messages.push({
         role: 'user',
         content: prompt,
      })

      return messages
   }

   /**
    * Internal helper to make an authorized POST request to /chat/completions.
    */
   protected async _postChatCompletions(
      payload: Record<string, unknown>,
      headers?: Record<string, string>,
   ): Promise<Response> {
      const url = `${this._baseUrl}/chat/completions`

      const controller = new AbortController()
      const timer = setTimeout(() => {
         controller.abort()
      }, this._timeoutMs)

      try {
         const response = await fetch(url, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               Authorization: `Bearer ${this._apiKey}`,
               ...this._customHeaders,
               ...headers,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
         })

         if (!response.ok) {
            let errorDetail = response.statusText
            try {
               const errorBody = (await response.json()) as { error?: { message?: string } }
               if (errorBody.error?.message) {
                  errorDetail = errorBody.error.message
               }
            } catch {
               // Keep statusText if body is not JSON
            }
            throw new Error(`OpenAiAdapter API error (${response.status}): ${errorDetail}`)
         }

         return response
      } finally {
         clearTimeout(timer)
      }
   }

   /**
    * Parse an individual Server-Sent Events line and extract delta content.
    *
    * @param line - Raw SSE line string.
    * @returns Text delta string if available, or null.
    */
   protected _parseSseLine(line: string): string | null {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') {
         return null
      }

      const jsonStr = trimmed.slice(6).trim()
      if (!jsonStr) {
         return null
      }

      try {
         const parsed = JSON.parse(jsonStr) as OpenAiChatChunk
         if (parsed.choices.length === 0) {
            return null
         }
         const firstChoice = parsed.choices[0]
         return firstChoice.delta.content ?? null
      } catch {
         return null
      }
   }

   /**
    * Internal async generator parsing Server-Sent Events (SSE) stream chunks.
    */
   protected async *_parseSseStream(
      body: ReadableStream<Uint8Array>,
   ): AsyncGenerator<string, void, unknown> {
      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
         let result = await reader.read()
         while (!result.done) {
            buffer += decoder.decode(result.value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
               if (line.trim() === 'data: [DONE]') {
                  return
               }
               const token = this._parseSseLine(line)
               if (token) {
                  yield token
               }
            }

            result = await reader.read()
         }
      } finally {
         reader.releaseLock()
      }
   }
}
