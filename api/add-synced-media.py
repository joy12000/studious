import json
import os
import cgi
import uuid
import base64
from io import BytesIO
from supabase import create_client, Client

def handler(request):
    try:
        # Vercel passes the request as a dictionary-like object.
        # We extract headers and body from it.
        headers = {k.lower(): v for k, v in request.get('headers', {}).items()}
        body_b64 = request.get('body', '')
        
        if not body_b64:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Request body is missing.'})
            }

        # Decode the base64 body to bytes and create a file-like object for cgi
        body_bytes = base64.b64decode(body_b64)
        fp = BytesIO(body_bytes)

        # Parse the multipart form data using cgi
        fs = cgi.FieldStorage(
            fp=fp,
            headers=headers,
            environ={'REQUEST_METHOD': 'POST',
                     'CONTENT_TYPE': headers.get('content-type')}
        )

        if 'file' not in fs or 'userId' not in fs:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'File or userId missing from form data.'})
            }

        file_item = fs['file']
        filename = file_item.filename
        file_bytes = file_item.file.read()
        content_type = file_item.type
        user_id = fs.getvalue('userId')

        # Authenticate with Supabase using the token from the header
        auth_header = headers.get('authorization', '')
        if not auth_header.startswith('bearer '):
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Authorization header missing or invalid.'})
            }
        jwt = auth_header.split('bearer ')[1]

        supabase_url = os.environ.get('VITE_PUBLICSUPABASE_URL')
        supabase_key = os.environ.get('VITE_PUBLICSUPABASE_ANON_KEY')

        if not supabase_url or not supabase_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Supabase environment variables not set.'})
            }

        supabase = create_client(
            supabase_url,
            supabase_key,
            options={"global": {"headers": {"Authorization": f"Bearer {jwt}"}}}
        )

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
        supabase.table('synced_media').insert({'url': public_url, 'user_id': user_id}).execute()

        # Return success response
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'success': True, 'url': public_url})
        }

    except Exception as e:
        # Generic error handler
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e), 'type': type(e).__name__})
        }
