
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decryptJSON, EncryptedPayload, b64decode } from '../lib/crypto';

// DECRYPT_VIEW: 복호화된 내용을 보여주는 뷰 컴포넌트
function DecryptView({ content }: { content: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    alert('Copied to clipboard!');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Decrypted Note</h1>
      <pre className="bg-gray-100 p-4 rounded-md whitespace-pre-wrap break-words mb-4">
        {content}
      </pre>
      <button
        onClick={handleCopy}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Copy to Clipboard
      </button>
    </div>
  );
}

// ERROR_VIEW: 오류 메시지를 보여주는 뷰 컴포넌트
function ErrorView({ message }: { message: string }) {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-red-500">Error</h1>
      <p>{message}</p>
    </div>
  );
}

// LOADING_VIEW: 로딩 상태를 보여주는 뷰 컴포넌트
function LoadingView() {
  return <div className="p-4">Decrypting...</div>;
}

export default function SharedNotePage() {
  const [searchParams] = useSearchParams();
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const decryptNote = async () => {
      setIsLoading(true);
      try {
        const payloadB64 = searchParams.get('p');
        const passphrase = window.location.hash.substring(1);

        if (!payloadB64 || !passphrase) {
          throw new Error('Invalid share link. Payload or key is missing.');
        }

        // 1. Decode payload from Base64
        const payloadString = new TextDecoder().decode(b64decode(payloadB64));
        const payload: EncryptedPayload = JSON.parse(payloadString);

        // 2. Decrypt the content
        const decryptedData = await decryptJSON<{ content: string }>(payload, passphrase);
        
        if (typeof decryptedData.content !== 'string') {
          throw new Error('Decrypted data is not in the expected format.');
        }

        setDecryptedContent(decryptedData.content);
      } catch (err) {
        console.error('Decryption failed:', err);
        setError('Failed to decrypt the note. The link may be corrupted or the key incorrect.');
      } finally {
        setIsLoading(false);
      }
    };

    decryptNote();
  }, [searchParams]);

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView message={error} />;
  }

  if (decryptedContent) {
    return <DecryptView content={decryptedContent} />;
  }

  return <ErrorView message="No content to display." />;
}
