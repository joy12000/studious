// /api/summarize-youtube.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SummaryData, TaggingData } from '../../src/lib/types';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

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

// --- 헬퍼 함수: yt-dlp 실행하여 자막 추출 (기존과 동일) ---
async function getTranscriptWithYtDlp(youtubeUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytDlpPath = process.env.VERCEL
      ? path.join(process.cwd(), 'bin', 'yt-dlp')
      : 'yt-dlp';
    const ytdlpCookieString = process.env.YTDLP_COOKIE_STRING;
    const proxyUrl = process.env.PROXY_URL;
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const videoOutputPath = path.join(os.tmpdir(), uniqueId);
    const subtitlePath = `${videoOutputPath}.ko.vtt`;
    let cookieFilePath: string | null = null;

    const args = [
      '--no-check-certificate',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      '--cache-dir', '/tmp/ytdlp-cache'
    ];

    if (ytdlpCookieString) {
      cookieFilePath = path.join(os.tmpdir(), `cookies_${uniqueId}.txt`);
      try {
        fs.writeFileSync(cookieFilePath, ytdlpCookieString);
        args.push('--cookies', cookieFilePath);
      } catch (err) {
        return reject(new Error(`Failed to write cookie file: ${(err as Error).message}`));
      }
    }

    if (proxyUrl) {
      args.push('--proxy', proxyUrl);
    }

    args.push(
        '--write-auto-sub', '--sub-lang', 'ko', '--skip-download', '--sub-format', 'vtt',
        '-o', videoOutputPath, youtubeUrl
    );

    execFile(ytDlpPath, args, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
      const cleanup = () => {
        if (cookieFilePath) fs.unlink(cookieFilePath, (err) => { if (err) console.error('Failed to delete temp cookie file:', err); });
        fs.unlink(subtitlePath, (err) => { if (err && err.code !== 'ENOENT') console.error('Failed to delete temp subtitle file:', err); });
      };

      if (error) {
        console.error('yt-dlp stderr:', stderr);
        cleanup();
        return reject(new Error(`yt-dlp execution failed: ${error.message}`));
      }
      
      fs.readFile(subtitlePath, 'utf-8', (readErr, vttContent) => {
        cleanup();
        if (readErr) return reject(new Error(`Failed to read subtitle file: ${readErr.message}`));
        const transcript = vttContent.split('\n').filter(line => !line.startsWith('WEBVTT') && !/-->/.test(line) && line.trim() !== '').map(line => line.trim()).join(' ');
        if (!transcript && stderr.includes('subtitles not available')) return reject(new Error('Subtitles not available for this video in the requested language.'));
        resolve(transcript);
      });
    });
  });
}

// 🚀 Gemini 응답을 파싱하기 위한 헬퍼 함수
function cleanAndParseJson(rawText: string): any {
  const cleanedText = rawText.replace(/^```json\n/, '').replace(/\n```$/, '');
  return JSON.parse(cleanedText);
}

// --- 메인 핸들러 (SSE 지원, GET 요청 처리) ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendProgress = (status: string, data?: any) => {
    res.write(`data: ${JSON.stringify({ status, ...data })}\n\n`);
  };

  const sendError = (message: string) => {
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  };

  try {
    const youtubeUrl = req.query.youtubeUrl as string;
    if (!youtubeUrl) return sendError('youtubeUrl is required.');

    sendProgress("자막 추출 중...");
    const videoTranscript = await getTranscriptWithYtDlp(youtubeUrl);
    if (!videoTranscript || videoTranscript.trim().length === 0) {
      return sendError('Transcript not found using yt-dlp.');
    }

    sendProgress("영상 내용 요약 중...");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";
    const model = genAI.getGenerativeModel({ model: modelName });
    const summaryPrompt = `${SUMMARY_PROMPT_TEMPLATE}\n\n[영상 스크립트]\n${videoTranscript}`;
    const summaryResult = await model.generateContent(summaryPrompt);
    // 🚀 파싱 전 데이터 정제
    const summaryData: SummaryData = cleanAndParseJson(summaryResult.response.text());

    sendProgress("제목 및 태그 생성 중...");
    const taggingPrompt = TAGGING_PROMPT_TEMPLATE(summaryData.summary);
    const taggingResult = await model.generateContent(taggingPrompt);
    // 🚀 파싱 전 데이터 정제
    const taggingData: TaggingData = cleanAndParseJson(taggingResult.response.text());

    const finalData = { ...summaryData, ...taggingData, sourceUrl: youtubeUrl };

    sendProgress("완료", { payload: finalData });
    res.end();

  } catch (error) {
    console.error("API 함수 처리 중 오류:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendError(`Failed to process request: ${errorMessage}`);
  }
}