from http.server import BaseHTTPRequestHandler
import json
import os
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

            supabase: Client = create_client(supabase_url, supabase_key)

            content_length = int(self.headers['Content-Length'])
            # This is a naive way to handle multipart/form-data, good for single file uploads.
            # For more complex forms, a library would be better.
            form_data = self.rfile.read(content_length)

            # Parse multipart/form-data
            boundary = self.headers.get_boundary().encode()
            parts = form_data.split(b'--' + boundary)
            
            file_part = None
            content_type = 'application/octet-stream' # Default
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
                    break

            if not file_part:
                self.send_error(400, "File part not found in form data.")
                return

            filename, file_bytes = file_part
            file_extension = os.path.splitext(filename)[1]
            new_filename = f'public/{uuid.uuid4()}{file_extension}'

            # 1. Upload to Supabase Storage
            try:
                response = supabase.storage.from_('synced_media').upload(
                    new_filename, 
                    file_bytes, 
                    file_options={"content-type": content_type}
                )
            except Exception as e:
                raise Exception(f"Storage upload failed: {e}")

            # 2. Get public URL
            public_url_response = supabase.storage.from_('synced_media').get_public_url(new_filename)
            
            public_url = public_url_response.data

            # 3. Insert URL into Supabase Database
            print(f"Attempting to insert URL: {public_url} into synced_media table.")
            insert_response = supabase.table('synced_media').insert({
                'url': public_url,
                # 'user_id': 'some_user_id' # TODO: Add user auth later
            }).execute()
            print(f"Insert response: {insert_response}")

            if insert_response.error:
                print(f"Database insert error: {insert_response.error}")
                raise Exception(f"Database insert failed: {insert_response.error.message}")

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "url": public_url}).encode('utf-8'))

        except Exception as e:
            self.send_error(500, str(e))