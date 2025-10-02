from http.server import BaseHTTPRequestHandler
import json
import os
import cgi
import uuid
from supabase import create_client, Client

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Get Supabase client with service role key for admin tasks
            supabase_url = os.environ.get('VITE_PUBLICSUPABASE_URL')
            supabase_service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

            if not supabase_url or not supabase_service_key:
                self.send_error(500, "Supabase environment variables not set.")
                return

            supabase = create_client(supabase_url, supabase_service_key)

            # Parse the multipart form data
            fs = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST',
                         'CONTENT_TYPE': self.headers['Content-Type']}
            )

            if 'file' not in fs or 'userId' not in fs:
                self.send_error(400, "File or userId missing from form data.")
                return

            file_item = fs['file']
            filename = file_item.filename
            file_bytes = file_item.file.read()
            content_type = file_item.type
            user_id = fs.getvalue('userId')

            # Upload file to Supabase Storage
            file_extension = os.path.splitext(filename)[1]
            new_filename = f'public/{user_id}/{uuid.uuid4()}{file_extension}'
            
            supabase.storage.from_('synced_media').upload(
                new_filename,
                file_bytes,
                file_options={"content-type": content_type}
            )

            # Get public URL and insert metadata into the database
            public_url = supabase.storage.from_('synced_media').get_public_url(new_filename)
            
            # Insert metadata into the 'synced_media' table
            # Note: The user_id here is from the form data, linking the media to the user.
            supabase.table('synced_media').insert({'url': public_url, 'user_id': user_id}).execute()

            # Send success response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'url': public_url}).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e), 'type': type(e).__name__}).encode('utf-8'))

        return