import ePub from 'epubjs';
import { UnifiedBook, UnifiedChapter } from '../types';

export async function parseEpubToUnifiedJSON(file: File): Promise<UnifiedBook> {
  const arrayBuffer = await file.arrayBuffer();
  const book = ePub(arrayBuffer);
  await book.ready;
  
  const meta = await book.loaded.metadata;
  const coverUrl = await book.coverUrl(); 
  const chapters: UnifiedChapter[] = [];
  const spine = await book.loaded.spine;
  
  for (let i = 0; i < spine.length; i++) {
    const section = spine.get(i);
    const chapter = await section.load(book.load.bind(book));
    const doc = new DOMParser().parseFromString(chapter, "application/xhtml+xml");
    
    // Удаляем лишние стили из исходного EPUB для сохранения нашего Apple-like дизайна
    doc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => el.removeAttribute('style'));

    const bodyHtml = doc.body.innerHTML;
    const wordCount = (doc.body.textContent || "").split(/\s+/).filter(w => w.length > 0).length;

    chapters.push({
      id: section.idref,
      title: `Глава ${i + 1}`,
      content: bodyHtml,
      wordCount,
    });
  }

  return {
    id: meta.identifier || crypto.randomUUID(),
    title: meta.title || 'Неизвестная книга',
    author: meta.creator || 'Неизвестный автор',
    coverBase64: coverUrl || undefined,
    chapters,
    assets: {}, 
    aiCache: { characters: {}, recaps: {} },
  };
}