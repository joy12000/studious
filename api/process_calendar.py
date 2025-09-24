from flask import Flask, request, jsonify
import os
import google.generativeai as genai
from PIL import Image
import io
from pdf2image import convert_from_bytes, pdfinfo_from_bytes
import traceback
import json
import re # re 모듈 추가

# Vercel은 이 Flask 앱을 자동으로 서버리스 함수로 변환합니다.
app = Flask(__name__)

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def extract_first_json(text: str):
    """Finds and decodes the first valid JSON array block in a string."""
    if not text:
        raise ValueError("Empty response from model.")

    # First, try to find a JSON array within a markdown code block
    match = re.search(r"```json\s*(\[.*?\])\s*```", text, re.DOTALL)
    if match:
        json_str = match.group(1)
    else:
        # If not found, try to find the first and last square bracket for an array
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if not match:
            raise ValueError("No JSON array found in the model's response.")
        json_str = match.group(0)

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to decode JSON: {e} - Response text was: '{text}'")

# ==============================================================================
# FLASK ROUTE
# ==============================================================================

@app.route('/api/process_calendar', methods=['POST'])
def process_calendar_handler():
    print("--- FLASK SCHEDULE PROCESSING START ---")
    # --- Gemini API 키 설정 ---
    api_keys = [
        os.environ.get('GEMINI_API_KEY_PRIMARY'),
        os.environ.get('GEMINI_API_KEY_SECONDARY'),
        os.environ.get('GEMINI_API_KEY_TERTIARY'),
        os.environ.get('GEMINI_API_KEY_QUATERNARY'),
        os.environ.get('GEMINI_API_KEY')
    ]
    valid_keys = [key for key in api_keys if key]
    if not valid_keys:
        print("ERROR: No Gemini API keys found.")
        return jsonify({"error": "설정된 Gemini API 키가 없습니다.", "details": "No Gemini API keys found in environment variables."}), 500

    # --- 파일 처리 ---
    if 'file' not in request.files:
        print("ERROR: No file part in the request.")
        return jsonify({"error": "요청에 파일이 없습니다.", "details": "No file part in the request."}), 400
    
    uploaded_file = request.files['file']
    file_data = uploaded_file.read()
    file_type = uploaded_file.mimetype
    print(f"INFO: Received file '{uploaded_file.filename}' with type '{file_type}'")

    img = None
    try:
        if file_type == 'application/pdf':
            print("INFO: PDF file detected, attempting conversion.")
            try:
                pdfinfo_from_bytes(file_data)
                images = convert_from_bytes(file_data)
                if images:
                    img = images[0]
                    print("INFO: PDF successfully converted to image.")
            except Exception as e:
                if "Poppler" in str(e) or "PDFInfoNotInstalledError" in str(type(e)):
                    print("ERROR: Poppler not installed.")
                    raise ValueError("PDF 처리에 필요한 Poppler 라이브러리를 서버에 설치해야 합니다.")
                else:
                    raise e
        elif 'image' in file_type:
            img = Image.open(io.BytesIO(file_data))
            print("INFO: Image file processed.")
        
        if img is None:
            raise ValueError(f"지원하지 않는 파일 형식이거나 파일 처리 실패: {file_type}")

    except Exception as e:
        print(f"ERROR: File processing failed. {e}")
        traceback.print_exc()
        return jsonify({"error": "파일 처리 중 오류가 발생했습니다.", "details": str(e)}), 500

    # --- Gemini를 위한 프롬프트 ---
    prompt = """이 시간표 이미지에서 과목 이름(subjectName), 시작 시간(startTime), 종료 시간(endTime), 요일(dayOfWeek)을 추출하여 JSON 배열 형식으로 만들어라.

    추출 규칙:
    1. **시간 계산:** 시간표의 세로축은 시간을 나타내며, 각 행(row)은 30분의 간격을 의미한다. 과목이 차지하는 셀의 수직 길이를 바탕으로 시작 시간(startTime)과 종료 시간(endTime)을 정확히 계산해야 한다. 예를 들어, 과목이 2개의 행에 걸쳐 있다면 1시간짜리 수업이다.
    2. **중복 및 분리:** 한 요일의 같은 시간대에 여러 과목이 겹쳐 있거나 나란히 있는 경우, 각 과목을 반드시 별개의 JSON 객체로 분리하여 추출해야 한다.
    3. **출력 형식:**
       - subjectName: 한글 과목명을 그대로 추출한다.
       - startTime, endTime: 'HH:MM' 형식으로 추출한다.
       - dayOfWeek: '월','화','수','목','금','토','일' 중 하나로 표기한다.
    4. **응답 형식:** 다른 설명 없이, 순수한 JSON 배열만을 응답으로 제공해야 한다.
    """

    # --- Gemini API 호출 루프 ---
    last_error = None
    for i, api_key in enumerate(valid_keys):
        try:
            print(f"INFO: API 키 #{i + 1} (으)로 시간표 처리 시도...")
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(os.getenv("GENAI_MODEL", "gemini-2.5-flash")) # Use GENAI_MODEL env var, fallback to flash
            
            response = model.generate_content([prompt, img], request_options={'timeout': 180})
            
            raw_text = response.text
            print(f"INFO: Gemini Raw Response for Calendar: {raw_text[:300]}...")

            json_response = extract_first_json(raw_text)
            print("INFO: Successfully parsed Gemini response.")
            return jsonify(json_response)

        except Exception as e:
            last_error = e
            print(f"WARN: API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
            continue

    # 모든 키가 실패한 경우
    final_error_details = str(last_error) if last_error else "Unknown error."
    print(f"ERROR: All API keys failed. Last error: {final_error_details}")
    return jsonify({"error": "모든 Gemini API 키로 요청에 실패했습니다.", "details": final_error_details}), 500

# Vercel의 엔트리포인트입니다.
# 이 파일은 api/process_calendar.py이므로, 'app' 객체를 찾아서 실행합니다.