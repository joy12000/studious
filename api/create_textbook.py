from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
import cgi
from PIL import Image
import io
import traceback
from pdf2image import convert_from_bytes

class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        # API 키 폴백 기능 구현
        api_keys = [
            os.environ.get('GEMINI_API_KEY_PRIMARY'),
            os.environ.get('GEMINI_API_KEY_SECONDARY'),
            os.environ.get('GEMINI_API_KEY') # 기존 키 호환
        ]
        valid_keys = [key for key in api_keys if key]

        if not valid_keys:
            return self.handle_error(ValueError("설정된 Gemini API 키가 없습니다."), "API 키 설정 오류", 500)

        last_error = None

        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
            )
            learning_materials = form.getlist('files')
            
            subject_name = form.getvalue('subject', '[과목명]')
            week_info = form.getvalue('week', '[N주차/18주차]')
            material_types = form.getvalue('materialTypes', '[PPT/PDF/텍스트 등]')

            # 전문가용 프롬프트 적용
            prompt = f"""
            당신은 인지과학과 교육심리학 전문가입니다. 첨부된 강의 자료를 분석해서, 교수 수업 없이도 스스로 이해하고 숙달할 수 있는 학습 자료를 제작해주세요.

            📋 분석할 자료 정보:
            과목: {subject_name}
            주차: {week_info}
            제공 자료: {material_types}

            🧠 인지과학 원리 적용 필수사항:
            - 인지부하 최적화: 한 번에 처리할 정보량을 7±2개 덩어리로 제한하고, 불필요한 정보는 제거
            - 인출 연습 강화: 단순 재독보다 능동적 회상이 학습효과 50% 향상
            - 간격 반복 적용: 학습→1일 후→3일 후→1주 후 복습 스케줄 제안
            - 교차 연습 도입: 비슷한 문제를 섞어서 전략 선택 능력 향상

            📚 결과물 구조 (Gagne의 9단계 + 백워드 설계):
            1단계: 주의집중 & 학습목표
            🎯 핵심 질문: 이번 주에 해결할 핵심 문제 1개
            📍 구체적 목표: Bloom 분류에 따른 행동동사로 측정 가능한 학습목표 3-5개
            🔗 연결고리: 이전 주차 내용과의 연관성

            2단계: 선행지식 활성화
            📝 사전 점검: 필요한 선행지식 간단 퀴즈 3문항
            🔄 기억 환기: 관련 개념/공식 요약 정리

            3단계: 핵심 내용 구조화
            각 주요 개념마다:
            - 정의: 한 문장으로 명확히
            - 시각화: 도표/그림으로 관계 설명 (텍스트 기반으로 표현)
            - 구체적 예시: 실생활 연결 사례
            - 주의사항: 자주 하는 실수와 방지법

            4단계: 단계별 예제 (Worked Examples)
            문제 유형별로:
            - 모범 풀이: 각 단계의 사고과정까지 상세 설명
            - 변형 문제: 비슷하지만 약간 다른 문제로 전이 연습
            - 자기설명: "왜 이렇게 푸는가?" 유도 질문

            5단계: 능동 연습 설계
            - 기초 연습: 개념 확인 문제 5개
            - 응용 연습: 실제 상황 문제 3개
            - 교차 연습: 이전 주차 내용과 섞인 문제 2개
            - 자가 채점: 즉시 피드백과 해설

            6단계: 요약 및 연결
            - 핵심 요약: 3-5개 bullet point로 정리
            - 공식/개념 카드: 암기용 요약
            - 다음 주 예고: 연속성 확보

            7단계: 복습 스케줄링
            - 즉시 복습: 학습 직후 5분 재정리
            - 1일 후: 핵심 개념 인출 퀴즈
            - 3일 후: 응용 문제 재도전
            - 1주 후: 종합 점검

            🎨 표현 방식 최적화:
            - 이중 채널 활용: 시각+텍스트 정보 동시 제공
            - 신호 강화: 중요한 부분은 `**굵은 글씨**`로 강조
            - 중복 제거: 같은 정보를 다른 형태로 반복하지 않음
            
            ✅ 품질 체크리스트:
            - 학습목표가 구체적이고 측정 가능한가?
            - 각 개념마다 예제+연습+피드백이 있는가?
            - 인지부하가 적절히 분산되었는가?
            - 이전/다음 주차와 연결점이 명확한가?
            - 자기주도 학습이 가능한 구조인가?

            출력 형식:
            스마트폰에서 읽기 좋게 섹션별로 나누어 제시하되, 각 섹션은 5분 이내에 완독 가능한 분량으로 구성해주세요.
            """
            
            request_contents = [prompt]
            text_materials = []

            for material_file in learning_materials:
                # ✨ [핵심 오류 수정] getattr를 사용하여 어떤 형태의 파일 객체든 안전하게 처리
                file_content = getattr(material_file, 'value', material_file)
                file_type = getattr(material_file, 'type', 'application/octet-stream')
                filename = getattr(material_file, 'filename', 'unknown')

                if not isinstance(file_content, bytes):
                    continue

                if file_type == 'application/pdf':
                    try:
                        images = convert_from_bytes(file_content)
                        if images:
                            request_contents.extend(images)
                    except Exception as e:
                        if "Poppler" in str(e):
                            raise ValueError("PDF 처리를 위해 Poppler를 설치해야 합니다.")
                        else:
                            raise e
                elif 'image' in file_type:
                    try:
                        img = Image.open(io.BytesIO(file_content))
                        request_contents.append(img)
                    except Exception as img_err:
                        print(f"이미지 파일 '{filename}' 처리 중 오류: {img_err}")
                else:
                    try:
                        text_content = file_content.decode('utf-8', errors='ignore')
                        text_materials.append(text_content)
                    except Exception as txt_err:
                        print(f"텍스트 파일 '{filename}' 처리 중 오류: {txt_err}")

            if text_materials:
                request_contents.append("\n--- 학습 자료 (텍스트) ---\n" + "\n\n".join(text_materials))
                
            for i, api_key in enumerate(valid_keys):
                try:
                    print(f"INFO: Generating textbook with gemini-1.5-pro-latest using API key #{i + 1}...")
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel('gemini-2.5-pro')
                    
                    response = model.generate_content(request_contents)
                    
                    print(f"DEBUG: Type of response.text: {type(response.text)}")
                    print(f"DEBUG: Snippet of response.text: {response.text[:200]}") # 처음 200자 출력
                    print(f"DEBUG: Encoding check (should be utf-8): {response.text.encode('utf-8')[:200]}")

                    json_response = {"textbook": response.text}

                    self.send_response(200)
                    self.send_header('Content-type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps(json_response, ensure_ascii=False).encode('utf-8'))
                    return # 성공 시 함수 종료

                except Exception as e:
                    last_error = e
                    print(f"WARN: API key #{i + 1} failed. Fallback to next key. Error: {e}")
                    continue

            raise ConnectionError("모든 Gemini API 키로 요청에 실패했습니다.") from last_error

        except Exception as e:
            self.handle_error(e, "참고서 생성 중 오류 발생")

    def handle_error(self, e, message="오류 발생", status_code=500):
        print(f"Error processing request: {message}")
        traceback.print_exc()
        if not hasattr(self, '_headers_sent') or not self._headers_sent:
            try:
                self.send_response(status_code)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                error_details = {
                    "error": message,
                    "details": str(e),
                    "traceback": traceback.format_exc()
                }
                self.wfile.write(json.dumps(error_details).encode('utf-8'))
            except Exception as write_error:
                print(f"FATAL: 오류 응답을 보내는 중 추가 오류 발생: {write_error}")
