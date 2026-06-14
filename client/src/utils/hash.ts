/**
 * 使用 Web Worker 计算文件 MD5 hash
 * 不阻塞主线程，支持进度回调
 */
export const calculateFileHash = (
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/hash.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'progress') {
        onProgress?.(Math.round((e.data.current / e.data.total) * 100));
      } else if (e.data.type === 'done') {
        worker.terminate();
        resolve(e.data.hash);
      } else if (e.data.type === 'error') {
        worker.terminate();
        reject(new Error(e.data.message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage(file);
  });
};
