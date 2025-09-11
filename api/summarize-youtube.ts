// /api/summarize-youtube.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SummaryData, TaggingData, Note } from '../src/lib/types';

// --- 프롬프트 템플릿 ---
const SUMMARY_PROMPT_TEMPLATE = `
당신은 영상 콘텐츠 요약을 전문으로 하는 요약 전문가입니다. 
사용자가 제공한 유튜브 영상의 전사 내용을 꼼꼼히 분석한 뒤, 영상의 핵심 메시지와 중요한 인사이트를 빠짐없이 담아 체계적으로 요약해주세요.

- **요약 스타일:** 전문 요약가로서 객관적이고 정확한 어조로 작성합니다.
- **특히 강조할 점:** 영상에서 강조된 통찰이나 시사점이 있다면 이를 요약에 반드시 포함합니다.

[결과 출력 형식]
아래와 같은 JSON 형식에 맞춰 한국어로 결과를 반환해주세요.
'''json
{
  "summary": "영상 전체 내용을 아우르는 3~4 문단의 핵심 요약문",
  "key_insights": [
    "영상이 강조하는 가장 중요한 통찰 또는 시사점 1",
    "영상이 강조하는 가장 중요한 통찰 또는 시사점 2",
    "그 외 주목할 만한 핵심 정보나 주장"
  ]
}
'''
`;
const TAGGING_PROMPT_TEMPLATE = (summaryText: string) => `
당신은 콘텐츠의 핵심 주제를 파악하여 카테고리를 분류하는 분류 전문가입니다.
제공된 요약문을 기반으로, 영상의 내용을 가장 잘 나타내는 '제목'과 '주제 태그'를 하나씩 생성해주세요.

[규칙]
1. 제목: 요약문의 핵심 내용을 담아 간결하게 생성합니다.
2. 주제 태그: 반드시 아래 예시와 같이 매우 포괄적이고 일반적인 단 하나의 단어로 생성해야 합니다. (예시: IT, 경제, 과학, 역사, 자기계발, 건강, 문화, 시사, 예능, 교육)

[요약문]
${summaryText}

[결과 출력 형식]
결과는 반드시 아래 JSON 형식으로 반환해주세요.
'''json
{
  "title": "AI가 생성한 영상 제목",
  "tag": "AI가 생성한 포괄적 주제 태그"
}
'''
`;

// --- 외부 API 호출을 위한 헬퍼 함수 ---
async function getTranscriptFromScrapingBee(youtubeUrl: string): Promise<string> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    throw new Error('ScrapingBee API key is not configured.');
  }

  // ScrapingBee의 유튜브 자막 추출 전용 파라미터 설정
  const params = new URLSearchParams({
    api_key: apiKey,
    url: youtubeUrl,
    extract_rules: JSON.stringify({
      "transcript": {
        "selector": "ytd-transcript-segment-renderer span", // 유튜브 자막 텍스트 선택자
        "type": "list",
        "output": "text"
      }
    }),
    custom_google: 'false', // 미국 구글 검색 결과 사용 안 함
    render_js: 'true', // 자바스크립트 렌더링 활성화 (필수)
  });

  const response = await fetch(`https://app.scrapingbee.com/api/v1/?${params.toString()}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ScrapingBee Error:', errorText);
    throw new Error(`ScrapingBee API failed with status: ${response.status}`);
  }

  const result = await response.json();
  
  // API가 반환한 자막 리스트를 하나의 문자열로 합칩니다.
  if (result.transcript && Array.isArray(result.transcript)) {
    return result.transcript.join(' ');
  }

  return ''; // 자막이 없는 경우 빈 문자열 반환
}


// --- 메인 서버리스 함수 핸들러 ---
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { youtubeUrl } = req.body;
    if (!youtubeUrl) {
      return res.status(400).json({ error: 'youtubeUrl is required.' });
    }

    // --- 🚀 ScrapingBee를 이용해 자막 데이터 가져오기 ---
    const videoTranscript = await getTranscriptFromScrapingBee(youtubeUrl);

    if (!videoTranscript || videoTranscript.trim().length === 0) {
      return res.status(404).json({ error: 'Transcript not found for this video.' });
    }
    
    // --- Gemini API 호출 및 데이터 처리 (기존 로직과 동일) ---
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 1차 호출
    const summaryPrompt = `${SUMMARY_PROMPT_TEMPLATE}\n\n[영상 스크립트]\n${videoTranscript}`;
    const summaryResult = await model.generateContent(summaryPrompt);
    const summaryData: SummaryData = JSON.parse(summaryResult.response.text());

    // 2차 호출
    const taggingPrompt = TAGGING_PROMPT_TEMPLATE(summaryData.summary);
    const taggingResult = await model.generateContent(taggingPrompt);
    const taggingData: TaggingData = JSON.parse(taggingResult.response.text());

    // 데이터 통합 및 응답
    const finalData = {
      ...summaryData,
      ...taggingData,
      sourceUrl: youtubeUrl,
    };

    return res.status(200).json(finalData);

  } catch (error) {
    console.error("API 함수 처리 중 오류:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Failed to process request.', details: errorMessage });
  }
}
