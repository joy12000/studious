
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
// import { YoutubeTranscript } from 'youtube-transcript'; // 🚀 사용자 요청에 따라 비활성화
import type { SummaryData, TaggingData } from '../src/lib/types';

// ... (프롬프트 템플릿들은 설명을 위해 생략) ...
const SUMMARY_PROMPT_TEMPLATE = `...`;
const TAGGING_PROMPT_TEMPLATE = `...`;

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

    /* 🚀 사용자 요청에 따라 대본 추출 로직 비활성화
    // --- 1. 유튜브 스크립트 추출 ---
    let videoTranscript = "";
    try {
      const videoId = getYoutubeVideoId(youtubeUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      videoTranscript = transcript.map(item => item.text).join(' ');
    } catch (e) {
      console.error('Failed to fetch transcript:', e);
      return res.status(400).json({ error: 'Failed to get video transcript. Check if the URL is correct and has transcripts enabled.' });
    }
    
    if (!videoTranscript) {
        return res.status(400).json({ error: 'Transcript is empty or unavailable.' });
    }
    */

    // Gemini API 클라이언트 초기화
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // --- 2. 1차 호출: 영상 내용 요약 (URL을 직접 전달하는 실험적 방식) ---
    const summaryPromptWithUrl = `이 유튜브 영상 링크를 보고 내용을 요약해줘: ${youtubeUrl}. 응답은 반드시 다음 JSON 형식이어야 해: { "summary": "요약문", "key_insights": ["인사이트1"] }`;
    
    const summaryResult = await model.generateContent(summaryPromptWithUrl);
    const summaryResponseText = summaryResult.response.text().replace(/```json|```/g, '').trim();
    const summaryData: SummaryData = JSON.parse(summaryResponseText);
    
    // --- 3. 2차 호출: 제목 및 태그 생성 ---
    const taggingPrompt = TAGGING_PROMPT_TEMPLATE.replace('$(cat -)', summaryData.summary);
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
