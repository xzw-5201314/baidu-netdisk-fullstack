/**
 * 解析文件大小字符串为 MB 数值
 * 支持 KB、MB、GB 单位
 */
export const parseSize = (sizeStr: string): number => {
  const match = sizeStr.match(/([\d.]+)\s*(MB|GB|KB)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'GB') return num * 1024;
  if (unit === 'KB') return num / 1024;
  return num;
};

/**
 * 格式化字节数为可读字符串
 */
export const formatBytes = (bytes: number): string => {
  if (bytes > 1024 * 1024 * 1024) {
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }
  if (bytes > 1024 * 1024) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }
  if (bytes > 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  }
  return bytes + ' B';
};

/**
 * 格式化速度为可读字符串
 */
export const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond > 1024 * 1024) {
    return (bytesPerSecond / 1024 / 1024).toFixed(1) + ' MB/s';
  }
  return (bytesPerSecond / 1024).toFixed(0) + ' KB/s';
};
