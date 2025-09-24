import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// PDF.js worker 파일 경로 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * PDF 파일을 이미지 파일 배열로 변환합니다.
 * @param pdfFile 변환할 PDF 파일
 * @param onProgress 진행 상태를 알리는 선택적 콜백 함수
 * @returns 이미지 파일 객체의 배열을 담은 Promise
 */
export async function convertPdfToImages(
  pdfFile: File,
  onProgress?: (progress: { pageNumber: number; totalPages: number }) => void
): Promise<File[]> {
  const images: File[] = [];
  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = async (event) => {
      if (!event.target?.result) {
        return reject(new Error('PDF 파일을 읽는 데 실패했습니다.'));
      }

      try {
        const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
        const loadingTask = pdfjsLib.getDocument(typedArray);
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        for (let i = 1; i <= totalPages; i++) {
          onProgress?.({ pageNumber: i, totalPages });
          const page = await pdf.getPage(i);
          // 선명한 이미지를 위해 스케일을 2.0으로 설정
          const viewport = page.getViewport({ scale: 2.0 });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (!context) {
            // 브라우저 환경에서는 거의 발생하지 않음
            continue;
          }

          await page.render({ canvasContext: context, viewport }).promise;

          const blob: Blob | null = await new Promise(resolveBlob => canvas.toBlob(resolveBlob, 'image/png'));
          
          if (blob) {
            const imageName = `${pdfFile.name.replace(/\.pdf$/i, '')}-page-${i}.png`;
            images.push(new File([blob], imageName, { type: 'image/png' }));
          }
        }
        resolve(images);
      } catch (error) {
        console.error('PDF를 이미지로 변환하는 중 오류 발생:', error);
        reject(error);
      }
    };

    fileReader.onerror = () => {
      reject(new Error('FileReader 오류가 발생했습니다.'));
    };

    fileReader.readAsArrayBuffer(pdfFile);
  });
}
