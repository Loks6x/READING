// utils/bookImporter.ts
import ePub from 'epubjs';
import { UnifiedBook, UnifiedChapter } from '../types';

// ==========================================
// ГЛАВНЫЙ РОУТЕР (Определяет формат)
// ==========================================
export async function parseBookToUnifiedJSON(file: File): Promise<UnifiedBook> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'epub') return parseEpub(file);
  if (ext === 'fb2') return parseFb2(file);
  if (ext === 'txt') return parseTxt(file);

  throw new Error(`Формат .${ext} пока не поддерживается. Используйте EPUB, FB2 или TXT.`);
}

// ==========================================
// ПАРСЕР 1: EPUB (epubjs)
// ==========================================
async function parseEpub(file: File): Promise<UnifiedBook> {
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  await book.ready;
  
  const meta = await book.loaded.metadata;
  const coverUrl = await book.coverUrl(); 
  const chapters: UnifiedChapter[] = [];
  const spine = await book.loaded.spine;
  
  for (let i = 0; i < spine.length; i++) {
    const spineObj = spine as any;
    const section = spineObj.get ? spineObj.get(i) : spineObj[i];
    
    const chapter = await section.load(book.load.bind(book));
    const doc = new DOMParser().parseFromString(chapter, "application/xhtml+xml");
    
    doc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => el.removeAttribute('style'));

    const bodyHtml = doc.body.innerHTML;
    const wordCount = (doc.body.textContent || "").split(/\s+/).filter(w => w.length > 0).length;

    chapters.push({ id: section.idref, title: `Глава ${i + 1}`, content: bodyHtml, wordCount });
  }

  return {
    id: meta.identifier || crypto.randomUUID(),
    title: meta.title || file.name.replace('.epub', ''),
    author: meta.creator || 'Неизвестный автор',
    coverBase64: coverUrl || undefined,
    chapters,
    assets: {}, 
    aiCache: { characters: {}, recaps: {} },
  };
}

// ==========================================
// ПАРСЕР 2: FB2 (FictionBook - чистый XML)
// ==========================================
async function parseFb2(file: File): Promise<UnifiedBook> {
  const text = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");

  // Парсим метаданные
  const title = xml.querySelector('title-info book-title')?.textContent || file.name;
  const authorFirst = xml.querySelector('title-info author first-name')?.textContent || '';
  const authorLast = xml.querySelector('title-info author last-name')?.textContent || '';
  
  // Парсим обложку (base64)
  const coverImageId = xml.querySelector('coverpage image')?.getAttribute('l:href')?.replace('#', '');
  let coverBase64;
  if (coverImageId) {
    const binary = xml.querySelector(`binary[id="${coverImageId}"]`)?.textContent;
    if (binary) coverBase64 = `data:image/jpeg;base64,${binary}`;
  }

  // Парсим главы
  const chapters: UnifiedChapter[] = [];
  const sections = xml.querySelectorAll('body > section');
  
  sections.forEach((section, index) => {
    // Конвертируем тэги FB2 <p> в HTML <p>
    const paragraphs = Array.from(section.querySelectorAll('p'))
      .map(p => `<p>${p.textContent}</p>`)
      .join('');
    
    const titleNode = section.querySelector('title');
    const chapterTitle = titleNode ? titleNode.textContent || `Глава ${index + 1}` : `Глава ${index + 1}`;
    const wordCount = paragraphs.split(/\s+/).filter(w => w.length > 0).length;

    if (paragraphs.trim().length > 0) {
      chapters.push({
        id: `fb2-chap-${index}`,
        title: chapterTitle,
        content: paragraphs,
        wordCount,
      });
    }
  });

  return {
    id: crypto.randomUUID(),
    title,
    author: `${authorFirst} ${authorLast}`.trim() || 'Неизвестный автор',
    coverBase64,
    chapters: chapters.length > 0 ? chapters : [{ id: '1', title: 'Глава 1', content: '<p>Пустая книга</p>', wordCount: 0 }],
    assets: {},
    aiCache: { characters: {}, recaps: {} }
  };
}

// ==========================================
// ПАРСЕР 3: TXT (Простой текст)
// ==========================================
async function parseTxt(file: File): Promise<UnifiedBook> {
  const text = await file.text();
  // Разбиваем текст на куски (условные главы по 500 абзацев), чтобы браузер не умер от огромного DOM
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  
  const chunkSize = 500; 
  const chapters: UnifiedChapter[] = [];
  
  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    const chunk = paragraphs.slice(i, i + chunkSize);
    const content = chunk.map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
    const wordCount = chunk.join(' ').split(/\s+/).length;

    chapters.push({
      id: `txt-chap-${Math.floor(i/chunkSize)}`,
      title: `Часть ${Math.floor(i/chunkSize) + 1}`,
      content,
      wordCount,
    });
  }

  return {
    id: crypto.randomUUID(),
    title: file.name.replace('.txt', ''),
    author: 'Неизвестный автор',
    chapters,
    assets: {},
    aiCache: { characters: {}, recaps: {} }
  };
}
