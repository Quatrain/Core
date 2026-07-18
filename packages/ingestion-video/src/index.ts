import { AbstractIngestionAdapter, IngestionResult } from '@quatrain/ingestion'

export class VideoIngestionAdapter extends AbstractIngestionAdapter {
   async process(source: string | Buffer, options?: Record<string, any>): Promise<IngestionResult> {
      return {
         title: "Scaffolded Video",
         type: "video",
         summary: "Scaffolded video processing summary.",
         category: "inbox",
         tags: ["video"],
         properNouns: [],
         markdown: "Scaffolded video transcript content."
      }
   }

   canHandle(mimeType: string): boolean {
      return ['video/mp4', 'video/webm', 'video/x-matroska', 'application/x-youtube'].includes(mimeType)
   }
}
