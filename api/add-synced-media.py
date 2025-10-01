import json
import base64
import os
from flask import Flask, request, jsonify
from supabase import create_client, Client
import traceback # traceback 모듈 추가

app = Flask(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.route('/api/add-synced-media', methods=['POST'])
def add_synced_media():
    try:
        print("--- add_synced_media function started ---") # 함수 시작 로그

        data = None
        if isinstance(request, dict):
            print("Request object is a dict (serverless environment).")
            event = request
            body_data = None
            if 'body' in event and event.get('isBase64Encoded', False):
                body_data = base64.b64decode(event['body']).decode('utf-8')
                print(f"Decoded base64 body data length: {len(body_data) if body_data else 0}")
            elif 'body' in event:
                body_data = event['body']
                print(f"Raw body data length: {len(body_data) if body_data else 0}")
            else:
                print("No 'body' key in serverless event.")

            if body_data:
                try:
                    data = json.loads(body_data)
                    print("Successfully parsed JSON from serverless event body.")
                except json.JSONDecodeError as e:
                    print(f"JSONDecodeError in serverless event body: {e}")
                    return jsonify({"error": "Invalid JSON format in serverless event body"}), 400
            else:
                return jsonify({"error": "No body data provided in serverless event"}), 400
        else:
            print("Request object is a Flask request object.")
            data = request.json
            if not data:
                print("No JSON data provided in Flask request. Trying raw data.")
                raw_data = request.get_data(as_text=True)
                if raw_data:
                    try:
                        data = json.loads(raw_data)
                        print("Successfully parsed JSON from raw Flask request data.")
                    except json.JSONDecodeError as e:
                        print(f"JSONDecodeError from raw Flask request data: {e}")
                        return jsonify({"error": "Invalid JSON format from raw Flask request data"}), 400
                else:
                    return jsonify({"error": "No JSON data provided in Flask request"}), 400
            else:
                print("Successfully parsed JSON from Flask request.json.")

        # 데이터 유효성 검사 전 로그
        print(f"Received data keys: {data.keys() if data else 'No data'}")

        file_data = data.get('file_data')
        file_name = data.get('file_name')
        content_type = data.get('content_type')
        user_id = data.get('user_id')

        if not all([file_data, file_name, content_type, user_id]):
            print(f"Missing data: file_data={bool(file_data)}, file_name={bool(file_name)}, content_type={bool(content_type)}, user_id={bool(user_id)}")
            return jsonify({"error": "Missing file_data, file_name, content_type, or user_id"}), 400

        print(f"File name: {file_name}, Content type: {content_type}, User ID: {user_id}")
        print(f"File data length: {len(file_data) if file_data else 0}")

        decoded_file = base64.b64decode(file_data)
        print(f"Decoded file size: {len(decoded_file)} bytes")

        bucket_name = "synced_media"
        path_on_storage = f"public/{user_id}/{file_name}"
        print(f"Uploading to Supabase bucket: {bucket_name}, path: {path_on_storage}")

        response = supabase.storage.from_(bucket_name).upload(
            file=decoded_file,
            path=path_on_storage,
            file_options={"content-type": content_type}
        )
        # print(f"Supabase upload response status: {response.status_code}") # 이 줄 제거

        # Supabase upload 메서드는 성공 시 data 키를 포함하는 딕셔너리를 반환합니다.
        # 오류 발생 시 예외를 발생시키거나 다른 형태의 응답을 반환할 수 있습니다.
        # httpx 로그에서 200 OK를 받았으므로, response 객체에 data가 있을 것으로 예상합니다.
        if response and 'data' in response: # response 객체에 data 키가 있는지 확인
            # 공개 URL 가져오기
            public_url_response = supabase.storage.from_(bucket_name).get_public_url(path_on_storage)
            print(f"File uploaded successfully. Public URL: {public_url_response}")
            return jsonify({"message": "File uploaded successfully", "public_url": public_url_response}), 200
        else:
            # response 객체에 data가 없거나, 예상치 못한 응답일 경우
            error_details = str(response) # response 객체 자체를 문자열로 변환하여 로그
            print(f"Supabase upload failed or returned unexpected response. Details: {error_details}")
            return jsonify({"error": "Supabase upload failed or returned unexpected response", "details": error_details}), 500

    except Exception as e:
        print(f"--- An unexpected error occurred in add_synced_media: {e} ---") # 예외 발생 로그
        traceback.print_exc() # 스택 트레이스 출력
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)