# Worker Failover 方案总结

## 📌 你的问题解答

### Q1: 每个 Worker 每天 100,000 次限额如何处理？

**A:** 实现了完整的配额管理系统：

1. **配额追踪**：每个 Worker 维护 `dailyUsage` 计数器
2. **配额检查**：选择 Worker 时检查 `dailyUsage < dailyQuota`
3. **配额递增**：每次请求后 `dailyUsage += 请求的URL数量`
4. **配额重置**：每天午夜 UTC 自动重置为 0
5. **配额耗尽**：达到限额后自动排除该 Worker，直到第二天

```typescript
// 示例
Worker 1: 98,500 / 100,000 ✓ 可用
Worker 2: 100,000 / 100,000 ✗ 今日已耗尽
Worker 3: 1,234 / 100,000 ✓ 可用
```

### Q2: 如何检测 Worker 被封禁？

**A:** 实现了智能封禁检测：

**触发条件**（任一满足即永久禁用）：
- 响应包含 `"There is nothing here yet"`
- 响应包含 `"account has been blocked"`

**处理流程**：
1. 检测到封禁信号 → 立即标记 `permanentlyDisabled = true`
2. 记录封禁原因（`not_deployed` 或 `account_blocked`）
3. 保存到数据库 `worker_disabled_list`
4. **不计入重试次数**，立即尝试下一个 Worker
5. 永久不再使用该 Worker

```typescript
// 检测逻辑
if (response.includes('There is nothing here yet')) {
  workerPool.permanentlyDisable(workerId, 'not_deployed');
  // 立即跳过，不浪费重试机会
}
```

### Q3: 是否每个域名都检查 Worker 池？

**A:** **不是！** 为了性能优化，策略选择只在任务开始时执行一次：

```
任务开始 (10,000 个 URL)
    ↓
【仅一次】检查 Worker 池状态
    ↓
选择策略：Worker 或 Local
    ↓
使用选定的策略扫描所有 10,000 个 URL
```

**原因**：
- ✅ 减少开销（不需要 10,000 次检查）
- ✅ 保持一致性（整个任务使用同一策略）
- ✅ 简化逻辑（避免频繁切换）

**但是**：在批次级别有故障转移
- Worker 策略：每 10 个 URL 一批
- 如果某批失败 → 尝试下一个 Worker
- 如果所有 Worker 都失败 → 该批使用本地扫描

## 🔄 完整执行流程

### 场景 1：Worker 可用

```
任务开始
  ↓
检查 Worker 池
  ├─ Worker 1: ✓ 健康, 1,234/100,000
  ├─ Worker 2: ✗ 已封禁 (account blocked)
  └─ Worker 3: ✓ 健康, 98,500/100,000
  ↓
选择 Worker 策略
  ↓
批次 1 (URL 1-10)
  → 发送到 Worker 1
  → ✓ 成功
  → Worker 1: 1,244/100,000
  ↓
批次 2 (URL 11-20)
  → 发送到 Worker 3 (轮询)
  → ✓ 成功
  → Worker 3: 98,510/100,000
  ↓
批次 3 (URL 21-30)
  → 发送到 Worker 1 (轮询)
  → ✗ 返回 "There is nothing here yet"
  → 🚫 永久禁用 Worker 1
  → ↻ 立即重试 → Worker 3
  → ✓ 成功
  ↓
继续...直到所有 URL 完成
```

### 场景 2：Worker 不可用

```
任务开始
  ↓
检查 Worker 池
  ├─ Worker 1: ✗ 已封禁
  ├─ Worker 2: ✗ 配额耗尽 (100,000/100,000)
  └─ Worker 3: ✗ 不健康 (错误率 75%)
  ↓
没有可用 Worker
  ↓
选择本地策略
  ↓
URL 1-50 (并发)
  → 直接 HTTP 请求
  → ✓ 完成
  ↓
URL 51-100 (并发)
  → 直接 HTTP 请求
  → ✓ 完成
  ↓
继续...直到所有 URL 完成
```

### 场景 3：Worker 配额耗尽

```
批次 100 (URL 991-1000)
  → 发送到 Worker 3
  → ✓ 成功
  → Worker 3: 100,000/100,000 (配额耗尽!)
  ↓
批次 101 (URL 1001-1010)
  → 尝试选择 Worker
  → Worker 3 被排除 (配额耗尽)
  → 只剩 Worker 1 可用
  → 发送到 Worker 1
  → ✓ 成功
  ↓
第二天 00:00 UTC
  → 自动重置 Worker 3: 0/100,000
  → Worker 3 重新可用
```

## 🎯 关键特性

### 1. 智能故障转移
- ✅ Worker 优先
- ✅ 自动降级到本地
- ✅ 批次级别重试
- ✅ 不丢失任何 URL

### 2. 配额管理
- ✅ 实时追踪使用量
- ✅ 自动排除耗尽的 Worker
- ✅ 每日自动重置
- ✅ 可配置限额

### 3. 封禁检测
- ✅ 检测特定错误消息
- ✅ 永久禁用问题 Worker
- ✅ 保存到数据库持久化
- ✅ 不浪费重试机会

### 4. 负载均衡
- ✅ Round-robin 轮询
- ✅ 只选择健康 Worker
- ✅ 考虑配额剩余
- ✅ 避免速率限制

### 5. 批量优化
- ✅ 10 个 URL 一批
- ✅ 减少 API 调用
- ✅ 提高吞吐量
- ✅ 符合 Worker API 规范

## 📊 性能对比

### Worker 模式
```
10,000 URLs ÷ 10 (batch) = 1,000 requests
3 Workers × 1 req/sec = 3 req/sec
1,000 ÷ 3 ≈ 333 seconds (5.5 分钟)

优点：
- 分布式负载
- 不占用服务器资源
- 绕过 IP 限制

缺点：
- 受 Worker 配额限制
- 网络延迟较高
```

### 本地模式
```
10,000 URLs ÷ 50 (concurrency) = 200 batches
200 batches × 1 sec = 200 seconds (3.3 分钟)

优点：
- 速度更快
- 无配额限制
- 延迟更低

缺点：
- 占用服务器资源
- 可能被目标站点限制
```

## 🔧 配置示例

```json
{
  "worker_urls": [
    "https://scanner1.your-domain.workers.dev",
    "https://scanner2.your-domain.workers.dev",
    "https://scanner3.your-domain.workers.dev"
  ],
  "worker_batch_size": 10,
  "worker_timeout": 10000,
  "worker_daily_quota": 100000,
  "enable_worker_mode": true,
  "worker_disabled_list": [
    {
      "url": "https://old-worker.workers.dev",
      "reason": "account_blocked",
      "disabledAt": "2025-01-15T08:30:00Z"
    }
  ]
}
```

## 📝 日志示例

```
[Task 123] Starting scan with 10,000 URLs
[Task 123] Checking Worker pool...
[Task 123] Found 3 Workers: 2 healthy, 1 disabled
[Task 123] Using worker strategy

[Scanner] Using Worker worker1 (1,234/100,000 used)
[Scanner] Batch 1-10 completed in 1.2s
[Scanner] Using Worker worker2 (5,678/100,000 used)
[Scanner] Batch 11-20 completed in 0.9s

[Scanner] Worker worker1 is blocked: account has been blocked
[WorkerPool] Permanently disabled worker1 (reason: account_blocked)
[Scanner] Retrying batch with worker3...
[Scanner] Batch 21-30 completed in 1.1s

[WorkerPool] Worker worker3 quota exhausted (100,000/100,000)
[Scanner] Using Worker worker2 (5,688/100,000 used)

[Task 123] Scan completed: 10,000 URLs, 9,500 hits
[Task 123] Worker requests: 9,980, Local requests: 20
```

## ✅ 总结

这个方案实现了：

1. **优先使用 Worker**：充分利用 Cloudflare 的分布式能力
2. **智能故障转移**：Worker 失败时自动切换到本地
3. **配额管理**：严格控制每日请求量，避免超限
4. **封禁检测**：自动识别并永久禁用问题 Worker
5. **性能优化**：批量请求减少 API 调用
6. **可靠性保证**：确保所有 URL 都被扫描，不丢失数据

**策略选择时机**：任务开始时一次性选择，不是每个 URL 都检查，提高性能。
