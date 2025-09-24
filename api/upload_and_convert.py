from http.server import BaseHTTPRequestHandler
import json
import cgi
import os
import uuid
import tempfile
from pdf2image import convert_from_bytes
import traceback

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            job_id = str(uuid.uuid4())
            # Use system's temp dir, but create a subdir for our job
            job_dir = os.path.join(tempfile.gettempdir(), job_id)
            os.makedirs(job_dir, exist_ok=True)

            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
            )

            files = form.getlist('files')
            
            for file_item in files:
                filename = file_item.filename
                file_content = file_item.file.read()
                file_path = os.path.join(job_dir, filename)

                with open(file_path, 'wb') as f:
                    f.write(file_content)

                if file_item.type == 'application/pdf':
                    try:
                        images = convert_from_bytes(file_content, fmt='png', output_folder=job_dir, thread_count=4)
                        # Clean up the original PDF after conversion
                        os.remove(file_path)
                    except Exception as e:
                        # If Poppler is not installed, this will fail.
                        # We should inform the user about this dependency.
                        if "Poppler" in str(e):
                            raise ValueError("PDF processing requires the Poppler utility. Please ensure it is installed on the server environment.") from e
                        else:
                            raise e

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'jobId': job_id}).encode('utf-8'))

        except Exception as e:
            print(f"ERROR in upload_and_convert: {e}")
            traceback.print_exc()
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
