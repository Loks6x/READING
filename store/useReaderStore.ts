import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import localforage from 'localforage';
import { ReaderState } from '../types';

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => (await localforage.getItem(name)) || null,
  setItem: async (name: string, value: string): Promise<void> => await localforage.setItem(name, value),
  removeItem: async (name: string): Promise<void> => await localforage.removeItem(name),
};

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      book: null,
      currentChapterIndex: 0,
      progressPercent: 0,
      wpm: 250,
      readStartTime: null,
      sessionWordsRead: 0,
      isUiVisible: false,
      activeCharacterXRay: null,

      settings: {
        theme: 'oled',
        fontSize: 1.125,
        lineHeight: 1.6,
        bionicReading: false,
        dropCaps: true,
        ambientSound: 'none',
      },

      setBook: (book) => set({ book, currentChapterIndex: 0, progressPercent: 0, readStartTime: Date.now() }),
      
      setChapter: (index) => set((state) => {
        if (!state.book) return state;
        const progress = (index / state.book.chapters.length) * 100;
        return { currentChapterIndex: index, progressPercent: progress, readStartTime: Date.now() };
      }),

      toggleUi: () => set((state) => ({ isUiVisible: !state.isUiVisible })),

      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),

      setCharacterXRay: (data) => set({ activeCharacterXRay: data }),

      updateReadingStats: (wordsRead) => set((state) => {
        if (!state.readStartTime) return { readStartTime: Date.now() };
        const now = Date.now();
        const minutes = (now - state.readStartTime) / 60000;
        if (minutes < 0.5) return state; 
        
        const newTotalWords = state.sessionWordsRead + wordsRead;
        const calculatedWpm = Math.round(newTotalWords / minutes);
        const smoothedWpm = state.wpm ? Math.round((state.wpm * 0.7) + (calculatedWpm * 0.3)) : calculatedWpm;

        return { sessionWordsRead: newTotalWords, wpm: smoothedWpm, readStartTime: now };
      }),

      saveCharacterToCache: (name, info) => set((state) => {
        if (!state.book) return state;
        return {
          book: {
            ...state.book,
            aiCache: { ...state.book.aiCache, characters: { ...state.book.aiCache.characters, [name]: info } }
          }
        };
      }),

      saveRecapToCache: (chapterId, recap) => set((state) => {
        if (!state.book) return state;
        return {
          book: {
            ...state.book,
            aiCache: { ...state.book.aiCache, recaps: { ...state.book.aiCache.recaps, [chapterId]: recap } }
          }
        };
      }),
    }),
    {
      name: 'premium-reader-idb',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);