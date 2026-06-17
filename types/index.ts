export type Theme = 'light' | 'sepia' | 'oled';
export type AmbientSound = 'none' | 'rain' | 'fireplace' | 'cafe';

export interface UnifiedChapter {
  id: string;
  title: string;
  content: string; 
  wordCount: number;
}

export interface UnifiedBook {
  id: string;
  title: string;
  author: string;
  coverBase64?: string;
  chapters: UnifiedChapter[];
  assets: Record<string, string>;
  aiCache: {
    characters: Record<string, string>;
    recaps: Record<string, string>;
  };
}

export interface ReaderSettings {
  theme: Theme;
  fontSize: number; 
  lineHeight: number;
  bionicReading: boolean;
  dropCaps: boolean;
  ambientSound: AmbientSound;
}

export interface ReaderState {
  book: UnifiedBook | null;
  currentChapterIndex: number;
  progressPercent: number;
  settings: ReaderSettings;
  wpm: number;
  readStartTime: number | null;
  sessionWordsRead: number;
  isUiVisible: boolean;
  activeCharacterXRay: { name: string; info: string } | null;
  
  setBook: (book: UnifiedBook) => void;
  setChapter: (index: number) => void;
  toggleUi: () => void;
  updateSettings: (newSettings: Partial<ReaderSettings>) => void;
  setCharacterXRay: (data: { name: string; info: string } | null) => void;
  updateReadingStats: (wordsRead: number) => void;
  saveCharacterToCache: (name: string, info: string) => void;
  saveRecapToCache: (chapterId: string, recap: string) => void;
}