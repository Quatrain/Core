import { AbstractIngestionAdapter, IngestionResult } from '@quatrain/ingestion';
import { Ai } from '@quatrain/ai';
import { Core } from '@quatrain/core';
import pdf from 'pdf-parse';

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

export class OcrIngestionAdapter extends AbstractIngestionAdapter {
   async process(source: string | Buffer, options: Record<string, any> = {}): Promise<IngestionResult> {
      const buffer = typeof source === 'string' ? Buffer.from(source, 'utf-8') : source;
      const isImage = options.mimeType?.startsWith('image/') || options.isImage;
      const gemini = Ai.getAdapter();
      const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

      let rawText = '';
      let isScannedPdf = false;
      let mediaPart: any = null;

      if (isImage) {
         const base64Data = buffer.toString('base64');
         const mimeType = options.mimeType || 'image/jpeg';
         mediaPart = {
            inlineData: {
               mimeType,
               data: base64Data
            }
         };
      } else {
         // PDF handling
         let pdfText = '';
         try {
            const pdfData = await pdf(buffer);
            pdfText = pdfData.text || '';
         } catch (err: any) {
            Core.warn(`[OcrIngestionAdapter] Failed to parse PDF with pdf-parse: ${err.message}`);
         }

         if (pdfText.trim().length < 150) {
            Core.info(`[OcrIngestionAdapter] PDF has too little text layer (${pdfText.trim().length} chars). Using direct Gemini multimodal PDF OCR.`);
            isScannedPdf = true;
            const base64Data = buffer.toString('base64');
            mediaPart = {
               inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Data
               }
            };
         } else {
            rawText = pdfText;
         }
      }

      let result;

      if (isImage) {
         const imagePrompt = `You are a professional documentation assistant. Below is an uploaded image. Your task is to extract its metadata and transcribe/describe it.

Instructions for fields:
- "title": Clean, concise title.
- "type": Type of concept/document (e.g., screenshot, diagram, sketch, note).
- "summary": A concise 2-3 sentence summary.
- "category": Suggested folder path containing at most 2 levels (e.g., technology/ai, visual/diagrams).
- "tags": Relevant tags.
- "properNouns": List of proper nouns representing people, artists, bands, and collectives. Do NOT include institutions (such as publishing houses, corporations, museums, or universities) or locations/places (such as foundations, cities, or attractions) to prevent polluting the concepts directory.
- "markdown": A detailed Markdown transcription or exhaustive description of the image content, including all text blocks, diagrams, annotations, and visual components.

${options.contextNote ? `Crucial User Context Note:\n- ${options.contextNote}\n` : ''}`;

         result = await gemini.generateStructured([
            { text: imagePrompt },
            mediaPart
         ], IngestionSchema, { model });
      } else if (isScannedPdf) {
         const pdfPrompt = `You are a professional documentation assistant. Below is an uploaded scanned or image-only PDF document. Your task is to perform OCR on its pages, extract its metadata, and transcribe its content.

Instructions for fields:
- "title": Clean, concise title of the document.
- "type": Type of concept/document (e.g., diploma, certificate, resume, contract, guide, etc.).
- "summary": A concise 2-3 sentence semantic summary of the document.
- "category": Suggested folder path containing at most 2 levels (e.g., career/diplomas, career/resume).
- "tags": Relevant lowercase tags.
- "properNouns": List of proper nouns representing people, artists, bands, and collectives. Do NOT include institutions (such as publishing houses, corporations, museums, or universities) or locations/places (such as foundations, cities, or attractions) to prevent polluting the concepts directory.
- "markdown": You MUST generate a complete, high-fidelity, and verbatim transcription of the main content of the PDF pages in Markdown. Do NOT summarize the content, do NOT skip sections, signatures, logos, or official stamps. Preserve all text detail and dates exactly as they appear in the original document.

${options.contextNote ? `Crucial User Context Note:\n- ${options.contextNote}\n` : ''}`;

         result = await gemini.generateStructured([
            { text: pdfPrompt },
            mediaPart
         ], IngestionSchema, { model });
      } else {
         const textPrompt = `You are a professional documentation assistant. Below is a raw document text. Your task is to extract its metadata and structure it.

Instructions for fields:
- "title": Clean, concise title of the document.
- "type": Type of concept/document (e.g., resume, article, guide, recipe, etc.).
- "summary": A concise 2-3 sentence semantic summary of the document.
- "category": Suggested folder path containing at most 2 levels (e.g., career/resume, culinary/recipes).
- "tags": Relevant lowercase tags.
- "properNouns": List of proper nouns representing people, artists, bands, and collectives. Do NOT include institutions (such as publishing houses, corporations, museums, or universities) or locations/places (such as foundations, cities, or attractions) to prevent polluting the concepts directory.
- "markdown": You MUST generate a complete, high-fidelity, and verbatim transcription of the main content in Markdown. Do NOT summarize the content, do NOT skip sections, descriptions, bullet points, or contact info. Preserve all text detail, lists, and dates exactly as they appear in the original text, only cleaning up navigation or visual noise.

${options.contextNote ? `Crucial User Context Note:\n- ${options.contextNote}\n` : ''}

Raw Text:
---
${rawText}
---`;

         result = await gemini.generateStructured(textPrompt, IngestionSchema, { model });
      }

      return result as IngestionResult;
   }

   canHandle(mimeType: string): boolean {
      return ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'].includes(mimeType);
   }
}
