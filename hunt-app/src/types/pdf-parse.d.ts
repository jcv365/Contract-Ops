// pdf-parse ships no type declarations and there's no @types/pdf-parse
// package for this major version — a minimal ambient declaration for the
// one function this codebase actually calls (modules/evidence/cv-extraction.ts).
declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }
  function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}
