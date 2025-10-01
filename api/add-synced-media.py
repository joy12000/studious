from http.server import BaseHTTPRequestHandler
import json
import os
import cgi
from supabase import create_client, Client
import uuid

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            supabase_url = os.environ.get('VITE_PUBLICSUPABASE_URL')
            supabase_key = os.environ.get('VITE_PUBLICSUPABASE_ANON_KEY')
            
            if not supabase_url or not supabase_key:
                self.send_error(500, "Supabase environment variables not set.")
                return

            # 1. Get token from header
            auth_header = self.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                self.send_error(401, "Authorization header missing or invalid.")
                return
            jwt = auth_header.split('Bearer ')[1]

            # 2. Initialize Supabase client with user's JWT
            supabase: Client = create_client(
                supabase_url,
                supabase_key,
                options={"global": {"headers": {"Authorization": f"Bearer {jwt}"}}}
            )

            # 3. Parse multipart form data
            content_length = int(self.headers['Content-Length'])
            form_data = self.rfile.read(content_length)
            boundary = self.headers.get_boundary().encode()
            parts = form_data.split(b'--' + boundary)
            
            file_part = None
            user_id = None
            content_type = 'application/octet-stream'

            for part in parts:
                if b'Content-Disposition: form-data; name="file"' in part:
                    headers_section, content = part.split(b'\r\n\r\n', 1)
                    headers = headers_section.split(b'\r\n')
                    filename_header = [h for h in headers if b'filename' in h][0]
                    filename = filename_header.split(b'filename="')[1].split(b'"')[0].decode()
                    if any(b'Content-Type' in h for h in headers):
                        content_type_header = [h for h in headers if b'Content-Type' in h][0]
                        content_type = content_type_header.split(b': ')[1].decode()
                    file_part = (filename, content.strip(b'\r\n--'))
                
                if b'Content-Disposition: form-data; name="userId"' in part:
                    content_section = part.split(b'\r\n\r\n', 1)[1]
                    user_id = content_section.strip().decode('utf-8')

            # 3. Parse multipart form data using cgi
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST',
                         'CONTENT_TYPE': self.headers['Content-Type']}
            )

            if 'file' not in form or 'userId' not in form:
                self.send_error(400, "File or userId missing from form data.")
                return

            file_item = form['file']
            filename = file_item.filename
            file_bytes = file_item.file.read()
            content_type = file_item.type

            user_id = form.getvalue('userId')
            file_extension = os.path.splitext(filename)[1]
            new_filename = f'public/{user_id}/{uuid.uuid4()}{file_extension}'

            # 4. Upload to Supabase Storage
            try:
                response = supabase.storage.from_('synced_media').upload(
                    new_filename, 
                    file_bytes, 
                    file_options={"content-type": content_type}
                )
            except Exception as e:
                raise Exception(f"Storage upload failed: {e}")

            # 5. Get public URL
            public_url = supabase.storage.from_('synced_media').get_public_url(new_filename)

            # 6. Insert URL and userId into Supabase Database
            insert_response = supabase.table('synced_media').insert({
                'url': public_url,
                'user_id': user_id
            }).execute()
            print(f"Insert response: {insert_response}")

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "url": public_url}).encode('utf-8'))

        except Exception as e:
            self.send_error(500, str(e))

# Force re-deployment 2025-10-01 03:20