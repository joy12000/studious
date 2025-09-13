// /api/summarize-youtube.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SummaryData, TaggingData } from '../../src/lib/types';
import { execFile } from 'child_process';
import path from 'path';

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

// --- 헬퍼 함수: yt-dlp 실행하여 자막 추출 ---
async function getTranscriptWithYtDlp(youtubeUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytDlpPath = process.env.VERCEL
      ? path.join(process.cwd(), 'bin', 'yt-dlp')
      : 'yt-dlp';
    const cookiesPath = path.join(process.cwd(), 'bin', 'cookies.txt');
    const proxyUrl = process.env.PROXY_URL;

    // ✨ 요청을 위장하기 위한 고급 옵션 추가
    const args = [
      '--no-check-certificate', // SSL 인증서 확인 비활성화
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', // 최신 크롬 User-Agent
      '--cookie', cookiesPath,  // 쿠키 파일 사용
    ];

    if (proxyUrl) {
      args.push('--proxy', proxyUrl);
    }

    // 나머지 옵션은 동일
    args.push(
        '--write-auto-sub',
        '--sub-lang', 'ko',
        '--skip-download',
        '--sub-format', 'vtt',
        '-o', '-',
        youtubeUrl
    );

    execFile(ytDlpPath, args, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp stderr:', stderr);
        if (stderr.toLowerCase().includes('proxy')) {
          return reject(new Error(`yt-dlp failed, likely due to a proxy error: ${stderr}`));
        }
        return reject(new Error(`yt-dlp execution failed: ${error.message}`));
      }
      
      // ... (자막 파싱 로직은 동일) ...
      const transcript = stdout.split('\n').filter(line => !line.startsWith('WEBVTT') && !/-->/.test(line) && line.trim() !== '').map(line => line.trim()).join(' ');
      
      if (!transcript) {
        // 자막이 없는 경우, stderr에 유용한 정보가 있는지 확인
        if (stderr.includes('subtitles not available')) {
          return reject(new Error('Subtitles not available for this video in the requested language.'));
        }
      }
      resolve(transcript);
    });
  });
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

    // --- 🚀 yt-dlp로 자막 데이터 가져오기 ---
    const videoTranscript = await getTranscriptWithYtDlp(youtubeUrl);

    if (!videoTranscript || videoTranscript.trim().length === 0) {
      return res.status(404).json({ error: 'Transcript not found using yt-dlp.' });
    }

    // --- Gemini API 호출 및 데이터 처리 (기존 로직과 동일) ---
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const summaryPrompt = `${SUMMARY_PROMPT_TEMPLATE}\n\n[영상 스크립트]\n${videoTranscript}`;
    const summaryResult = await model.generateContent(summaryPrompt);
    const summaryData: SummaryData = JSON.parse(summaryResult.response.text());

    const taggingPrompt = TAGGING_PROMPT_TEMPLATE(summaryData.summary);
    const taggingResult = await model.generateContent(taggingPrompt);
    const taggingData: TaggingData = JSON.parse(taggingResult.response.text());

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
