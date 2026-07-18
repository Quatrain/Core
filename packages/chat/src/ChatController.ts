import { Ai } from '@quatrain/ai';
import { Core } from '@quatrain/core';
import { ChatDocument } from './ChatDocument';

export interface ChatSessionConfig {
   provider: string;
   model?: string;
   systemPromptTemplate?: string;
   userProfile?: {
      name?: string;
      email?: string;
      language?: string;
   };
}

export class ChatController {
   constructor(private config: ChatSessionConfig) {}

   /**
    * Dispatches user message thread, matches local documents, extracts context, and returns the LLM stream.
    * 
    * @param messages - Complete message thread history.
    * @param documents - Availables documents for keyword/tag RAG injection.
    */
   async sendMessageStream(
      messages: { role: string; content: string }[],
      documents: ChatDocument[]
   ): Promise<{
      stream: AsyncIterable<string>;
      matchedDocsCount: number;
      enrichedContentLength: number;
      finalPrompt: string;
      model: string;
   }> {
      const lastMessage = messages[messages.length - 1]?.content || '';
      let enrichedContent = '';
      let matchedDocsCount = 0;

      // Clean list of stop words to refine search matching
      const stopWords = new Set([
         'les', 'des', 'une', 'pour', 'avec', 'dans', 'the', 'and', 'for', 
         'sur', 'aux', 'mon', 'mes', 'ton', 'tes', 'son', 'ses', 'une', 
         'par', 'grace', 'dune'
      ]);

      const cleanMsg = lastMessage.toLowerCase();

      for (const doc of documents) {
         const id = doc.uid || '';
         const title = doc.title || '';
         const tags = doc.tags || [];

         const hasIdMatch = cleanMsg.includes(id.toLowerCase());

         // Extract keywords from title
         const titleWords = title.toLowerCase()
            .replace(/[^\w\s-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));

         const hasTitleMatch = titleWords.some(word => cleanMsg.includes(word));

         const hasTagMatch = tags.some(tag =>
            tag.length > 2 && !stopWords.has(tag.toLowerCase()) && cleanMsg.includes(tag.toLowerCase())
         );

         if ((hasIdMatch || hasTitleMatch || hasTagMatch) && doc.contentLoader) {
            try {
               const fullText = await doc.contentLoader();
               enrichedContent += `\n\n[Full Content for Document: ${title} (${id})]\n---\n${fullText}\n---`;
               matchedDocsCount++;
            } catch (e: any) {
               Core.warn(`[ChatController] Failed to load full content for doc "${title}": ${e.message}`);
            }
         }
      }

      // Generate summaries context
      const docListContext = documents.map((item, idx) => {
         return `[Document #${idx + 1}]
ID: ${item.uid}
Title: ${item.title}
Category: ${item.category}
Tags: ${item.tags?.join(', ') || ''}
Summary: ${item.summary}`;
      }).join('\n\n');

      const userProfile = this.config.userProfile;
      const userContext = userProfile ? `User Profile:
- Name: ${userProfile.name || 'User'}
- Email: ${userProfile.email || 'Unknown'}
- Preferred Communication Language: ${userProfile.language || 'Français'}
` : '';

      const baseSystemPrompt = this.config.systemPromptTemplate || 
         `You are Second Brain Copilot, a tactile and touch-friendly personal knowledge assistant.
You help the user manage their uploaded documents, extract notes, draft content, and query information.`;

      const systemPrompt = `${baseSystemPrompt}

${userContext}

Below is the list of documents available in the Second Brain database:
${docListContext}
${enrichedContent}

Instructions:
1. Always keep responses clear, direct, and structured. Use Markdown headings, lists, and bold text to make it readable on a mobile screen.
2. Communicate with the user in their preferred language (${userProfile?.language || 'Français'}) and address them by their name if appropriate.
3. If the user asks about a document that you have the full content for (loaded above), answer their question using that content.
4. If they ask about a document but you don't have the full content, ask them to clarify or mention the title exactly so you can load it in the context window.
5. Keep the tone friendly, helpful, and concise.`;

      // Build historical prompt format
      const formattedMessages = messages.map((m: any) => 
         `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n');

      const finalPrompt = `${systemPrompt}\n\nChat History:\n${formattedMessages}\n\nAssistant:`;

      // Initialize AI Adapter
      let adapter;
      try {
         adapter = Ai.getAdapter();
      } catch (err: any) {
         throw new Error(`AI Adapter not initialized: ${err.message}`);
      }

      const model = this.config.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      Core.info(`[ChatController] Sending prompt to model: ${model}`);
      
      if (typeof adapter.generateTextStream !== 'function') {
         throw new Error('generateTextStream is not supported by the current AI adapter');
      }

      const stream = await adapter.generateTextStream(finalPrompt, { model });
      return {
         stream,
         matchedDocsCount,
         enrichedContentLength: enrichedContent.length,
         finalPrompt,
         model
      };
   }
}
