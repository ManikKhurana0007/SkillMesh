import { describe, expect, it } from 'vitest';
import { extractProjectRequirements } from '../../backend/src/services/projectRequirements.js';

describe('extractProjectRequirements', () => {
  it('extracts UTF-8 text and markdown content', async () => {
    const text = await extractProjectRequirements({
      originalname: 'requirements.txt',
      buffer: Buffer.from('Students can plan work across multiple courses.', 'utf8'),
    });
    const markdown = await extractProjectRequirements({
      originalname: 'requirements.md',
      buffer: Buffer.from('# Requirements\n\nStudents can plan work.', 'utf8'),
    });

    expect(text.text).toBe('Students can plan work across multiple courses.');
    expect(markdown.text).toContain('# Requirements');
    expect(text.attachment).toBeUndefined();
  });

  it('passes validated PDF files to Gemini as document attachments', async () => {
    const buffer = Buffer.from('%PDF-1.7\ncontent');
    const result = await extractProjectRequirements({ originalname: 'requirements.pdf', buffer });

    expect(result.text).toBe('');
    expect(result.attachment).toEqual({ mimeType: 'application/pdf', buffer });
  });

  it('rejects invalid document signatures and malformed UTF-8', async () => {
    await expect(extractProjectRequirements({
      originalname: 'requirements.docx',
      buffer: Buffer.from('not a word document'),
    })).rejects.toThrow('This file is not a valid DOCX document.');
    await expect(extractProjectRequirements({
      originalname: 'requirements.doc',
      buffer: Buffer.from('not a word document'),
    })).rejects.toThrow('This file is not a valid DOC document.');
    await expect(extractProjectRequirements({
      originalname: 'requirements.txt',
      buffer: Buffer.from([0xc3, 0x28]),
    })).rejects.toThrow('This text document is not valid UTF-8.');
  });

  it('rejects empty or invalid PDFs', async () => {
    await expect(extractProjectRequirements({
      originalname: 'requirements.pdf',
      buffer: Buffer.from('not a pdf'),
    })).rejects.toThrow('This file is not a valid PDF.');
    await expect(extractProjectRequirements({
      originalname: 'requirements.txt',
      buffer: Buffer.from('  \n'),
    })).rejects.toThrow('The requirements document contains no readable text.');
  });
});
