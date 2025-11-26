// 使用说明：如何将批量生成器集成到 TemplateManagement

## 第1步：添加导入和状态

在文件顶部添加:
```tsx
import { Wand2 } from 'lucide-react';  // 在现有 lucide-react 导入中添加
import { Template BatchGenerator } from './TemplateBatchGenerator';  // 新增行
```

在组件状态中添加:
```tsx
const [activeTab, setActiveTab] = useState<'manual' | 'batch'>('manual');
```

## 第2步：添加批量生成处理函数

在 `formatSize` 函数后添加:
```tsx
// 批量生成处理
const handleBatchGenerate = async (urlTemplates: string[]) => {
  let successCount = 0;
  let failCount = 0;
  
  for (const urlTemplate of urlTemplates) {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: urlTemplate.substring(urlTemplate.lastIndexOf('/') + 1).substring(0, 50),
          template: urlTemplate,
          description: '批量生成',
          expected_content_type: '',
          min_size: 0,
          max_size: null,
          enabled: 1
        })
      });
      
      const data = await res.json();
      if (data.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch {
      failCount++;
    }
  }
  
  showToast(`批量创建完成：成功 ${successCount} 个，失败 ${failCount} 个`, 'success');
  fetchTemplates();
  setActiveTab('manual');
};
```

## 第3步：在 return 的 JSX 中，在第一个 div 之后添加标签页

在标题 div 和表单 div 之间添加:
```tsx
{/* 标签页切换 */}
{!editingId && !isCreating && (
  <div className="glass-panel rounded-2xl p-2 flex gap-2">
    <button
      onClick={() => setActiveTab('manual')}
      className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
        activeTab === 'manual'
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200'
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Plus className="w-4 h-4" />
      手动创建
    </button>
    <button
      onClick={() => setActiveTab('batch')}
      className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
        activeTab === 'batch'
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200'
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Wand2 className="w-4 h-4" />
      批量生成
    </button>
  </div>
)}

{/* 批量生成器或手动管理 */}
{activeTab === 'batch' && !editingId && !isCreating ? (
  <TemplateBatchGenerator 
    onGenerate={handleBatchGenerate}
    showToast={showToast}
  />
) : null}
```

完成！这样用户就可以在"手动创建"和"批量生成"两个标签页之间切换了。
