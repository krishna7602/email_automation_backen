const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const fs = require('fs').promises;

class TextExtractor {
  async extractFromLocalFile(filePath, mimeType) {
    const buffer = await fs.readFile(filePath);

    if (mimeType.includes('pdf')) {
      const data = await pdfParse(buffer);
      return { text: data.text, method: 'pdf-parse' };
    }

    if (mimeType.includes('word') || mimeType.includes('document')) {
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value, method: 'mammoth' };
    }

    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      const workbook = xlsx.read(buffer);
      let text = '';
      workbook.SheetNames.forEach(sheet =>
        text += xlsx.utils.sheet_to_csv(workbook.Sheets[sheet])
      );
      return { text, method: 'xlsx' };
    }

    if (mimeType.includes('text')) {
      return { text: buffer.toString('utf8'), method: 'plain' };
    }

    return { text: '[Unsupported file]', method: 'none' };
  }
}

module.exports = new TextExtractor();
