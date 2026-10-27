import { MAX_SENTENCE_CHARS, splitSentences } from './splitSentences'

describe('splitSentences', () => {
   it('returns nothing for blank text', () => {
      expect(splitSentences('   ')).toEqual([])
   })

   it('splits on sentence punctuation and normalizes spaces', () => {
      expect(splitSentences('The meeting room is quite full.  Start without me!   Is that fine?')).toEqual([
         'The meeting room is quite full.',
         'Start without me! Is that fine?',
      ])
   })

   it('merges short fragments with the next sentence', () => {
      expect(splitSentences('Hello. The weather looks fine for tomorrow morning.')).toEqual([
         'Hello. The weather looks fine for tomorrow morning.',
      ])
   })

   it('appends a trailing short fragment to the previous sentence', () => {
      expect(splitSentences('The weather looks fine for tomorrow morning. Ok.')).toEqual([
         'The weather looks fine for tomorrow morning. Ok.',
      ])
   })

   it('keeps text without final punctuation', () => {
      expect(splitSentences('The weather looks fine for tomorrow')).toEqual(['The weather looks fine for tomorrow'])
   })

   it('splits very long sentences at commas', () => {
      const clause = 'the package keeps the contract small and easy to read'
      const long = Array.from({ length: 8 }, () => clause).join(', ') + '.'
      const chunks = splitSentences(long)
      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.every((chunk) => chunk.length <= MAX_SENTENCE_CHARS)).toBe(true)
      expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(long)
   })
})
