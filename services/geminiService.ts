
import { GoogleGenAI, Type } from "@google/genai";
import { Grade, HanjaData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fallback data in case of API failure or strictly for demo if key is missing/invalid
const FALLBACK_HANJA: HanjaData[] = [
  { id: '1', char: '天', hun: '하늘', eum: '천', hunEum: '하늘 천' },
  { id: '2', char: '地', hun: '땅', eum: '지', hunEum: '땅 지' },
  { id: '3', char: '玄', hun: '검을', eum: '현', hunEum: '검을 현' },
  { id: '4', char: '黄', hun: '누를', eum: '황', hunEum: '누를 황' },
  { id: '5', char: '宇', hun: '집', eum: '우', hunEum: '집 우' },
  { id: '6', char: '宙', hun: '집', eum: '주', hunEum: '집 주' },
  { id: '7', char: '洪', hun: '넓을', eum: '홍', hunEum: '넓을 홍' },
  { id: '8', char: '荒', hun: '거칠', eum: '황', hunEum: '거칠 황' },
  { id: '9', char: '日', hun: '날', eum: '일', hunEum: '날 일' },
  { id: '10', char: '月', hun: '달', eum: '월', hunEum: '달 월' },
  { id: '11', char: '盈', hun: '찰', eum: '영', hunEum: '찰 영' },
  { id: '12', char: '昃', hun: '기울', eum: '측', hunEum: '기울 측' },
  { id: '13', char: '辰', hun: '별', eum: '진', hunEum: '별 진' },
  { id: '14', char: '宿', hun: '잘', eum: '수', hunEum: '잘 수' },
  { id: '15', char: '列', hun: '벌일', eum: '열', hunEum: '벌일 열' },
  { id: '16', char: '張', hun: '베풀', eum: '장', hunEum: '베풀 장' },
  { id: '17', char: '寒', hun: '찰', eum: '한', hunEum: '찰 한' },
  { id: '18', char: '來', hun: '올', eum: '래', hunEum: '올 래' },
  { id: '19', char: '暑', hun: '더울', eum: '서', hunEum: '더울 서' },
  { id: '20', char: '往', hun: '갈', eum: '왕', hunEum: '갈 왕' },
  { id: '21', char: '秋', hun: '가을', eum: '추', hunEum: '가을 추' },
  { id: '22', char: '收', hun: '거둘', eum: '수', hunEum: '거둘 수' },
  { id: '23', char: '冬', hun: '겨울', eum: '동', hunEum: '겨울 동' },
  { id: '24', char: '藏', hun: '감출', eum: '장', hunEum: '감출 장' },
  { id: '25', char: '閏', hun: '윤달', eum: '윤', hunEum: '윤달 윤' },
  { id: '26', char: '餘', hun: '남을', eum: '여', hunEum: '남을 여' },
  { id: '27', char: '成', hun: '이룰', eum: '성', hunEum: '이룰 성' },
  { id: '28', char: '歲', hun: '해', eum: '세', hunEum: '해 세' },
  { id: '29', char: '律', hun: '법', eum: '률', hunEum: '법 률' },
  { id: '30', char: '呂', hun: '법칙', eum: '려', hunEum: '법칙 려' },
];

export const fetchHanjaData = async (grade: Grade, count: number = 30): Promise<HanjaData[]> => {
  if (!process.env.API_KEY) {
    console.warn("API Key missing, using fallback data.");
    return FALLBACK_HANJA.slice(0, count);
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a list of ${count} distinct Hanja (Chinese characters) suitable for Korean Hanja Grade ${grade} (한국 어문회 ${grade} 배정한자). 
      Return JSON format. 
      IMPORTANT rules for fields:
      - 'char': The Hanja character (e.g. '天')
      - 'hun': The meaning in Korean ONLY. Do NOT include the sound. (e.g. '하늘' is correct. '하늘 천' is WRONG).
      - 'eum': The sound in Korean ONLY. (e.g. '천').`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              char: { type: Type.STRING },
              hun: { type: Type.STRING },
              eum: { type: Type.STRING },
            },
            required: ['char', 'hun', 'eum'],
          },
        },
      },
    });

    const rawData = JSON.parse(response.text || "[]");
    
    // Map to our internal structure
    return rawData.map((item: any, index: number) => ({
      id: `gemini-${Date.now()}-${index}`,
      char: item.char,
      hun: item.hun,
      eum: item.eum,
      hunEum: `${item.hun} ${item.eum}`
    }));

  } catch (error) {
    console.error("Gemini API Error:", error);
    return FALLBACK_HANJA.slice(0, count);
  }
};
