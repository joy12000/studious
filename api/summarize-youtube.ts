import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { YoutubeTranscript } from 'youtube-transcript';
import type { SummaryData, TaggingData } from '../src/lib/types';

// --- 프롬프트 템플릿 정의 ---

// 1번 프롬프트: 영상 내용 요약용
const SUMMARY_PROMPT_TEMPLATE = `
당신은 영상 콘텐츠 요약을 전문으로 하는 **요약 전문가**입니다. 제공되는 영상 스크립트를 바탕으로, 다음 요구사항에 맞춰 콘텐츠를 분석하고 구조화된 JSON 형식으로 결과를 반환해주세요.

[요구사항]
1.  **핵심 요약 (summary)**: 영상 전체 내용을 포괄하는 3~4 문단의 상세하고 명확한 요약문을 작성합니다. 각 문단은 영상의 주요 섹션(소개, 본론, 결론 등)을 반영해야 합니다.
2.  **핵심 통찰 (key_insights)**: 시청자가 영상에서 반드시 얻어가야 할 가장 중요한 통찰, 교훈, 또는 팁을 3~5개의 불렛 포인트(bullet points)로 정리합니다. 각 항목은 간결하고 명확한 문장으로 표현해야 합니다.

[결과 출력 형식]
결과는 반드시 다음 JSON 구조를 따라야 하며, 다른 텍스트는 포함하지 마세요.

```json
{
  "summary": "영상 전체 내용을 아우르는 3~4 문단의 핵심 요약문",
  "key_insights": [
    "핵심 통찰 1: 영상의 첫 번째 주요 메시지 또는 교훈",
    "핵심 통찰 2: 영상의 두 번째 주요 메시지 또는 팁",
    "핵심 통찰 3: 시청자가 놓치지 말아야 할 가장 중요한 정보"
  ]
}
```
`;

// 2번 프롬프트: 제목 및 태그 생성용
const TAGGING_PROMPT_TEMPLATE = (summaryText: string) => `
당신은 콘텐츠의 핵심 주제를 파악하여 카테고리를 분류하는 **분류 전문가**입니다. 주어진 요약문을 분석하여, 다음 요구사항에 맞춰 콘텐츠를 분류하고 구조화된 JSON 형식으로 결과를 반환해주세요.

[요구사항]
1.  **제목 (title)**: 요약문의 내용을 가장 잘 나타내는, 흥미를 유발하면서도 간결한 제목을 생성합니다. (20자 내외)
2.  **주제 태그 (tag)**: 요약문의 핵심 주제를 가장 잘 나타내는 대표 태그를 딱 하나만 생성합니다. 이 태그는 '생산성', '학습', '기술', '경제', '건강' 등과 같이 콘텐츠를 포괄적으로 분류할 수 있는 단일 키워드여야 합니다.

[요약문]
${summaryText}

[결과 출력 형식]
결과는 반드시 다음 JSON 구조를 따라야 하며, 다른 텍스트는 포함하지 마세요.

```json
{
  "title": "AI가 생성한 영상의 핵심 제목",
  "tag": "AI가 생성한 포괄적 주제 태그"
}
```
`;


// --- 서버리스 함수 핸들러 ---
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { youtubeUrl }: { youtubeUrl: string } = req.body;
    if (!youtubeUrl) {
      return res.status(400).json({ error: 'youtubeUrl is required' });
    }

    // --- 1. 유튜브 스크립트 추출 ---
    let videoTranscript = "";
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(youtubeUrl);
      videoTranscript = transcript.map(item => item.text).join(' ');
    } catch (e) {
      console.error('Failed to fetch transcript:', e);
      return res.status(400).json({ error: 'Failed to get video transcript. Check if the URL is correct and has transcripts enabled.' });
    }
    
    if (!videoTranscript) {
        return res.status(400).json({ error: 'Transcript is empty or unavailable.' });
    }

    // Gemini API 클라이언트 초기화
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // --- 2. 1차 호출: 영상 내용 요약 ---
    const summaryPromptWithContent = `${SUMMARY_PROMPT_TEMPLATE}\n\n[영상 스크립트]\n${videoTranscript}`;
    const summaryResult = await model.generateContent(summaryPromptWithContent);
    const summaryResponseText = summaryResult.response.text().replace(/```json|```/g, '').trim();
    const summaryData: SummaryData = JSON.parse(summaryResponseText);
    
    // --- 3. 2차 호출: 제목 및 태그 생성 ---
    const taggingPrompt = TAGGING_PROMPT_TEMPLATE(summaryData.summary);
    const taggingResult = await model.generateContent(taggingPrompt);
    const taggingResponseText = taggingResult.response.text().replace(/```json|```/g, '').trim();
    const taggingData: TaggingData = JSON.parse(taggingResponseText);

    // --- 4. 데이터 통합 및 최종 응답 ---
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
