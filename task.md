# 项目开发任务清单 (Based on PRD)

## 第一阶段：基础架构与 UI 框架 (Phase 1: Foundation & UI)
- [x] **项目初始化**
  - [x] 创建 Next.js + Tailwind CSS 项目
  - [x] 安装必要依赖 (lucide-react, recharts, better-sqlite3)
  - [x] 配置全局样式与动画 (Tailwind config, GlobalStyles)
- [x] **登录模块**
  - [x] 登录页面 UI 开发 (玻璃拟态、动态背景)
  - [x] SQLite 数据库初始化 (Users 表)
  - [x] 登录 API 开发 (/api/auth/login)
  - [x] 前后端联调与错误处理 (震动反馈)
- [x] **Dashboard 核心框架**
  - [x] 侧边栏导航 (流光选中态、果冻悬停效果)
  - [x] 顶部 Header (用户信息、面包屑)
  - [x] 首页总览 UI (统计卡片、趋势图、饼图 - 目前为 Mock 数据)

## 第二阶段：数据接入与资产库构建 (Phase 2: Data Ingestion & Assets)
*目标：建立核心数据源，实现从 CSV 拉取域名并入库，确保后续扫描有据可依。*
- [x] **数据库设计**
  - [x] 创建 `domains` 表 (id, domain, first_seen_at, last_seen_in_csv_at, has_been_scanned)
- [x] **CSV 数据接入逻辑**
  - [x] 实现 CSV 解析与处理工具函数
  - [x] 实现域名入库逻辑 (去重、更新 `last_seen`、标记新增)
  - [x] 开发手动触发同步的 API (`POST /api/domains/sync`)
- [x] **数据验证与展示**
  - [x] 开发域名列表查询 API (`GET /api/domains`)
  - [x] 前端对接：将 Mock 数据替换为真实数据库数据
  - [x] 验证：手动触发同步后，列表页能看到新入库的域名

## 第三阶段：任务调度与扫描引擎 (Phase 3: Task Scheduling & Scanning)
*目标：基于资产库创建扫描任务，生成探测结果。*
- [ ] **数据库设计**
  - [ ] 创建 `scan_tasks` 表 (任务状态管理)
  - [ ] 创建 `scan_results` 表 (探测结果存储)
- [ ] **任务创建流程**
  - [ ] 开发创建任务 API (支持选择增量/全量)
  - [ ] 前端对接：新建任务弹窗与表单提交
- [ ] **核心扫描逻辑**
  - [ ] URL 模板生成引擎 (替换占位符)
  - [ ] 模拟/实现探测请求 (后端并发请求目标 URL)
  - [ ] 结果处理与入库 (保存状态码、ContentType)
- [ ] **任务执行反馈**
  - [ ] 任务状态实时更新逻辑
  - [ ] 前端对接：任务列表页显示真实进度

## 第四阶段：结果分析与数据可视化 (Phase 4: Analytics & Visualization)
*目标：展示探测成果，提供导出功能，让数据产生价值。*
- [ ] **结果查询与导出**
  - [ ] 开发结果查询 API (支持筛选)
  - [ ] 前端对接：结果列表页
  - [ ] 实现 CSV 导出功能
- [ ] **Dashboard 数据闭环**
  - [ ] 聚合统计 API (计算总数、今日新增、风险数)
  - [ ] 前端对接：首页统计卡片与图表接入真实数据

## 第五阶段：系统配置与自动化 (Phase 5: Settings & Automation)
- [ ] **系统配置**
  - [x] 远程 CSV URL 配置与持久化
  - [ ] 扫描并发参数配置
- [ ] **自动化作业**
  - [ ] 配置定时任务 (Cron Job) 每日自动拉取 CSV
