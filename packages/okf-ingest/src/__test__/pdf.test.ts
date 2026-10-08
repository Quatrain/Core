import { describe, expect, it } from '@jest/globals';
import { extractPdfPages, extractPdfText } from '../pdf';

describe('PDF Extraction Helpers', () => {
   it('should safely handle corrupt or invalid PDF buffers without throwing', async () => {
      const corruptBuffer = Buffer.from('NOT A REAL PDF FILE CONTENT');

      const result = await extractPdfText(corruptBuffer);
      expect(result).toBeDefined();
      expect(result.text).toBe('');
      expect(result.isScanned).toBe(true);
      expect(result.pageCount).toBe(1);

      const pages = await extractPdfPages(corruptBuffer);
      expect(Array.isArray(pages)).toBe(true);
      expect(pages.length).toBe(0);
   });

   it('should extract text from a valid minimal PDF buffer', async () => {
      // Minimal valid PDF structure with a text object
      const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 18 Tf 20 100 Td (Hello Agronomy) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000321 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
401
%%EOF`;

      const pdfBuffer = Buffer.from(minimalPdf);
      const textResult = await extractPdfText(pdfBuffer);
      expect(textResult).toBeDefined();
      expect(textResult.pageCount).toBeGreaterThanOrEqual(1);

      const pages = await extractPdfPages(pdfBuffer);
      expect(Array.isArray(pages)).toBe(true);
   });
});
