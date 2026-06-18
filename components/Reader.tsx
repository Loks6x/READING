'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import { useReaderStore } from '../store/useReaderStore';
import { applyBionicReading, getCharacterXRay, generateSmartRecap, speakText } from '../utils/readerCore';
import { parseEpubToUnifiedJSON } from '../utils/bookImporter';

export default function Reader() {
  const store = useReaderStore();
  const { 
    book, currentChapterIndex, settings, isUiVisible, 
    activeCharacterXRay, toggleUi, setCharacterXRay, 
    updateSettings, setChapter 
  } = store;

  const contentRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [processedHtml, setProcessedHtml] = useState('');
  const [showHandoff, setShowHandoff] = useState(false);
  const [recapMsg, setRecapMsg] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    try {
      const unifiedBook = await parseEpubToUnifiedJSON(file);
      store.setBook(unifiedBook); // Сохраняем в кэш и открываем
    } catch (error) {
      console.error("Ошибка импорта:", error);
      alert("Не удалось загрузить книгу. Убедитесь, что это формат .epub");
    } finally {
      setIsImporting(false);
    }
  };

  // 1. Применение темы
  useEffect(() => {
    document.body.className = `theme-${settings.theme}`;
  }, [settings.theme]);

  // 2. Рендеринг контента + Smart Recap
  useEffect(() => {
    if (!book) return;

    // A. Smart Recap Check (если не читали > 24ч)
    const timeSinceLastRead = Date.now() - (store.readStartTime || Date.now());
    if (timeSinceLastRead > 86400000 && currentChapterIndex > 0) {
      const lastChapterId = book.chapters[currentChapterIndex - 1].id;
      if (book.aiCache.recaps[lastChapterId]) {
        setRecapMsg(book.aiCache.recaps[lastChapterId]);
      } else {
        const lastChapterText = book.chapters[currentChapterIndex - 1].content;
        generateSmartRecap(lastChapterText).then(recap => {
          store.saveRecapToCache(lastChapterId, recap);
          setRecapMsg(recap);
        });
      }
    }

    // B. Рендеринг HTML и Bionic Reading
    const rawHtml = book.chapters[currentChapterIndex].content;
    if (settings.bionicReading) {
      requestAnimationFrame(() => setProcessedHtml(applyBionicReading(rawHtml)));
    } else {
      setProcessedHtml(rawHtml);
    }
    window.scrollTo(0, 0);
  }, [book?.id, currentChapterIndex, settings.bionicReading]);

  // 3. Плеер звуков окружения
  useEffect(() => {
    if (!audioRef.current) return;
    if (settings.ambientSound === 'none') {
      audioRef.current.pause();
    } else {
      audioRef.current.src = `/sounds/${settings.ambientSound}.mp3`;
      audioRef.current.loop = true;
      audioRef.current.play().catch(() => {}); // Игнорируем автоплей блокеры
    }
  }, [settings.ambientSound]);

  // 4. Логика выделения (AI Character X-Ray)
  const handleSelection = async () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 2 && text.length < 30) {
      if (book?.aiCache.characters[text]) {
        setCharacterXRay({ name: text, info: book.aiCache.characters[text] });
        return;
      }
      setCharacterXRay({ name: text, info: "Анализируем контекст..." });
      const context = book?.chapters[currentChapterIndex].content || '';
      const aiInfo = await getCharacterXRay(text, context);
      store.saveCharacterToCache(text, aiInfo);
      setCharacterXRay({ name: text, info: aiInfo });
    }
  };

  // 5. Навигация тапами
  const handleTap = (e: React.MouseEvent) => {
    if (window.getSelection()?.toString().length) return;
    const { clientX } = e;
    const width = window.innerWidth;
    
    if (clientX < width * 0.2 && currentChapterIndex > 0) setChapter(currentChapterIndex - 1);
    else if (clientX > width * 0.8 && book && currentChapterIndex < book.chapters.length - 1) setChapter(currentChapterIndex + 1);
    else toggleUi();
  };

  if (!book) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center theme-${settings.theme} transition-colors duration-500`}>
        <div className="glass-panel p-12 rounded-3xl flex flex-col items-center shadow-2xl max-w-sm w-full mx-4">
          <div className="text-6xl mb-6">📚</div>
          <h1 className="text-2xl font-bold mb-2">Ваша библиотека</h1>
          <p className="text-sm opacity-60 mb-8 text-center">Загрузите книгу в формате EPUB, чтобы начать чтение</p>
          
          <label className="cursor-pointer w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-2xl font-medium transition-all flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95">
            {isImporting ? (
              <span className="animate-pulse">Обработка EPUB...</span>
            ) : (
              <span>+ Выбрать книгу</span>
            )}
            <input 
              type="file" 
              accept=".epub" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={isImporting}
            />
          </label>
        </div>
      </div>
    );
  }

  const handoffUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/sync?data=${btoa(JSON.stringify({ b: book.id, c: currentChapterIndex }))}`
    : '';

  return (
    <div className="relative min-h-screen">
      <audio ref={audioRef} className="hidden" />

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 h-[2px] bg-blue-500 z-40 transition-all duration-300" 
           style={{ width: `${(currentChapterIndex / book.chapters.length) * 100}%` }} />

      {/* Content */}
      <main 
        ref={contentRef} onClick={handleTap} onMouseUp={handleSelection} onTouchEnd={handleSelection}
        className={`max-w-3xl mx-auto px-6 py-20 prose-reader transition-all duration-500 ${settings.dropCaps ? 'drop-caps' : ''}`}
        style={{ fontSize: `${settings.fontSize}rem`, lineHeight: settings.lineHeight }}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      {/* Main UI Overlay */}
      <AnimatePresence>
        {isUiVisible && (
          <>
            <motion.header 
              initial={{ y: '-100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 w-full p-4 glass-panel z-50 flex justify-between items-center"
            >
              <button className="text-sm font-semibold opacity-80">← Библиотека</button>
              <h1 className="text-sm font-medium truncate max-w-[50%]">{book.title}</h1>
              <div className="flex gap-4">
                 <button onClick={() => updateSettings({ theme: settings.theme === 'oled' ? 'light' : 'oled' })}>🌓</button>
                 <button onClick={() => updateSettings({ bionicReading: !settings.bionicReading })}>
                   {settings.bionicReading ? 'BIONIC ON' : 'BIONIC OFF'}
                 </button>
              </div>
            </motion.header>

            <motion.footer
              initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 w-full p-6 glass-panel z-50 flex flex-col gap-4"
            >
              <div className="flex justify-between items-center text-xs opacity-60">
                <span>Глава {currentChapterIndex + 1} из {book.chapters.length}</span>
                <span>{store.wpm} WPM</span>
              </div>
              <div className="flex justify-around items-center border-t border-white/10 pt-4">
                <button onClick={() => speakText(book.chapters[currentChapterIndex].content)} className="text-2xl">🎧</button>
                <select 
                  className="bg-transparent text-sm outline-none" value={settings.ambientSound}
                  onChange={(e) => updateSettings({ ambientSound: e.target.value as any })}
                >
                  <option value="none" className="text-black">Без звука</option>
                  <option value="rain" className="text-black">Дождь</option>
                  <option value="fireplace" className="text-black">Камин</option>
                </select>
                <button onClick={() => setShowHandoff(true)} className="text-sm font-semibold border px-3 py-1 rounded-full">
                  QR Sync
                </button>
              </div>
            </motion.footer>
          </>
        )}
      </AnimatePresence>

      {/* AI X-Ray Modal */}
      <AnimatePresence>
        {activeCharacterXRay && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed bottom-0 left-0 w-full p-6 glass-panel z-[60] rounded-t-3xl shadow-2xl"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                ✨ {activeCharacterXRay.name}
              </h3>
              <button onClick={() => setCharacterXRay(null)} className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center">✕</button>
            </div>
            <p className="text-sm leading-relaxed opacity-90">{activeCharacterXRay.info}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Recap Modal */}
      <AnimatePresence>
        {recapMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
            <div className="glass-panel p-6 rounded-3xl max-w-md w-full text-center shadow-2xl">
               <h2 className="text-xl font-bold mb-4">С возвращением!</h2>
               <p className="text-sm opacity-90 leading-relaxed text-left italic">{recapMsg}</p>
               <button onClick={() => setRecapMsg(null)} className="mt-6 px-6 py-2 bg-blue-500 text-white rounded-full font-medium">Продолжить</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Handoff QR Modal */}
      <AnimatePresence>
        {showHandoff && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setShowHandoff(false)}>
            <div className="bg-white p-8 rounded-3xl flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-black font-bold text-lg">Apple Handoff</h3>
              <p className="text-black/60 text-sm mb-2 text-center">Отсканируй для продолжения чтения</p>
              <QRCodeCanvas value={handoffUrl} size={200} />
              <button onClick={() => setShowHandoff(false)} className="mt-4 text-blue-500 font-medium">Закрыть</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
