import SparkMD5 from 'spark-md5';

const CHUNK_SIZE = 1024 * 1024; // 1MB

self.onmessage = (e: MessageEvent) => {
  const file: File = e.data;

  const chunks = Math.ceil(file.size / CHUNK_SIZE);
  const spark = new SparkMD5.ArrayBuffer();
  const reader = new FileReader();
  let currentChunk = 0;

  reader.onload = (event) => {
    spark.append(event.target?.result as ArrayBuffer);
    currentChunk++;

    // 向主线程报告进度
    self.postMessage({ type: 'progress', current: currentChunk, total: chunks });

    if (currentChunk < chunks) {
      readNext();
    } else {
      // 计算完成，返回 hash
      self.postMessage({ type: 'done', hash: spark.end() });
    }
  };

  reader.onerror = () => {
    self.postMessage({ type: 'error', message: '文件读取失败' });
  };

  const readNext = () => {
    const start = currentChunk * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    reader.readAsArrayBuffer(file.slice(start, end));
  };

  readNext();
};
