// /api/summarize-youtube.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SummaryData, TaggingData } from '../../src/lib/types';
import { YoutubeTranscript } from 'youtube-transcript';

// --- 프롬프트 템플릿 (기존과 동일) ---
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

// Gemini 응답을 파싱하기 위한 헬퍼 함수
function cleanAndParseJson<T>(rawText: string): T {
  const cleanedText = rawText.replace(/^```json\n/, '').replace(/\n```$/, '');
  return JSON.parse(cleanedText) as T;
}

// --- 메인 핸들러 (SSE + 자동 모델 선택) ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendProgress = (status: string, data?: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ status, ...data })}\n\n`);
  };

  const sendError = (message: string) => {
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  };

  try {
    const youtubeUrl = req.query.youtubeUrl as string;
    if (!youtubeUrl) return sendError('youtubeUrl is required.');

    // URL에서 비디오 ID 추출
    let videoId = null;
    try {
      const url = new URL(youtubeUrl);
      if (url.hostname === 'youtu.be') {
        videoId = url.pathname.substring(1);
      } else if (url.hostname.includes('youtube.com')) {
        videoId = url.searchParams.get('v');
      }
    } catch {
        return sendError('유효하지 않은 YouTube URL입니다.');
    }

    if (!videoId) {
      return sendError('YouTube URL에서 비디오 ID를 추출할 수 없습니다.');
    }
    
    sendProgress("자막 추출 중...");

    // Scraper API를 사용하여 자막 추출
    const scraperApiKey = process.env.SCRAPER_API_KEY;
    if (!scraperApiKey) {
      return sendError('SCRAPER_API_KEY가 설정되지 않았습니다.');
    }

    let videoTranscript = '';
    try {
      const scrapeUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(youtubeUrl)}`;
      const pageResponse = await fetch(scrapeUrl);
      if (!pageResponse.ok) throw new Error(`Scraper API page fetch failed with status: ${pageResponse.status}`);
      
      const pageHtml = await pageResponse.text();
      
      const playerResponseRegex = /var ytInitialPlayerResponse = ({.*?});/;
      const match = pageHtml.match(playerResponseRegex);
      if (!match || !match[1]) throw new Error('Could not find player response data in page HTML.');

      const playerResponse = JSON.parse(match[1]);
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionTracks || captionTracks.length === 0) throw new Error('Video does not have captions.');

      const koreanTrack = captionTracks.find(track => track.languageCode === 'ko' && track.kind !== 'asr') || captionTracks.find(track => track.languageCode === 'ko');
      if (!koreanTrack || !koreanTrack.baseUrl) throw new Error('Could not find Korean captions.');

      const transcriptUrl = koreanTrack.baseUrl;
      const transcriptResponse = await fetch(transcriptUrl);
      if (!transcriptResponse.ok) throw new Error('Failed to fetch the transcript file.');
      
      const transcriptXml = await transcriptResponse.text();
      
      videoTranscript = transcriptXml
        .match(/<text.*?>(.*?)<\/text>/g)
        ?.map(tag => tag.replace(/<[^>]+>/g, ''))
        .join(' ')
        ?.replace(/&amp;#39;/g, "'")
        ?.replace(/&amp;quot;/g, '"')
        ?.replace(/&#39;/g, "'")
        ?.replace(/&quot;/g, '"')
        || '';

    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return sendError(`자막 추출 실패: ${message}`);
    }

    if (!videoTranscript || videoTranscript.trim().length === 0) {
      return sendError('자막을 찾을 수 없습니다. 다른 영상을 시도해주세요.');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!); 

    // 토큰 수에 따라 동적으로 모델 선택 및 알림
    const tokenCount = Math.round(videoTranscript.length / 2.5);
    let modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";
    let usingProModel = false;

    if (tokenCount <= 250000) {
      modelName = "gemini-2.5-pro";
      usingProModel = true;
    }
    
    if (usingProModel) {
        sendProgress(`토큰(약 ${tokenCount.toLocaleString()}개)이 많아 Gemini 2.5 Pro로 요약합니다.`);
    } else {
        sendProgress(`기본 모델로 요약을 시작합니다.`);
    }

    const model = genAI.getGenerativeModel({ model: modelName });

    const summaryPrompt = `${SUMMARY_PROMPT_TEMPLATE}\n\n[영상 스크립트]\n${videoTranscript}`;
    const summaryResult = await model.generateContent(summaryPrompt);
    const summaryData = cleanAndParseJson<SummaryData>(summaryResult.response.text());

    sendProgress("제목 및 태그 생성 중...");
    const taggingModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash" });
    const taggingPrompt = TAGGING_PROMPT_TEMPLATE(summaryData.summary);
    const taggingResult = await taggingModel.generateContent(taggingPrompt);
    const taggingData = cleanAndParseJson<TaggingData>(taggingResult.response.text());

    const finalData = { ...summaryData, ...taggingData, sourceUrl: youtubeUrl };

    sendProgress("완료", { payload: finalData });
    res.end();

  } catch (error) {
    console.error("API 함수 처리 중 오류:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // 🚀 에러 메시지를 좀 더 사용자 친화적으로 변경
    if (errorMessage.includes('Transcript not available') || (error as any)?.cause?.toString()?.includes('404') || errorMessage.includes('Could not get transcript')) {
        sendError('이 영상의 한국어 자막을 자동으로 생성할 수 없거나, 자막 기능이 비활성화된 영상입니다.');
    } else {
        sendError(`요청 처리 중 오류가 발생했습니다: ${errorMessage}`);
    }
  }
}