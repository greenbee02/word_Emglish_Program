import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import 'tesseract.js';
import * as XLSX from 'xlsx';
import { importPdf, importSpreadsheet, parseToeicTablePage } from '../src/importers.js';

test('UTF-8 CSV에서 단어와 한글 뜻을 추출한다', async () => {
  const csv = 'Word,Meaning,Part of Speech\napplicant,지원자,명사\nshipment,배송,명사';
  const rows = await importSpreadsheet(new File([csv], 'words.csv'));
  assert.deepEqual(rows.map(row => [row.english, row.meaning]), [
    ['applicant', '지원자'],
    ['shipment', '배송'],
  ]);
});

test('여러 시트의 XLSX에서 다른 열 이름도 인식한다', async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['영어', '뜻', '품사'], ['reimburse', '비용을 상환하다', '동사'],
  ]), 'DAY 1');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['Word', 'Meaning'], ['applicant', '지원자'],
  ]), 'DAY 2');
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  const rows = await importSpreadsheet(new File([bytes], 'words.xlsx'));
  assert.deepEqual(rows.map(row => row.english), ['reimburse', 'applicant']);
  assert.deepEqual(rows.map(row => row.location), ['DAY 1 2행', 'DAY 2 2행']);
});

test('제목 행이 있는 Day별 XLSX에서 헤더와 Day를 자동 인식한다', async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['TOEIC 700 필수어휘 - Day 4'],
    ['Source: PDF 8-9페이지'],
    ['Number', 'Word', 'Part of Speech', 'Meaning', 'Source Page'],
    [1, 'favor', '명./동.', '호의, 선호\n선호하다', 8],
    ['', 'favorable', '형.', '호의적인', 8],
  ]), 'Day 4');
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  const rows = await importSpreadsheet(new File([bytes], 'day4.xlsx'));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => [row.english, row.day, row.number, row.sourcePage]), [
    ['favor', 4, '1', 8],
    ['favorable', 4, '1', 8],
  ]);
  assert.deepEqual(rows.map(row => row.location), ['Day 4 4행', 'Day 4 5행']);
});

test('텍스트 PDF의 줄별 단어와 뜻, 페이지 위치를 추출한다', async () => {
  const document = await PDFDocument.create();
  const page = document.addPage([500, 700]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText('applicant candidate', { x: 50, y: 620, size: 16, font });
  page.drawText('shipment delivery', { x: 50, y: 580, size: 16, font });
  const bytes = await document.save();
  const rows = await importPdf(new File([bytes], 'words.pdf'));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.english), ['applicant', 'shipment']);
  assert.ok(rows.every(row => row.location === 'PDF 1페이지'));
  assert.ok(rows.every(row => row.raw));
});

test('이미지 전용 PDF는 OCR로 단어와 뜻을 추출한다', async () => {
  const imageCanvas = createCanvas(1200, 500);
  const imageContext = imageCanvas.getContext('2d');
  imageContext.fillStyle = 'white';
  imageContext.fillRect(0, 0, 1200, 500);
  imageContext.fillStyle = 'black';
  imageContext.font = 'bold 72px Arial';
  imageContext.fillText('applicant candidate', 70, 180);
  imageContext.fillText('shipment delivery', 70, 350);

  const document = await PDFDocument.create();
  const page = document.addPage([600, 250]);
  const image = await document.embedPng(imageCanvas.toBuffer('image/png'));
  page.drawImage(image, { x: 0, y: 0, width: 600, height: 250 });
  const bytes = await document.save();

  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => createCanvas(1, 1) };
  try {
    const rows = await importPdf(new File([bytes], 'scan.pdf'));
    assert.ok(rows.some(row => row.english.toLowerCase().includes('applicant')));
    assert.ok(rows.every(row => row.ocr === true));
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('좌우 표 형식의 토익 PDF에서 행과 줄바꿈된 숙어를 추출한다', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  const rows = parseToeicTablePage([
    item('25.', 314, 300),
    item('on a first-come', 339, 300),
    item('부.', 412, 297),
    item('선착순으로', 434, 297),
    item('first-served', 339, 287),
    item('basis', 339, 274),
    item('26.', 314, 250),
    item('fund', 339, 250),
    item('동.', 412, 248),
    item('자금을 대다', 434, 248),
  ], 10, 5, 595);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].english, 'on a first-come first-served basis');
  assert.equal(rows[0].day, 5);
  assert.equal(rows[0].number, '25');
  assert.equal(rows[1].english, 'fund');
});
