// mammoth ships no type declarations and there's no @types/mammoth package
// — a minimal ambient declaration for the one function this codebase
// actually calls (modules/evidence/cv-extraction.ts).
declare module 'mammoth' {
  interface ExtractRawTextResult {
    value: string;
    messages: unknown[];
  }
  export function extractRawText(input: { buffer: Buffer } | { path: string }): Promise<ExtractRawTextResult>;
}
