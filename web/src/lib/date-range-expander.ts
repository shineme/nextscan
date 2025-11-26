// 日期范围展开引擎

/**
 * 日期范围配置
 */
export interface DateRange {
    start: string;  // YYYYMMDD 或 YYYYMM 格式
    end: string;    // YYYYMMDD 或 YYYYMM 格式
}

/**
 * 解析日期范围字符串
 * 支持格式: {20240101..20240131} 或 {202401..202412}
 */
function parseDateRangeString(rangeStr: string): DateRange | null {
    const match = rangeStr.match(/^\{(\d+)\.\.(\d+)\}$/);
    if (!match) return null;

    return {
        start: match[1],
        end: match[2]
    };
}

/**
 * 验证并解析日期字符串
 */
function parseDate(dateStr: string): Date | null {
    if (dateStr.length === 8) {
        // YYYYMMDD 格式
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const date = new Date(year, month, day);

        // 验证日期有效性
        if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
            return null;
        }
        return date;
    } else if (dateStr.length === 6) {
        // YYYYMM 格式
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const date = new Date(year, month, 1);

        if (date.getFullYear() !== year || date.getMonth() !== month) {
            return null;
        }
        return date;
    }

    return null;
}

/**
 * 格式化日期为 YYYYMMDD
 */
function formatYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * 格式化日期为 YYYYMM
 */
function formatYYYYMM(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}${month}`;
}

/**
 * 展开 YYYYMMDD 格式的日期范围
 */
function expandDayRange(start: Date, end: Date): string[] {
    const results: string[] = [];
    const current = new Date(start);

    // 安全限制: 最多365天
    let count = 0;
    const maxDays = 365;

    while (current <= end && count < maxDays) {
        results.push(formatYYYYMMDD(current));
        current.setDate(current.getDate() + 1);
        count++;
    }

    return results;
}

/**
 * 展开 YYYYMM 格式的日期范围
 */
function expandMonthRange(start: Date, end: Date): string[] {
    const results: string[] = [];
    const current = new Date(start);

    // 安全限制: 最多60个月
    let count = 0;
    const maxMonths = 60;

    while (current <= end && count < maxMonths) {
        results.push(formatYYYYMM(current));
        current.setMonth(current.getMonth() + 1);
        count++;
    }

    return results;
}

/**
 * 展开模板中的日期范围
 * 
 * @param template 包含日期范围的模板字符串
 * @returns 展开后的模板数组，如果没有日期范围则返回原始模板数组
 * 
 * @example
 * expandDateRange('backup_{20240101..20240103}.zip')
 * // 返回: ['backup_20240101.zip', 'backup_20240102.zip', 'backup_20240103.zip']
 * 
 * expandDateRange('log_{202401..202403}.tar.gz')
 * // 返回: ['log_202401.tar.gz', 'log_202402.tar.gz', 'log_202403.tar.gz']
 */
export function expandDateRange(template: string): string[] {
    // 查找日期范围模式
    const rangePattern = /\{(\d+)\.\.(\d+)\}/;
    const match = template.match(rangePattern);

    if (!match) {
        // 没有日期范围，返回原始模板
        return [template];
    }

    const range = parseDateRangeString(match[0]);
    if (!range) {
        // 解析失败，返回原始模板
        return [template];
    }

    const startDate = parseDate(range.start);
    const endDate = parseDate(range.end);

    if (!startDate || !endDate) {
        // 日期无效，返回原始模板
        return [template];
    }

    if (startDate > endDate) {
        // 起始日期大于结束日期，返回原始模板
        return [template];
    }

    // 根据格式展开日期
    let dates: string[];
    if (range.start.length === 8) {
        // YYYYMMDD 格式
        dates = expandDayRange(startDate, endDate);
    } else {
        // YYYYMM 格式
        dates = expandMonthRange(startDate, endDate);
    }

    // 替换模板中的日期范围
    const prefix = template.substring(0, match.index!);
    const suffix = template.substring(match.index! + match[0].length);

    return dates.map(date => `${prefix}${date}${suffix}`);
}

/**
 * 递归展开所有日期范围
 * 
 * @param template 可能包含多个日期范围的模板
 * @returns 完全展开后的模板数组
 * 
 * @example
 * expandAllDateRanges('backup_{202401..202402}_{01..03}.zip')
 * // 返回: ['backup_202401_01.zip', 'backup_202401_02.zip', ..., 'backup_202402_03.zip']
 */
export function expandAllDateRanges(template: string): string[] {
    let current = [template];
    let hasRange = true;

    // 最多迭代10次，防止无限循环
    let iterations = 0;
    const maxIterations = 10;

    while (hasRange && iterations < maxIterations) {
        hasRange = false;
        const next: string[] = [];

        for (const t of current) {
            const expanded = expandDateRange(t);
            if (expanded.length > 1 || expanded[0] !== t) {
                hasRange = true;
            }
            next.push(...expanded);
        }

        current = next;
        iterations++;
    }

    return current;
}

/**
 * 安全的批量展开，带有数量限制
 * 
 * @param templates 模板数组
 * @param maxResults 最大结果数量限制
 * @returns 展开后的模板数组和是否被截断的标志
 */
export function safeExpandDateRanges(
    templates: string[],
    maxResults: number = 10000
): { results: string[], truncated: boolean } {
    const results: string[] = [];
    let truncated = false;

    for (const template of templates) {
        const expanded = expandAllDateRanges(template);

        for (const item of expanded) {
            if (results.length >= maxResults) {
                truncated = true;
                break;
            }
            results.push(item);
        }

        if (truncated) break;
    }

    return { results, truncated };
}
