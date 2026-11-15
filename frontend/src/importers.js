import * as XLSX from 'xlsx';

const aliases = {
  english: ['word', 'words', 'english', '단어', '영어', '영단어', '영어 단어', 'vocabulary'],
  meaning: ['meaning', 'meanings', '뜻', '의미', '해석', '한글', '한국어 뜻'],
  partOfSpeech: ['part of speech', 'pos', '품사'],
  example: ['example', 'sentence', '예문'],
  exampleMeaning: ['example meaning', 'translation', '예문해석', '예문 해석'],
  day: ['day', '일차'],
  number: ['number', 'no', '번호'],
  sourcePage: ['source page', 'page', '출처 페이지', '페이지'],
};

function normalizeHeader(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function headerField(value) {
  const key = normalizeHeader(value);
  return Object.entries(aliases).find(([, names]) => names.includes(key))?.[0];
}

function mapHeaders(headers) {
  const result = {};
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    for (const [field, names] of Object.entries(aliases)) {
      if (!result[field] && names.includes(key)) result[field] = index;
    }
  });
  if (result.english === undefined) result.english = 0;
  if (result.meaning === undefined) result.meaning = 1;
  return result;
}

function findHeaderRow(matrix) {
  let best = { index: -1, score: 0 };
  matrix.slice(0, 30).forEach((row, index) => {
    const fields = new Set(row.map(headerField).filter(Boolean));
    const score = fields.size + (fields.has('english') ? 2 : 0) + (fields.has('meaning') ? 2 : 0);
    if (score > best.score) best = { index, score };
  });
  return best.score >= 4 ? best.index : -1;
}

function dayFromSheetName(sheetName) {
  const match = String(sheetName).match(/(?:day|일차)\s*[-_:]?\s*(\d+)/i);
  return match ? Number(match[1]) : '';
}

export async function importSpreadsheet(file) {
  const data = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const book = isCsv
    ? XLSX.read(new TextDecoder('utf-8').decode(data), { type: 'string' })
    : XLSX.read(data, { type: 'array' });
  const rows = [];
  for (const sheetName of book.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: '' });
    if (!matrix.length) continue;
    const headerIndex = findHeaderRow(matrix);
    const columns = mapHeaders(headerIndex >= 0 ? matrix[headerIndex] : []);
    const dataStart = headerIndex >= 0 ? headerIndex + 1 : 0;
    const sheetDay = dayFromSheetName(sheetName);
    let currentNumber = '';
    matrix.slice(dataStart).forEach((row, offset) => {
      if (!row.some((cell) => String(cell).trim())) return;
      const english = String(row[columns.english] ?? '').trim();
      const meaning = String(row[columns.meaning] ?? '').trim();
      if (!english || !meaning || headerField(english) === 'english') return;
      const rowNumber = columns.number === undefined ? '' : String(row[columns.number] ?? '').replace(/\.$/, '').trim();
      if (rowNumber) currentNumber = rowNumber;
      rows.push({
        english, meaning,
        partOfSpeech: columns.partOfSpeech === undefined ? '' : row[columns.partOfSpeech],
        example: columns.example === undefined ? '' : row[columns.example],
        exampleMeaning: columns.exampleMeaning === undefined ? '' : row[columns.exampleMeaning],
        day: columns.day === undefined ? sheetDay : Number(String(row[columns.day]).replace(/[^0-9]/g, '')) || sheetDay,
        number: currentNumber,
        sourcePage: columns.sourcePage === undefined ? '' : Number(row[columns.sourcePage]) || '',
        location: `${sheetName} ${dataStart + offset + 1}행`,
      });
    });
  }
  return rows;
}

function textToRows(text, page) {
  return text.split(/\n+/).flatMap((line) => {
    const clean = line.trim().replace(/^\d+[.)]?\s*/, '');
    if (!clean) return [];
    const match = clean.match(/^([A-Za-z][A-Za-z' -]*(?:\s+[A-Za-z][A-Za-z' -]*)*)\s+(?:[-–—:]\s*)?(.+)$/);
    return match ? [{ english: match[1], meaning: match[2], location: `PDF ${page}페이지`, raw: clean }] : [];
  });
}

function isVocabularyWord(value) {
  return /^[A-Za-z0-9][A-Za-z0-9 .'()\-+/~↔]*$/.test(value.trim());
}

export function parseToeicTablePage(items, page, day, width = 595) {
  const positioned = items
    .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))
    .filter((item) => item.text);
  const scale = width / 595;
  const columns = [
    { word: [55, 135], pos: [135, 160], meaning: [160, 305], number: [35, 60], side: 'left' },
    { word: [330, 410], pos: [405, 430], meaning: [430, 600], number: [305, 330], side: 'right' },
  ].map((column) => Object.fromEntries(Object.entries(column).map(([key, value]) => [key, Array.isArray(value) ? value.map((n) => n * scale) : value])));
  const result = [];

  for (const column of columns) {
    const wordItems = positioned
      .filter((item) => item.x >= column.word[0] && item.x < column.word[1] && isVocabularyWord(item.text))
      .sort((a, b) => b.y - a.y);
    const posItems = positioned.filter((item) => item.x >= column.pos[0] && item.x < column.pos[1] && /^(명|동|형|부)\./.test(item.text));
    const bases = [];
    for (const word of wordItems) {
      const hasPartOfSpeech = posItems.some((pos) => Math.abs(pos.y - word.y) <= 5 * scale);
      if (hasPartOfSpeech) bases.push({ y: word.y, parts: [word.text] });
      else if (bases.length && bases.at(-1).y - word.y <= 32 * scale) bases.at(-1).parts.push(word.text);
    }

    let currentNumber = '';
    bases.forEach((base, index) => {
      const nextY = bases[index + 1]?.y ?? -Infinity;
      const top = base.y + 10 * scale;
      const bottom = nextY + 6 * scale;
      const inSpan = (item) => item.y <= top && item.y > bottom;
      const parts = posItems.filter(inSpan).map((item) => item.text);
      const meanings = positioned
        .filter((item) => item.x >= column.meaning[0] && item.x < column.meaning[1] && inSpan(item))
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((item) => item.text);
      const numberItem = positioned.find((item) => item.x >= column.number[0] && item.x < column.number[1] && inSpan(item) && /^\d+\.?$/.test(item.text));
      if (numberItem) currentNumber = numberItem.text.replace(/\.$/, '');
      if (!parts.length || !meanings.length) return;
      const english = base.parts.join(' ').replace(/\s+/g, ' ').trim();
      const meaning = meanings.join('\n');
      result.push({
        english,
        meaning,
        partOfSpeech: [...new Set(parts)].join('/'),
        day,
        number: currentNumber,
        sourcePage: page,
        location: `PDF ${page}페이지 · Day ${day}`,
        raw: `${english} ${[...new Set(parts)].join('/')} ${meaning.replace(/\n/g, ' ')}`,
      });
    });
  }
  return result.sort((a, b) => Number(a.number || 999) - Number(b.number || 999) || a.english.localeCompare(b.english));
}

export async function importPdf(file, onProgress = () => {}) {
  const isBrowser = typeof window !== 'undefined';
  const pdfjsLib = isBrowser
    ? await import('pdfjs-dist')
    : await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (isBrowser) {
    const { default: pdfWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, disableWorker: !isBrowser }).promise;
  const rows = [];
  const emptyPages = [];
  let currentDay = null;
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    onProgress(`PDF ${pageNo}/${pdf.numPages} 페이지 읽는 중`);
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const header = content.items.map((item) => item.str).join(' ').match(/Day\s*(\d+)/i);
    if (header) currentDay = Number(header[1]);
    const tableRows = currentDay ? parseToeicTablePage(content.items, pageNo, currentDay, page.view[2]) : [];
    if (tableRows.length >= 3) {
      rows.push(...tableRows);
      continue;
    }
    const text = content.items.map((item) => `${item.str}${item.hasEOL ? '\n' : ' '}`).join('');
    const parsed = textToRows(text, pageNo);
    if (parsed.length) rows.push(...parsed); else emptyPages.push({ page, pageNo });
  }
  if (emptyPages.length) {
    const { createWorker } = await import('tesseract.js');
    onProgress(`스캔 페이지 ${emptyPages.length}개 OCR 처리 중`);
    const worker = await createWorker(['eng', 'kor']);
    try {
      for (const { page, pageNo } of emptyPages) {
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const image = isBrowser ? canvas : canvas.toBuffer('image/png');
        const result = await worker.recognize(image);
        rows.push(...textToRows(result.data.text, pageNo).map((row) => ({ ...row, ocr: true })));
      }
    } finally {
      await worker.terminate();
    }
  }
  return rows;
}
