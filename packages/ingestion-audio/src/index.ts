import { AbstractIngestionAdapter, IngestionResult } from '@quatrain/ingestion';
import { Ai } from '@quatrain/ai';
import { Core } from '@quatrain/core';

export const IngestionSchema = {
   type: 'OBJECT',
   properties: {
      title: { type: 'STRING' },
      type: { type: 'STRING' },
      summary: { type: 'STRING' },
      category: { type: 'STRING' },
      tags: { 
         type: 'ARRAY', 
         items: { type: 'STRING' } 
      },
      properNouns: {
         type: 'ARRAY',
         items: { type: 'STRING' }
      },
      markdown: { type: 'STRING' },
      deductedDate: { type: 'STRING' }
   },
   required: ['title', 'type', 'summary', 'category', 'tags', 'properNouns', 'markdown']
};

export class AudioIngestionAdapter extends AbstractIngestionAdapter {
   async process(source: string | Buffer, options: Record<string, any> = {}): Promise<IngestionResult> {
      const buffer = typeof source === 'string' ? Buffer.from(source, 'utf-8') : source;
      const base64Data = buffer.toString('base64');
      const gemini = Ai.getAdapter();
      const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

      const mimeType = options.mimeType || 'audio/wav';
      const mediaPart = {
         inlineData: {
            mimeType,
            data: base64Data
         }
      };

      const locationContext = options.locationContext || 'Unknown';

      const audioPrompt = `You are a professional voice note assistant. Below is an uploaded audio recording (voice note). Your task is to:
1. Generate a high-fidelity, verbatim transcription of everything said in the audio recording under the "markdown" field. Do NOT summarize or skip any words in the transcription. Use proper punctuation and paragraph breaks.
2. Determine a clean, descriptive title for the note based on the content of the recording.
3. Determine a friendly concept type for the document (e.g. "note", "meeting", "reminder", "thought", "journal"). Use lowercase, singular. Default to "note".
4. Draft a 2-3 sentence summary of the recording.
5. Identify 3-5 relevant keyword tags. Format tags as lowercase strings.
6. Under "properNouns", specifically list all proper nouns of people, artists, bands, and collectives mentioned in the audio in their correct capitalization. Do NOT include institutions (such as publishing houses, corporations, museums, or universities) or locations/places (such as foundations, cities, or attractions) to prevent polluting the concepts directory.
7. Determine the date and category of the document:
   - Check if a specific date or relative time of event is clearly stated/spoken in the transcription text (e.g., "hier", "avant-hier", "lundi dernier", "aujourd'hui", "le 15 mars", "le 23 mai").
   - If a date or relative date is mentioned, perform a calendar deduction relative to the System Date/Time context below. For example:
     * If System Date is "2026-07-18" (which is a Saturday) and the audio says "hier", the deducted date is "2026-07-17".
     * If System Date is "2026-07-18" (which is a Saturday) and the audio says "avant-hier", the deducted date is "2026-07-16".
     * If System Date is "2026-07-18" (which is a Saturday) and the audio says "lundi" or "lundi dernier", the deducted date is "2026-07-13".
     * Deduct the correct calendar date and write it in the "deductedDate" field in the format "YYYY-MM-DD".
   - Suggest the category as "journal" (or "journal/personal", "journal/work") if the document is recorded live OR has a clearly stated/deducted date.
   - If NO date or relative date is clearly mentioned/spoken, and the file was an uploaded audio file (Live Recording = No), the category MUST be "inbox" and NOT "journal", and "deductedDate" should be omitted or left blank.
   - Under the "markdown" field, if a date or relative date was clearly mentioned, prefix the markdown content with a header showing the parsed/stated date (e.g., "**Date énoncée :** le 15 mars 2026 (Déduit : 2026-03-15)").
8. Process Geolocation (Note-taking Location):
   - If a note-taking location is provided (Context: Location of Note-Taking is not "Unknown") AND the voice note describes a recent event/thought (e.g., today, yesterday, a few days ago, or a recent trip/meeting/place visiting), you MUST:
     * Add the city name (e.g., "Paris", "Marseille") to the "tags" array so the note is indexable by this place.
     * Add a header line at the very top of the "markdown" field with the location (e.g. "**Lieu de prise de note :** Paris, France").

Context:
- Live Recording: ${options.recordedLive ? 'Yes' : 'No'}
- Current Date/Time (System): ${new Date().toISOString()} (Day of week: ${new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date())})
- Location of Note-Taking: ${locationContext}
${options.contextNote ? `- User Context Note: ${options.contextNote}\n` : ''}`;

      Core.info(`[AudioIngestionAdapter] Transcribing and structuring audio memo using model: ${model}`);
      const result = await gemini.generateStructured([
         { text: audioPrompt },
         mediaPart
      ], IngestionSchema, { model });
      return result as IngestionResult;
   }

   canHandle(mimeType: string): boolean {
      return ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'audio/caf'].includes(mimeType);
   }
}
