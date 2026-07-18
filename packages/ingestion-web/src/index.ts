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

export class WebIngestionAdapter extends AbstractIngestionAdapter {
   async process(source: string | Buffer, options: Record<string, any> = {}): Promise<IngestionResult> {
      const rawText = typeof source === 'string' ? source : source.toString('utf-8');
      const gemini = Ai.getAdapter();
      const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

      const parentPrompt = `You are a professional documentation assistant. Below is the raw text of a web page. Your task is to:
1. Extract a concise, accurate title for the document.
2. Determine a friendly concept type for the document (e.g. "website", "specification", "guide", "article", "report", "manual", "note"). Use lowercase, singular. Since this is the main entry point page of a website, you MUST use the value "website" as the type.
3. Draft a 2-3 sentence summary.
4. Clean and format the raw text into clean, beautiful markdown. Preserve all headings, lists, tables, code blocks, and links while removing navigation menus, headers, footers, sidebars, and advertising blocks.
5. Suggest a hierarchical category folder path containing at most 2 levels/segments (e.g. "technology/programming", "literature/fiction", "finance/investment", "personal/notes", "health/fitness") that best fits the document content. The category path should use lowercase letters, numbers, and slashes for segments (do not include trailing/leading slashes, and do not use "inbox" as the top level unless no other category is appropriate).
6. Identify 3-5 relevant keyword tags.

${options.contextNote ? `Crucial User Context Note / Focus Instructions:\n- ${options.contextNote}\nUse this context to guide the title extraction, type determination, summary creation, tags selection, category suggestions, and clean markdown formatting.\n` : ''}

Raw HTML Text:
---
${rawText}
---`;

      Core.info(`[WebIngestionAdapter] Generating structured metadata for web page using model: ${model}`);
      const result = await gemini.generateStructured(parentPrompt, IngestionSchema, { model });
      return result as IngestionResult;
   }

   canHandle(mimeType: string): boolean {
      return ['text/html', 'application/xhtml+xml', 'application/x-web-link'].includes(mimeType);
   }
}
