/**
 * 常见的Content-Type类型
 * 用于路径模板配置的快速选择
 */
export const COMMON_CONTENT_TYPES = [
  // 压缩文件
  { value: 'application/zip', label: 'ZIP Archive', category: 'Archive' },
  { value: 'application/x-rar-compressed', label: 'RAR Archive', category: 'Archive' },
  { value: 'application/gzip', label: 'GZIP Archive', category: 'Archive' },
  { value: 'application/x-tar', label: 'TAR Archive', category: 'Archive' },
  { value: 'application/x-7z-compressed', label: '7-Zip Archive', category: 'Archive' },
  
  // 数据库文件
  { value: 'application/sql', label: 'SQL Database', category: 'Database' },
  { value: 'application/x-sqlite3', label: 'SQLite Database', category: 'Database' },
  { value: 'application/octet-stream', label: 'Binary/Database File', category: 'Database' },
  
  // 文本文件
  { value: 'text/plain', label: 'Plain Text', category: 'Text' },
  { value: 'text/html', label: 'HTML', category: 'Text' },
  { value: 'text/css', label: 'CSS', category: 'Text' },
  { value: 'text/javascript', label: 'JavaScript', category: 'Text' },
  { value: 'text/xml', label: 'XML', category: 'Text' },
  
  // 配置文件
  { value: 'application/json', label: 'JSON', category: 'Config' },
  { value: 'application/xml', label: 'XML Config', category: 'Config' },
  { value: 'application/x-yaml', label: 'YAML', category: 'Config' },
  { value: 'application/toml', label: 'TOML', category: 'Config' },
  
  // 文档文件
  { value: 'application/pdf', label: 'PDF Document', category: 'Document' },
  { value: 'application/msword', label: 'Word Document', category: 'Document' },
  { value: 'application/vnd.ms-excel', label: 'Excel Spreadsheet', category: 'Document' },
  
  // 其他
  { value: 'image/jpeg', label: 'JPEG Image', category: 'Image' },
  { value: 'image/png', label: 'PNG Image', category: 'Image' },
  { value: 'application/x-sh', label: 'Shell Script', category: 'Script' },
  { value: 'application/x-php', label: 'PHP Script', category: 'Script' },
];

/**
 * 按类别分组的Content-Type
 */
export const CONTENT_TYPES_BY_CATEGORY = COMMON_CONTENT_TYPES.reduce((acc, item) => {
  if (!acc[item.category]) {
    acc[item.category] = [];
  }
  acc[item.category].push(item);
  return acc;
}, {} as Record<string, typeof COMMON_CONTENT_TYPES>);

/**
 * 获取所有类别
 */
export const CONTENT_TYPE_CATEGORIES = Object.keys(CONTENT_TYPES_BY_CATEGORY);
