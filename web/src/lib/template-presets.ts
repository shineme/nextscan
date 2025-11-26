// 模板生成预设配置

/**
 * 系统预设的前缀列表
 * 基于用户提供的常见备份和目录名称
 */
export const PRESET_PREFIXES = [
    // 基础备份相关
    'backup',
    'webbackup',
    'websitebackup',
    'backup',

    // 目录相关
    'cgi-bin',
    'htdocs',
    'web',
    'public',
    'wp-content',
    'webpack',
    'pack',
    '__MACOSX',

    // 域名相关组合
    'combackup',
    'infobackup',
    'netbackup',

    // 数字前缀
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
    '111',

    // 字母前缀
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
    'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z'
];

/**
 * 后缀配置接口
 */
export interface SuffixConfig {
    suffix: string;
    contentType: string;
    label: string;
}

/**
 * 系统预设的后缀列表（带默认 Content-Type）
 */
export const PRESET_SUFFIX_CONFIGS: SuffixConfig[] = [
    { suffix: '.rar', contentType: 'application/x-rar-compressed', label: 'RAR压缩包' },
    { suffix: '.zip', contentType: 'application/zip', label: 'ZIP压缩包' },
    { suffix: '.tar.gz', contentType: 'application/gzip', label: 'TAR.GZ压缩包' },
    { suffix: '.tar', contentType: 'application/x-tar', label: 'TAR归档' },
    { suffix: '.sql.gz', contentType: 'application/gzip', label: 'SQL压缩备份' },
    { suffix: '.sql', contentType: 'text/plain', label: 'SQL数据库' },
    { suffix: '.7z', contentType: 'application/x-7z-compressed', label: '7Z压缩包' },
    { suffix: '.bak', contentType: 'application/octet-stream', label: '备份文件' },
    { suffix: '.gz', contentType: 'application/gzip', label: 'GZIP压缩' },
    { suffix: '.tgz', contentType: 'application/gzip', label: 'TGZ压缩包' },
    { suffix: '.json', contentType: 'application/json', label: 'JSON文件' },
    { suffix: '.xml', contentType: 'application/xml', label: 'XML文件' },
    { suffix: '.csv', contentType: 'text/csv', label: 'CSV文件' },
    { suffix: '.log', contentType: 'text/plain', label: '日志文件' },
    { suffix: '.txt', contentType: 'text/plain', label: '文本文件' },
    { suffix: '.conf', contentType: 'text/plain', label: '配置文件' },
    { suffix: '.cfg', contentType: 'text/plain', label: '配置文件' },
    { suffix: '.ini', contentType: 'text/plain', label: 'INI配置' },
    { suffix: '.env', contentType: 'text/plain', label: '环境变量' },
    { suffix: '.pdf', contentType: 'application/pdf', label: 'PDF文档' },
];

/**
 * 兼容旧版：纯后缀字符串列表
 */
export const PRESET_SUFFIXES = PRESET_SUFFIX_CONFIGS.map(c => c.suffix);

/**
 * 根据后缀获取默认 Content-Type
 */
export function getContentTypeForSuffix(suffix: string): string {
    const config = PRESET_SUFFIX_CONFIGS.find(c => c.suffix === suffix);
    return config?.contentType || '';
}

/**
 * 常用的模板变量及其描述
 */
export const TEMPLATE_VARIABLES = [
    // 域名格式
    { value: '(domain)', label: '完整域名', example: 'example.com' },
    { value: '(root_domain)', label: '根域名', example: 'example.com' },
    { value: '(subdomain)', label: '子域名', example: 'www' },
    { value: '(domain_underline)', label: '下划线格式', example: 'example_com' },
    { value: '(domain_nodot)', label: '无点格式', example: 'examplecom' },
    { value: '(domain_dash)', label: '中划线格式', example: 'example-com' },

    // 兼容 # 语法
    { value: '#domain#', label: '域名(#语法)', example: 'example.com' },
    { value: '#topdomain#', label: '顶级域名', example: 'example.com' },
    { value: '#underlinedomain#', label: '下划线域名', example: 'example_com' },
    { value: '#domainnopoint#', label: '无点域名', example: 'examplecom' },
    { value: '#midlinedomain#', label: '中划线域名', example: 'example-com' },

    // 日期时间
    { value: '(year)', label: '年份', example: '2024' },
    { value: '(month)', label: '月份', example: '01' },
    { value: '(day)', label: '日期', example: '25' },
    { value: '(date)', label: 'YYYYMMDD', example: '20240125' }
];

/**
 * 预设的日期范围模板
 */
export const PRESET_DATE_RANGES = [
    // 日期范围 (当前月)
    { label: '本月每日', pattern: '{YYYYMM01..YYYYMM31}', description: '生成当月1-31日' },

    // 月份范围
    { label: '最近3个月', pattern: '{202401..202403}', description: '202401, 202402, 202403' },
    { label: '最近6个月', pattern: '{202306..202401}', description: '6个月份' },
    { label: '全年12个月', pattern: '{202401..202412}', description: '全年月份' },

    // 自定义提示
    { label: '自定义日期', pattern: '{20240101..20240131}', description: '格式: {起始..结束}' }
];
