import { configService } from './config-service';
import { validateTemplate, PlaceholderEngine, type ValidationResult } from './placeholder-engine';

/**
 * 模板管理服务
 */
export class TemplateService {
  private engine = new PlaceholderEngine();

  /**
   * 获取所有模板
   */
  getTemplates(): string[] {
    const templatesStr = configService.get('path_templates') || '';
    if (!templatesStr) {
      return [];
    }
    return templatesStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }

  /**
   * 添加模板
   */
  addTemplate(template: string): void {
    // 验证模板
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const templates = this.getTemplates();
    
    // 检查是否已存在
    if (templates.includes(template)) {
      throw new Error('Template already exists');
    }

    templates.push(template);
    configService.set('path_templates', templates.join(','));
  }

  /**
   * 删除模板
   */
  removeTemplate(template: string): void {
    const templates = this.getTemplates();
    const filtered = templates.filter(t => t !== template);
    
    if (filtered.length === templates.length) {
      throw new Error('Template not found');
    }

    configService.set('path_templates', filtered.join(','));
  }

  /**
   * 编辑模板
   */
  editTemplate(oldTemplate: string, newTemplate: string): void {
    // 验证新模板
    const validation = this.validateTemplate(newTemplate);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const templates = this.getTemplates();
    const index = templates.indexOf(oldTemplate);
    
    if (index === -1) {
      throw new Error('Template not found');
    }

    templates[index] = newTemplate;
    configService.set('path_templates', templates.join(','));
  }

  /**
   * 验证模板
   */
  validateTemplate(template: string): ValidationResult {
    return validateTemplate(template);
  }

  /**
   * 生成预览
   */
  preview(template: string, exampleDomain: string = 'example.com'): string {
    const protocol = 'https://';
    const path = this.engine.replace(template, {
      domain: exampleDomain,
      rank: 42,
      csvDate: '20251124',
      currentDate: new Date()
    });
    
    return `${protocol}${exampleDomain}/${path}`;
  }
}

// 导出单例
export const templateService = new TemplateService();
