import json # json 모듈 추가
import base64
import os
from flask import Flask, request, jsonify # Flask 관련 import는 유지하되, 사용 방식 변경
from supabase import create_client, Client

app = Flask(__name__)

# Supabase 클라이언트 초기화
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.route('/api/add-synced-media', methods=['POST'])
def add_synced_media():
    try:
        # Vercel 환경에서 request 객체가 딕셔너리 형태로 들어올 수 있으므로,
        # Flask의 request 객체와 딕셔너리 형태 모두를 처리할 수 있도록 로직을 추가합니다.
        if isinstance(request, dict): # request가 딕셔너리인 경우 (서버리스 환경)
            event = request # request를 event로 간주
            # Vercel Python 런타임의 경우, body는 base64 인코딩될 수 있습니다.
            if 'body' in event and event.get('isBase64Encoded', False):
                body_data = base64.b64decode(event['body']).decode('utf-8')
            elif 'body' in event:
                body_data = event['body']
            else:
                body_data = None

            if body_data:
                data = json.loads(body_data)
            else:
                return jsonify({"error": "No body data provided in serverless event"}), 400
        else: # Flask의 request 객체인 경우 (로컬 개발 또는 전통적인 Flask 배포)
            data = request.json
            if not data:
                return jsonify({"error": "No JSON data provided"}), 400

        file_data = data.get('file_data')
        file_name = data.get('file_name')
        content_type = data.get('content_type')
        user_id = data.get('user_id')

        if not all([file_data, file_name, content_type, user_id]):
            return jsonify({"error": "Missing file_data, file_name, content_type, or user_id"}), 400

        decoded_file = base64.b64decode(file_data)

        bucket_name = "synced_media"
        path_on_storage = f"{user_id}/{file_name}"

        response = supabase.storage.from_(bucket_name).upload(
            file=decoded_file,
            path=path_on_storage,
            file_options={"content-type": content_type}
        )

        if response.status_code == 200:
            public_url_response = supabase.storage.from_(bucket_name).get_public_url(path_on_storage)
            return jsonify({"message": "File uploaded successfully", "public_url": public_url_response}), 200
        else:
            # Supabase 응답이 딕셔너리 형태가 아닐 수 있으므로, .json() 호출 전에 확인
            error_details = response.text if hasattr(response, 'text') else str(response)
            return jsonify({"error": "Supabase upload failed", "details": error_details}), response.status_code

    except Exception as e:
        print(f"Error in add_synced_media: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)