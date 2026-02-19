import type { MultipartFile } from '@fastify/multipart';

/**
 * Document Parser Service
 * Extracts plain text from uploaded files (PDF, DOCX, MD, TXT)
 */

export async function parseDocument(file: MultipartFile): Promise<{ text: string; fileName: string; mimeType: string }> {
  const buffer = await file.toBuffer();
  const fileName = file.filename;
  const mimeType = file.mimetype;

  let text = '';

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    text = await parsePDF(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    text = await parseDOCX(buffer);
  } else if (mimeType === 'text/markdown' || fileName.endsWith('.md')) {
    text = buffer.toString('utf-8');
  } else if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
    text = buffer.toString('utf-8');
  } else {
    throw new Error(`Unsupported file type: ${mimeType} (${fileName})`);
  }

  return { text: text.trim(), fileName, mimeType };
}

async function parsePDF(buffer: Buffer): Promise<string> {
  // @ts-ignore - pdf-parse has no types
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export function parseTextInput(text: string): string {
  return text.trim().slice(0, 50000); // Max 50K chars
}
