export interface ChunkItem {
  chunk: Blob;
  index: number;
}

/**
 * 将文件切分为 1MB 的分片
 */
export const createFileChunks = (file: File, chunkSize = 1024 * 1024): ChunkItem[] => {
  const chunks: ChunkItem[] = [];
  let start = 0;
  let index = 0;
  while (start < file.size) {
    const end = start + chunkSize;
    chunks.push({ chunk: file.slice(start, end), index });
    start = end;
    index++;
  }
  return chunks;
};

/**
 * 检查文件大小是否超过限制（默认 5GB）
 */
export const isFileOversize = (file: File, maxSize = 5 * 1024 * 1024 * 1024): boolean => {
  return file.size > maxSize;
};
