/** Fragments shorter than this are merged with the next sentence, to avoid choppy playback. */
export const MIN_SENTENCE_CHARS = 24

/** Longer sentences are split at the last comma or space before this length. */
export const MAX_SENTENCE_CHARS = 240

/**
 * Splits a sentence longer than {@link MAX_SENTENCE_CHARS} at commas, then spaces.
 *
 * @param sentence - Sentence to split.
 * @returns Chunks no longer than the maximum (except single words longer than it).
 */
function splitLong(sentence: string): string[] {
   const chunks: string[] = []
   let rest = sentence
   while (rest.length > MAX_SENTENCE_CHARS) {
      const window = rest.slice(0, MAX_SENTENCE_CHARS)
      const comma = window.lastIndexOf(', ')
      const space = window.lastIndexOf(' ')
      const cut = comma > MIN_SENTENCE_CHARS ? comma + 1 : space > 0 ? space : MAX_SENTENCE_CHARS
      chunks.push(rest.slice(0, cut).trim())
      rest = rest.slice(cut).trim()
   }
   if (rest) {
      chunks.push(rest)
   }
   return chunks
}

/**
 * Splits a text into sentences, so playback can start on the first one while the next ones are prepared.
 * Very short fragments are merged with the following sentence; very long sentences are split at commas.
 *
 * @param text - Text to speak.
 * @returns Sentences in reading order, without empty items.
 */
export function splitSentences(text: string): string[] {
   const normalized = text.replace(/\s+/g, ' ').trim()
   if (!normalized) {
      return []
   }
   const raw = normalized.match(/[^.!?…]+(?:[.!?…]+|$)/g) ?? [normalized]
   const merged: string[] = []
   let pending = ''
   for (const part of raw) {
      const sentence = `${pending} ${part.trim()}`.trim()
      if (sentence.length < MIN_SENTENCE_CHARS) {
         pending = sentence
      } else {
         merged.push(sentence)
         pending = ''
      }
   }
   if (pending) {
      if (merged.length > 0) {
         merged[merged.length - 1] = `${merged[merged.length - 1]} ${pending}`
      } else {
         merged.push(pending)
      }
   }
   return merged.flatMap(splitLong)
}
