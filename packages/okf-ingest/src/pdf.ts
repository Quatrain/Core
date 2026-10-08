import pdfParse from 'pdf-parse';

export interface PdfExtractionResult {
   text: string;
   pages?: string[];
   isScanned: boolean;
   pageCount: number;
}

// Filter out noisy pdf.js internal warnings (e.g. font private use area)
function createWarningFilter(origFn: (...args: unknown[]) => void) {
   return (...args: unknown[]) => {
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

   console.log = createWarningFilter(originalLog);
   console.warn = createWarningFilter(originalWarn);

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
   } catch (_error) {
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

/**
 * Extracts page-by-page text from a PDF buffer, preserving ordered sequence.
 *
 * @param buffer - Binary PDF file buffer.
 * @returns Array of text strings, one per page.
 */
export async function extractPdfPages(buffer: Buffer): Promise<string[]> {
   const pagesText: string[] = [];
   const originalLog = console.log;
   const originalWarn = console.warn;

   console.log = createWarningFilter(originalLog);
   console.warn = createWarningFilter(originalWarn);

   try {
      await pdfParse(buffer, {
         pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }) => {
            return pageData
               .getTextContent()
               .then((textContent) => {
                  let pageText = '';
                  for (const item of textContent.items) {
                     if (typeof item.str === 'string') {
                        pageText += item.str + ' ';
                     }
                  }
                  pagesText.push(pageText);
                  return pageText;
               })
               .catch(() => '');
         },
      });
      return pagesText;
   } catch (_error) {
      return [];
   } finally {
      console.log = originalLog;
      console.warn = originalWarn;
   }
}
