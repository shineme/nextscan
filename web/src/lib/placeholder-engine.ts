// 占位符替换引擎

export interface DomainParts {
  host: string;          // 完整域名
  rootDomain: string;    // 注册域名
  subdomain: string;     // 子域名部分
  tld: string;           // 顶级域
  sld: string;           // 二级域主体
  // 格式化变量
  domainUnderline: string;  // example_com (下划线格式)
  domainNodot: string;      // examplecom (无点格式)
  domainDash: string;       // example-com (中划线格式)
  domainCenter: string;     // 域名中间部分 (SLD)
}

export interface PlaceholderContext {
  domain: string;
  rank?: number;
  csvDate?: string;
  currentDate?: Date;
}

// 常见的多级TLD列表
const MULTI_LEVEL_TLDS = [
  'co.uk', 'com.cn', 'com.au', 'co.jp', 'co.kr', 'co.nz', 'co.za',
  'com.br', 'com.mx', 'com.ar', 'com.tw', 'com.hk', 'com.sg',
  'gov.uk', 'ac.uk', 'org.uk', 'net.uk',
  'gov.au', 'edu.au', 'org.au',
  'ne.jp', 'or.jp', 'ac.jp', 'go.jp'
];

/**
 * 解析域名为各个组成部分
 */
export function parseDomain(domain: string): DomainParts {
  const host = domain.toLowerCase().trim();

  // 查找匹配的多级TLD
  let tld = '';
  let remainingParts: string[] = [];

  for (const multiTld of MULTI_LEVEL_TLDS) {
    if (host.endsWith('.' + multiTld)) {
      tld = multiTld;
      const withoutTld = host.substring(0, host.length - multiTld.length - 1);
      remainingParts = withoutTld.split('.');
      break;
    }
  }

  // 如果没有匹配多级TLD,使用最后一部分作为TLD
  if (!tld) {
    const parts = host.split('.');
    if (parts.length >= 2) {
      tld = parts[parts.length - 1];
      remainingParts = parts.slice(0, -1);
    } else {
      // 只有一个部分,没有TLD
      tld = '';
      remainingParts = parts;
    }
  }

  // 提取SLD和subdomain
  let sld = '';
  let subdomain = '';

  if (remainingParts.length > 0) {
    sld = remainingParts[remainingParts.length - 1];
    if (remainingParts.length > 1) {
      subdomain = remainingParts.slice(0, -1).join('.');
    }
  }

  // 构建rootDomain
  const rootDomain = tld ? `${sld}.${tld}` : sld;

  // 格式化变量
  const domainUnderline = host.replace(/\./g, '_');  // api.example.com → api_example_com
  const domainNodot = host.replace(/\./g, '');       // api.example.com → apiexamplecom
  const domainDash = host.replace(/\./g, '-');       // api.example.com → api-example-com
  const domainCenter = sld;                          // 域名中间部分，等同于 sld

  return {
    host,
    rootDomain,
    subdomain,
    tld,
    sld,
    domainUnderline,
    domainNodot,
    domainDash,
    domainCenter
  };
}

/**
 * 格式化日期为YYYYMMDD
 */
function formatYMD(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 格式化日期为YYYY-MM-DD
 */
function formatDateDash(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 占位符替换引擎
 */
export class PlaceholderEngine {
  private supportedPlaceholders = [
    // {} 语法
    '{host}', '{domain}', '{root_domain}', '{subdomain}', '{tld}', '{sld}',
    '{domain_underline}', '{domain_nodot}', '{domain_dash}', '{domain_center}', '{topdomain}',
    '{year}', '{month}', '{day}', '{ymd}', '{date}', '{date_dash}',
    '{timestamp}', '{rank}', '{csv_date}',
    // () 语法
    '(host)', '(domain)', '(root_domain)', '(subdomain)', '(tld)', '(sld)',
    '(domain_underline)', '(domain_nodot)', '(domain_dash)', '(domain_center)', '(topdomain)',
    '(year)', '(month)', '(day)', '(ymd)', '(date)', '(date_dash)',
    '(timestamp)', '(rank)', '(csv_date)',
    // # 语法 (兼容用户原软件)
    '#domain#', '#topdomain#', '#domaincenter#', '#underlinedomain#',
    '#domainnopoint#', '#midlinedomain#'
  ];

  /**
   * 获取支持的占位符列表
   */
  getSupportedPlaceholders(): string[] {
    return [...this.supportedPlaceholders];
  }

  /**
   * 替换模板中的占位符
   * 支持两种格式：{placeholder} 和 (placeholder)
   */
  replace(template: string, context: PlaceholderContext): string {
    const parts = parseDomain(context.domain);
    const date = context.currentDate || new Date();

    let result = template;

    // 域名相关占位符 - 支持 {}, (), # 三种语法
    result = result.replace(/\{host\}|\(host\)/g, parts.host);
    result = result.replace(/\{domain\}|\(domain\)|#domain#/g, parts.host);
    result = result.replace(/\{root_domain\}|\(root_domain\)|\{topdomain\}|\(topdomain\)|#topdomain#/g, parts.rootDomain);
    result = result.replace(/\{subdomain\}|\(subdomain\)/g, parts.subdomain);
    result = result.replace(/\{tld\}|\(tld\)/g, parts.tld);
    result = result.replace(/\{sld\}|\(sld\)/g, parts.sld);

    // 新增格式化变量
    result = result.replace(/\{domain_underline\}|\(domain_underline\)|#underlinedomain#/g, parts.domainUnderline);
    result = result.replace(/\{domain_nodot\}|\(domain_nodot\)|#domainnopoint#/g, parts.domainNodot);
    result = result.replace(/\{domain_dash\}|\(domain_dash\)|#midlinedomain#/g, parts.domainDash);
    result = result.replace(/\{domain_center\}|\(domain_center\)|#domaincenter#/g, parts.domainCenter);

    // 日期相关占位符
    result = result.replace(/\{year\}|\(year\)/g, date.getFullYear().toString());
    result = result.replace(/\{month\}|\(month\)/g, (date.getMonth() + 1).toString().padStart(2, '0'));
    result = result.replace(/\{day\}|\(day\)/g, date.getDate().toString().padStart(2, '0'));
    result = result.replace(/\{ymd\}|\(ymd\)/g, formatYMD(date));
    result = result.replace(/\{date\}|\(date\)/g, formatYMD(date));
    result = result.replace(/\{date_dash\}|\(date_dash\)/g, formatDateDash(date));
    result = result.replace(/\{timestamp\}|\(timestamp\)/g, Math.floor(date.getTime() / 1000).toString());

    // 其他占位符
    if (context.rank !== undefined) {
      result = result.replace(/\{rank\}|\(rank\)/g, context.rank.toString());
    }
    if (context.csvDate) {
      result = result.replace(/\{csv_date\}|\(csv_date\)/g, context.csvDate);
    }

    // 自动添加协议前缀
    // 如果URL不是以http://或https://开头,自动添加https://
    if (!result.match(/^https?:\/\//i)) {
      // 如果以/开头,去掉/再添加https://
      if (result.startsWith('/')) {
        result = 'https:/' + result;
      } else {
        result = 'https://' + result;
      }
    }

    return result;
  }
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 验证模板中的占位符
 * 支持三种格式：{placeholder}, (placeholder), #placeholder#
 */
export function validateTemplate(template: string): ValidationResult {
  // 提取所有占位符 - 支持 {}, (), # 三种格式
  const placeholderRegex = /\{[a-z_]+\}|\([a-z_]+\)|#[a-z]+#/g;
  const matches = template.match(placeholderRegex);

  if (!matches) {
    // 没有占位符,纯文本模板也是有效的
    return { valid: true };
  }

  const engine = new PlaceholderEngine();
  const supported = engine.getSupportedPlaceholders();

  // 检查每个占位符是否支持
  for (const placeholder of matches) {
    if (!supported.includes(placeholder)) {
      return {
        valid: false,
        error: `Invalid placeholder: ${placeholder}. Supported: ${supported.join(', ')}`
      };
    }
  }

  return { valid: true };
}
