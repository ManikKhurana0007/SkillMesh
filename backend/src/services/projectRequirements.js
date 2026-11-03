import WordExtractor from "word-extractor";

const wordExtractor = new WordExtractor();
const signatures = {
  pdf: buffer => buffer.subarray(0, 5).toString("ascii") === "%PDF-",
  doc: buffer => buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  docx: buffer => buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
};

function documentError(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export async function extractProjectRequirements(file) {
  if (!file) return { text: "", attachment: undefined };

  const extension = file.originalname.split(".").pop()?.toLowerCase();
  if (extension === "pdf") {
    if (!signatures.pdf(file.buffer)) throw documentError("This file is not a valid PDF.");
    return { text: "", attachment: { mimeType: "application/pdf", buffer: file.buffer } };
  }

  let text;
  if (extension === "doc" || extension === "docx") {
    if (!signatures[extension](file.buffer)) {
      throw documentError(`This file is not a valid ${extension.toUpperCase()} document.`);
    }
    try {
      const document = await wordExtractor.extract(file.buffer);
      text = document.getBody();
    } catch (error) {
      console.error(`Project requirements ${extension.toUpperCase()} extraction failed:`, error.message);
      throw documentError(`Could not read this ${extension.toUpperCase()} document. Try saving it again as DOCX, PDF, or TXT.`);
    }
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
    } catch {
      throw documentError("This text document is not valid UTF-8. Save it as UTF-8 TXT or Markdown and try again.");
    }
  }

  const normalizedText = text.replace(/\0/g, "").trim();
  if (!normalizedText) throw documentError("The requirements document contains no readable text.");
  return { text: normalizedText.slice(0, 40_000), attachment: undefined };
}
