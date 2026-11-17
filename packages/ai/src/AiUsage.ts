/**
 * Token counts of one model call, as the provider reports them.
 * Providers may add fields of their own; the three below are the ones adapters agree on.
 */
export interface AiUsageInterface {
   /** Tokens of the request. */
   promptTokenCount?: number
   /** Tokens of the generated answer. */
   candidatesTokenCount?: number
   /** Total billed for the call. */
   totalTokenCount?: number
   [detail: string]: unknown
}

/**
 * Receives the usage of a model call. Pass it as the `onUsage` option of a generation method.
 */
export type AiUsageCallbackType = (usage: AiUsageInterface) => void
