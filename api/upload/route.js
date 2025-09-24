import { handleUpload } from '@vercel/blob/client';

export async function POST(request) {
  console.log('Checking for BLOB_READ_WRITE_TOKEN:');
  console.log('Is it present?', !!process.env.BLOB_READ_WRITE_TOKEN);
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // This is where you would add your own authorization logic
        return {
          allowedContentTypes: ['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/gif', 'text/markdown'],
          token: process.env.BLOB_READ_WRITE_TOKEN,
        };
      },
      onUploadCompleted: async ({ blob, token }) => {
        console.log('blob upload completed', blob, token);
      },
    });

    return new Response(JSON.stringify(jsonResponse), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error).message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
}