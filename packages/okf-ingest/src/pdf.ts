import pdfParse from 'pdf-parse';

export interface PdfExtractionResult {
   text: string;
   isScanned: boolean;
   pageCount: number;
}

/**
 * Extracts raw textual layer from a PDF buffer, silencing noisy pdf.js private font warnings.
 *
 * @param buffer - Binary PDF file buffer.
 * @returns PdfExtractionResult containing extracted text, pageCount, and whether it is scanned.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult> {
   const originalLog = console.log;
   const originalWarn = console.warn;

   // Filter out noisy pdf.js internal warnings (e.g. font private use area)
   const filterWarning = (origFn: (...args: unknown[]) => void) => (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (
         msg.includes('private use area') ||
         msg.includes('Ran out of space in font') ||
         msg.startsWith('Warning: ')
      ) {
         return;
      }
      origFn(...args);
   };

   console.log = filterWarning(originalLog);
   console.warn = filterWarning(originalWarn);

   try {
      const parsed = await pdfParse(buffer);
      const text = parsed.text || '';
      const trimmed = text.trim();
      const pageCount = parsed.numpages || 1;

      // When text density is fewer than 150 characters across the file, consider it scanned/rasterized
      const isScanned = trimmed.length < 150;

      return {
         text,
         isScanned,
         pageCount,
      };
   } catch {
      return {
         text: '',
         isScanned: true,
         pageCount: 1,
      };
   } finally {
      console.log = originalLog;
      console.warn = originalWarn;
   }
}
