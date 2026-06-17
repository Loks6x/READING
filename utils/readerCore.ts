import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

export async function getCharacterXRay(name: string, chapterContext: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Ты встроенный AI-помощник в премиальной читалке книг. 
    Пользователь выделил имя "${name}". 
    Основываясь на тексте главы: "${chapterContext.substring(0, 3000)}...", 
    Напиши короткую справку об этом персонаже в 2-3 предложениях. 
    Стиль: минималистичный, литературный. Без приветствий.`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return "Не удалось загрузить информацию о персонаже. Проверьте интернет-соединение.";
  }
}

export async function generateSmartRecap(chapterText: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Составь краткое содержание (recap) следующего текста главы книги. 
    Начни с фразы "Ранее в книге:". Уложись в 3-4 емких предложения. Текст: "${chapterText.substring(0, 5000)}..."`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini Recap Error:", error);
    return "Не удалось сгенерировать содержание.";
  }
}

export function applyBionicReading(htmlString: string): string {
  if (typeof window === 'undefined') return htmlString;
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
  const nodesToProcess: Text[] = [];
  
  let currentNode;
  while ((currentNode = walker.nextNode())) nodesToProcess.push(currentNode as Text);

  nodesToProcess.forEach(node => {
    const text = node.nodeValue;
    if (!text || text.trim() === '') return;
    const span = document.createElement('span');
    span.innerHTML = text.split(/(\s+)/).map(word => {
      if (word.trim() === '') return word;
      if (word.length <= 2) return `<b class="font-bold opacity-90">${word}</b>`;
      const boldLen = Math.ceil(word.length * 0.4);
      return `<b class="font-bold opacity-90">${word.slice(0, boldLen)}</b>${word.slice(boldLen)}`;
    }).join('');
    node.parentNode?.replaceChild(span, node);
  });
  return doc.body.innerHTML;
}

export function speakText(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/<[^>]+>/g, '');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}