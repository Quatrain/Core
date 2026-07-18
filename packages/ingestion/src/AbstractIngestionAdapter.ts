export interface IngestionResult {
   title: string;
   type: string;
   summary: string;
   category: string;
   tags: string[];
   properNouns: string[];
   markdown: string;
   deductedDate?: string;
}

export abstract class AbstractIngestionAdapter {
   constructor(protected config: Record<string, any> = {}) {}

   /**
    * Process input source (file path, URL, or raw data) and extract structured content.
    */
   abstract process(source: string | Buffer, options?: Record<string, any>): Promise<IngestionResult>;

   /**
    * Returns true if this adapter can handle the specified file MIME type or scheme.
    */
   abstract canHandle(mimeType: string): boolean;
}
