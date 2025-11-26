# Design Document - Worker Failover Mechanism

## Overview

This design implements a resilient HTTP scanning system that prioritizes Cloudflare Worker endpoints for probing URLs, with automatic failover to local scanning when Workers are unavailable. The system uses a health-monitored Worker pool, intelligent batch processing, and circuit breaker patterns to ensure continuous operation.

## Architecture

### High-Level Flow

**重要说明**：策略选择在任务开始时执行一次，而不是每个 URL 都检查。这样可以：
- 减少开销（不需要每次都检查 Worker 池状态）
- 保持一致性（整个任务使用同一种策略）
- 简化逻辑（避免频繁切换策略）

如果在扫描过程中 Worker 失败，会在批次级别进行重试和故障转移。

```
┌─────────────────────────────────────────────────────────────┐
│                     Scanner Service                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Get URLs to scan (10,000 URLs)                     │ │
│  │  2. Check Worker Pool availability (ONCE at start)     │ │
│  │  3. Select Strategy:                                   │ │
│  │     - If Workers available → Worker Strategy           │ │
│  │     - If no Workers → Local Strategy                   │ │
│  │  4. Execute entire scan with selected strategy         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼────────┐      ┌──────▼──────────┐
        │ Worker Strategy│      │ Local Strategy  │
        │                │      │                 │
        │ - Split into   │      │ - Direct fetch  │
        │   batches of 10│      │ - Concurrency   │
        │ - Round-robin  │      │   control       │
        │   Workers      │      │ - Existing impl │
        │ - Track quota  │      │                 │
        │ - Detect blocks│      │                 │
        └───────┬────────┘      └─────────────────┘
                │
        ┌───────▼────────┐
        │  Worker Pool   │
        │                │
        │ Worker 1:      │
        │  ✓ Healthy     │
        │  📊 1,234/100k │
        │                │
        │ Worker 2:      │
        │  ✗ Blocked     │
        │  🚫 Disabled   │
        │                │
        │ Worker 3:      │
        │  ✓ Healthy     │
        │  📊 98,500/100k│
        └────────────────┘
```

### Execution Flow Detail

```
Task Start (10,000 URLs)
    ↓
[ONE-TIME CHECK] Worker Pool Status
    ↓
┌─────────────────────────────────────┐
│ Has healthy Workers with quota?     │
│ - Not permanently disabled          │
│ - Not rate-limited                  │
│ - Daily quota not exhausted         │
└─────────────────────────────────────┘
    ↓
┌─────YES─────┐         ┌─────NO──────┐
│             │         │             │
▼             │         ▼             │
Worker Strategy        Local Strategy │
│                      │              │
├─ Batch 1-10          ├─ URL 1-50    │
│  → Worker 1          │  (concurrent) │
│  ✓ Success           │               │
│  📊 +10 quota        │               │
│                      │               │
├─ Batch 11-20         ├─ URL 51-100  │
│  → Worker 2          │  (concurrent) │
│  ✗ "account blocked" │               │
│  🚫 Disable Worker 2 │               │
│  ↻ Retry → Worker 3  │               │
│                      │               │
├─ Batch 21-30         ├─ URL 101-150 │
│  → Worker 3          │  (concurrent) │
│  ✓ Success           │               │
│  📊 +10 quota        │               │
│                      │               │
└─ Continue...         └─ Continue...  │
                                       │
Both strategies complete all URLs ────┘
```

### Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    scanner-service.ts                         │
│  - executeScan()                                             │
│  - Orchestrates Worker vs Local strategy                     │
└──────────────────┬───────────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼────────┐ ┌──▼──────────┐ ┌─▼─────────────┐
│worker-pool │ │worker-client│ │http-client    │
│            │ │             │ │               │
│- Workers[] │ │- sendBatch()│ │- fetchWith    │
│- health    │ │- sendSingle│ │  Timeout()    │
│- select()  │ │- parse()   │ │               │
└────────────┘ └─────────────┘ └───────────────┘
```

## Components and Interfaces

### 1. WorkerPool (worker-pool.ts)

Manages the collection of Worker endpoints with health monitoring.

```typescript
interface WorkerEndpoint {
  id: string;
  url: string;
  healthy: boolean;
  lastCheck: Date;
  errorCount: number;
  successCount: number;
  rateLimitedUntil: Date | null;
  consecutiveFailures: number;
  
  // Quota management
  dailyQuota: number; // Default: 100,000
  dailyUsage: number; // Requests made today
  quotaResetAt: Date; // Midnight UTC
  
  // Permanent disable flags
  permanentlyDisabled: boolean;
  disabledReason: string | null; // "blocked" | "not_deployed" | null
}

interface WorkerPoolConfig {
  healthCheckInterval: number; // milliseconds
  unhealthyThreshold: number; // error rate percentage
  cooldownPeriod: number; // milliseconds
  rateLimitCooldown: number; // milliseconds
}

class WorkerPool {
  private workers: WorkerEndpoint[];
  private currentIndex: number;
  private config: WorkerPoolConfig;
  
  constructor(workerUrls: string[], config: WorkerPoolConfig);
  
  // Get next healthy Worker (round-robin)
  selectWorker(): WorkerEndpoint | null;
  
  // Mark Worker as successful
  recordSuccess(workerId: string): void;
  
  // Mark Worker as failed
  recordFailure(workerId: string, error: Error): void;
  
  // Mark Worker as rate-limited
  recordRateLimit(workerId: string): void;
  
  // Permanently disable a Worker
  permanentlyDisable(workerId: string, reason: string): void;
  
  // Check and reset daily quotas (called at midnight)
  resetDailyQuotas(): void;
  
  // Increment daily usage counter
  incrementUsage(workerId: string, count: number): void;
  
  // Check if any Workers are available
  hasHealthyWorkers(): boolean;
  
  // Get pool statistics
  getStats(): WorkerPoolStats;
  
  // Manually add/remove Workers
  addWorker(url: string): void;
  removeWorker(workerId: string): void;
}
```

### 2. WorkerClient (worker-client.ts)

Handles communication with Worker API endpoints.

```typescript
interface WorkerRequest {
  urls: string[];
  method: 'head' | 'get';
  timeout: number;
  retry: number;
  preview?: boolean;
}

interface WorkerResponse {
  success: boolean;
  total: number;
  results: WorkerResult[];
  timestamp: string;
}

interface WorkerResult {
  url: string;
  method: string;
  success: boolean;
  status: number;
  responseTime?: string;
  summary?: {
    contentLength?: string;
    contentLengthBytes?: number;
    contentType?: string;
    supportResume?: boolean;
  };
  error?: string;
}

class WorkerClient {
  private timeout: number;
  
  constructor(timeout: number);
  
  // Send batch request to Worker
  async sendBatch(
    workerUrl: string,
    urls: string[],
    options: Partial<WorkerRequest>
  ): Promise<WorkerResponse>;
  
  // Check if response indicates Worker is blocked/disabled
  isWorkerBlocked(response: WorkerResponse | Error): boolean;
  
  // Extract block reason from response
  getBlockReason(response: WorkerResponse | Error): string | null;
  
  // Send single URL request
  async sendSingle(
    workerUrl: string,
    url: string,
    options: Partial<WorkerRequest>
  ): Promise<WorkerResult>;
  
  // Parse Worker response to ScanResponse format
  parseToScanResponse(result: WorkerResult): ScanResponse;
  
  // Health check a Worker endpoint
  async healthCheck(workerUrl: string): Promise<boolean>;
}
```

### 3. ScanStrategy (scan-strategy.ts)

Abstract strategy pattern for different scanning approaches.

```typescript
interface ScanStrategy {
  name: string;
  
  // Scan a batch of URLs
  scanBatch(
    urls: string[],
    onProgress?: (progress: BatchProgress) => void | Promise<void>
  ): Promise<ScanResponse[]>;
}

class WorkerScanStrategy implements ScanStrategy {
  name = 'worker';
  
  constructor(
    private workerPool: WorkerPool,
    private workerClient: WorkerClient,
    private batchSize: number,
    private timeout: number
  );
  
  async scanBatch(
    urls: string[],
    onProgress?: (progress: BatchProgress) => void | Promise<void>
  ): Promise<ScanResponse[]>;
}

class LocalScanStrategy implements ScanStrategy {
  name = 'local';
  
  constructor(
    private concurrencyController: ConcurrencyController
  );
  
  async scanBatch(
    urls: string[],
    onProgress?: (progress: BatchProgress) => void | Promise<void>
  ): Promise<ScanResponse[]>;
}
```

### 4. Enhanced Scanner Service

Modified scanner-service.ts to use strategies.

```typescript
class ScannerService {
  private workerPool: WorkerPool;
  private workerClient: WorkerClient;
  private workerStrategy: WorkerScanStrategy;
  private localStrategy: LocalScanStrategy;
  
  constructor() {
    // Initialize Worker pool from config
    const workerUrls = this.loadWorkerUrls();
    this.workerPool = new WorkerPool(workerUrls, {
      healthCheckInterval: 60000,
      unhealthyThreshold: 50,
      cooldownPeriod: 300000,
      rateLimitCooldown: 60000
    });
    
    this.workerClient = new WorkerClient(10000);
    this.workerStrategy = new WorkerScanStrategy(
      this.workerPool,
      this.workerClient,
      10, // batch size
      10000 // timeout
    );
    this.localStrategy = new LocalScanStrategy(
      createConcurrencyController(50, 10000)
    );
  }
  
  async executeScan(taskId: number): Promise<void> {
    // ... existing setup code ...
    
    // Select strategy based on Worker availability
    const strategy = this.selectStrategy();
    
    console.log(`[Task ${taskId}] Using ${strategy.name} strategy`);
    
    // Execute scan with selected strategy
    const results = await strategy.scanBatch(urlList, async (progress) => {
      // ... existing progress handling ...
    });
    
    // ... existing result processing ...
  }
  
  private selectStrategy(): ScanStrategy {
    if (this.workerPool.hasHealthyWorkers()) {
      return this.workerStrategy;
    }
    
    console.log('[Scanner] No healthy Workers available, falling back to local scanning');
    return this.localStrategy;
  }
  
  private loadWorkerUrls(): string[] {
    const stmt = db.prepare(
      'SELECT value FROM settings WHERE key = ?'
    );
    const result = stmt.get('worker_urls') as { value: string } | undefined;
    
    if (!result || !result.value) {
      return [];
    }
    
    try {
      return JSON.parse(result.value);
    } catch {
      return [];
    }
  }
}
```

## Data Models

### Database Schema Changes

Add Worker configuration to settings table:

```sql
-- Worker URLs (JSON array of strings)
INSERT INTO settings (key, value) VALUES 
  ('worker_urls', '["https://worker1.workers.dev", "https://worker2.workers.dev"]');

-- Worker batch size (1-10)
INSERT INTO settings (key, value) VALUES 
  ('worker_batch_size', '10');

-- Worker timeout (milliseconds)
INSERT INTO settings (key, value) VALUES 
  ('worker_timeout', '10000');

-- Enable/disable Worker mode
INSERT INTO settings (key, value) VALUES 
  ('enable_worker_mode', 'true');

-- Daily quota per Worker (default 100,000)
INSERT INTO settings (key, value) VALUES 
  ('worker_daily_quota', '100000');

-- Permanently disabled Workers (JSON array of objects)
-- Format: [{"url": "https://worker1.dev", "reason": "account_blocked", "disabledAt": "2025-01-01T00:00:00Z"}]
INSERT INTO settings (key, value) VALUES 
  ('worker_disabled_list', '[]');
```

### In-Memory State

```typescript
// Worker health state (not persisted, except disabled list)
interface WorkerState {
  endpoints: Map<string, WorkerEndpoint>;
  stats: {
    totalRequests: number;
    workerRequests: number;
    localRequests: number;
    failoverCount: number;
  };
  lastQuotaReset: Date; // Track when we last reset quotas
}

// Persisted disabled Workers (saved to settings table)
interface DisabledWorker {
  url: string;
  reason: 'account_blocked' | 'not_deployed' | 'manual';
  disabledAt: string; // ISO 8601
  lastError?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Worker Selection Consistency

*For any* Worker pool with at least one healthy Worker, calling `selectWorker()` multiple times should cycle through all healthy Workers in round-robin order before repeating.

**Validates: Requirements 3.2**

### Property 2: Failover Guarantee

*For any* scanning operation, if all Workers are unhealthy, the system should complete the scan using local strategy without throwing errors.

**Validates: Requirements 5.1, 5.2**

### Property 3: Batch Size Limit

*For any* batch sent to a Worker, the number of URLs should never exceed 10, regardless of input size.

**Validates: Requirements 4.1, 6.2**

### Property 4: Health State Consistency

*For any* Worker that returns a 429 status code, the Worker should be marked as rate-limited and excluded from selection for at least 60 seconds.

**Validates: Requirements 2.5, 8.3**

### Property 5: Result Completeness

*For any* list of URLs to scan, the number of results returned should equal the number of input URLs, regardless of which strategy is used.

**Validates: Requirements 11.1, 11.3**

### Property 6: Response Format Compatibility

*For any* Worker response, parsing it to `ScanResponse` format should preserve the essential fields: url, status, contentType, and size.

**Validates: Requirements 7.1, 7.2**

### Property 7: Error Recovery

*For any* Worker request that fails, the system should attempt the request with a different Worker or fall back to local scanning, ensuring no URLs are lost.

**Validates: Requirements 8.1, 8.4**

### Property 8: Configuration Reload

*For any* change to Worker URLs in the settings table, reloading the configuration should update the Worker pool without requiring a server restart.

**Validates: Requirements 9.2**

### Property 9: Quota Enforcement

*For any* Worker, the total number of requests sent to it in a single day should never exceed its configured daily quota (default 100,000).

**Validates: Requirements 9.6, 9.7**

### Property 10: Permanent Disable Detection

*For any* Worker response containing "There is nothing here yet" or "account has been blocked", the Worker should be immediately and permanently disabled without counting against retry attempts.

**Validates: Requirements 2.6, 2.7, 2.8**

### Property 11: Quota Reset

*For any* Worker at midnight UTC, its daily usage counter should be reset to 0 and it should become available for selection again (if not permanently disabled).

**Validates: Requirements 9.8**

## Error Handling

### Error Categories

1. **Worker Permanently Blocked** (NEW - Highest Priority)
   - Response body contains "There is nothing here yet"
   - Response body contains "account has been blocked"
   - Action: Permanently disable Worker, never use again, try next Worker

2. **Worker Quota Exhausted** (NEW)
   - Daily usage >= 100,000 requests
   - Action: Exclude Worker until next day (midnight UTC reset)

3. **Worker Unavailable**
   - Network timeout
   - Connection refused
   - DNS resolution failure
   - Action: Mark Worker unhealthy, try next Worker

4. **Worker Rate Limited**
   - HTTP 429 response
   - Action: Mark Worker as rate-limited for 60 seconds, try next Worker

5. **Worker Error**
   - HTTP 5xx response
   - Invalid response format
   - Action: Mark Worker unhealthy, try next Worker

6. **All Workers Failed**
   - No healthy Workers available
   - Action: Fall back to local scanning strategy

7. **Batch Partial Failure**
   - Some URLs in batch failed
   - Action: Record individual failures, continue with remaining URLs

### Retry Logic with Block Detection

```typescript
async function scanWithRetry(
  urls: string[],
  maxRetries: number = 3
): Promise<ScanResponse[]> {
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt < maxRetries) {
    try {
      const worker = workerPool.selectWorker();
      
      if (!worker) {
        // No Workers available, use local
        console.log('[Scanner] No healthy Workers, falling back to local');
        return await localStrategy.scanBatch(urls);
      }
      
      console.log(`[Scanner] Using Worker ${worker.id} (${worker.dailyUsage}/${worker.dailyQuota} used)`);
      
      const results = await workerClient.sendBatch(
        worker.url,
        urls,
        { method: 'head', timeout: 10000, retry: 2 }
      );
      
      // Check for block indicators in response
      if (workerClient.isWorkerBlocked(results)) {
        const reason = workerClient.getBlockReason(results);
        console.error(`[Scanner] Worker ${worker.id} is blocked: ${reason}`);
        workerPool.permanentlyDisable(worker.id, reason || 'blocked');
        
        // Don't count as retry, immediately try next Worker
        continue;
      }
      
      // Success - record usage and return results
      workerPool.recordSuccess(worker.id);
      workerPool.incrementUsage(worker.id, urls.length);
      
      return results.results.map(r => 
        workerClient.parseToScanResponse(r)
      );
      
    } catch (error) {
      lastError = error as Error;
      attempt++;
      
      if (worker) {
        // Check if error message indicates block
        if (workerClient.isWorkerBlocked(error)) {
          const reason = workerClient.getBlockReason(error);
          console.error(`[Scanner] Worker ${worker.id} is blocked: ${reason}`);
          workerPool.permanentlyDisable(worker.id, reason || 'blocked');
          
          // Don't count as retry, immediately try next Worker
          attempt--;
          continue;
        }
        
        workerPool.recordFailure(worker.id, error as Error);
      }
      
      if (attempt >= maxRetries) {
        // All retries exhausted, fall back to local
        console.log('[Scanner] All Worker retries failed, using local scanning');
        return await localStrategy.scanBatch(urls);
      }
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Scan failed');
}
```

### Block Detection Implementation

```typescript
class WorkerClient {
  // Check if response indicates Worker is blocked
  isWorkerBlocked(response: WorkerResponse | Error): boolean {
    if (response instanceof Error) {
      const message = response.message.toLowerCase();
      return message.includes('there is nothing here yet') ||
             message.includes('account has been blocked');
    }
    
    // Check response body or error messages in results
    if (!response.success) {
      const errorText = JSON.stringify(response).toLowerCase();
      return errorText.includes('there is nothing here yet') ||
             errorText.includes('account has been blocked');
    }
    
    // Check individual result errors
    for (const result of response.results) {
      if (result.error) {
        const errorLower = result.error.toLowerCase();
        if (errorLower.includes('there is nothing here yet') ||
            errorLower.includes('account has been blocked')) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  getBlockReason(response: WorkerResponse | Error): string | null {
    const text = response instanceof Error 
      ? response.message 
      : JSON.stringify(response);
    
    const lower = text.toLowerCase();
    
    if (lower.includes('there is nothing here yet')) {
      return 'not_deployed';
    }
    
    if (lower.includes('account has been blocked')) {
      return 'account_blocked';
    }
    
    return null;
  }
}
```

### Quota Management Implementation

```typescript
class WorkerPool {
  // Called by a scheduled job at midnight UTC
  resetDailyQuotas(): void {
    const now = new Date();
    
    for (const worker of this.workers) {
      // Check if it's a new day
      if (now >= worker.quotaResetAt) {
        worker.dailyUsage = 0;
        worker.quotaResetAt = this.getNextMidnight();
        
        console.log(`[WorkerPool] Reset quota for ${worker.id}`);
      }
    }
  }
  
  incrementUsage(workerId: string, count: number): void {
    const worker = this.workers.find(w => w.id === workerId);
    if (!worker) return;
    
    worker.dailyUsage += count;
    
    // Check if quota exhausted
    if (worker.dailyUsage >= worker.dailyQuota) {
      console.warn(`[WorkerPool] Worker ${workerId} quota exhausted (${worker.dailyUsage}/${worker.dailyQuota})`);
      worker.healthy = false; // Temporarily mark unhealthy
    }
  }
  
  selectWorker(): WorkerEndpoint | null {
    const availableWorkers = this.workers.filter(w => 
      !w.permanentlyDisabled &&           // Not blocked
      w.healthy &&                        // Healthy
      w.dailyUsage < w.dailyQuota &&      // Has quota remaining
      (!w.rateLimitedUntil || w.rateLimitedUntil < new Date()) // Not rate-limited
    );
    
    if (availableWorkers.length === 0) {
      return null;
    }
    
    // Round-robin selection
    const worker = availableWorkers[this.currentIndex % availableWorkers.length];
    this.currentIndex++;
    
    return worker;
  }
  
  private getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }
}
```

## Testing Strategy

### Unit Tests

1. **WorkerPool Tests**
   - Test round-robin selection
   - Test health state transitions
   - Test rate limit handling
   - Test cooldown periods

2. **WorkerClient Tests**
   - Test batch request formatting
   - Test response parsing
   - Test error handling
   - Test timeout behavior

3. **Strategy Tests**
   - Test Worker strategy with healthy pool
   - Test fallback to local strategy
   - Test batch splitting logic

### Property-Based Tests

1. **Property Test: Worker Selection**
   - Generate random Worker pools
   - Verify round-robin order
   - Verify only healthy Workers are selected

2. **Property Test: Batch Size**
   - Generate random URL lists (1-1000 URLs)
   - Verify all batches ≤ 10 URLs
   - Verify all URLs are included

3. **Property Test: Failover**
   - Generate random failure scenarios
   - Verify scanning always completes
   - Verify result count matches input count

4. **Property Test: Response Parsing**
   - Generate random Worker responses
   - Verify parsing preserves essential data
   - Verify invalid responses are handled

### Integration Tests

1. Test full scan with Worker pool
2. Test failover when Workers fail
3. Test recovery when Workers come back online
4. Test configuration reload

## Performance Considerations

### Batch Optimization

- **Worker Mode**: 10 URLs per request → 10x fewer HTTP calls
- **Local Mode**: 1 URL per request → Higher concurrency needed

### Expected Performance

```
Scenario: 10,000 URLs, 3 Workers, batch size 10

Worker Mode:
- Total batches: 10,000 / 10 = 1,000 batches
- Per Worker: ~333 batches
- Time: ~333 seconds (assuming 1 req/sec per Worker)

Local Mode:
- Concurrency: 50
- Time: 10,000 / 50 = 200 seconds

Conclusion: Worker mode is slower but offloads work from server
```

### Optimization Strategies

1. **Adaptive Batch Size**: Reduce batch size if Worker latency is high
2. **Parallel Workers**: Send batches to multiple Workers simultaneously
3. **Hybrid Mode**: Use Workers for first N URLs, then switch to local if too slow

## Configuration

### Settings UI

Add Worker configuration section to SettingsView:

```typescript
// Worker Configuration
- Enable Worker Mode: [Toggle]
- Worker URLs: [Text Area, one per line]
- Batch Size: [Slider 1-10]
- Worker Timeout: [Input, milliseconds]
- Health Check Interval: [Input, seconds]
```

### Default Configuration

```typescript
const DEFAULT_CONFIG = {
  enableWorkerMode: false, // Disabled by default
  workerUrls: [],
  batchSize: 10,
  workerTimeout: 10000,
  healthCheckInterval: 60000,
  unhealthyThreshold: 50,
  cooldownPeriod: 300000,
  rateLimitCooldown: 60000
};
```

## Migration Plan

### Phase 1: Core Implementation
1. Implement WorkerPool class
2. Implement WorkerClient class
3. Add Worker configuration to settings

### Phase 2: Strategy Pattern
1. Create ScanStrategy interface
2. Implement WorkerScanStrategy
3. Refactor LocalScanStrategy from existing code

### Phase 3: Integration
1. Modify scanner-service to use strategies
2. Add strategy selection logic
3. Add logging and metrics

### Phase 4: UI and Configuration
1. Add Worker settings to SettingsView
2. Add Worker status display
3. Add failover notifications

### Phase 5: Testing and Optimization
1. Write unit tests
2. Write property-based tests
3. Performance testing and tuning

## Monitoring and Observability

### Metrics to Track

```typescript
interface ScanMetrics {
  totalScans: number;
  workerScans: number;
  localScans: number;
  failoverCount: number;
  avgWorkerResponseTime: number;
  avgLocalResponseTime: number;
  workerErrorRate: number;
}
```

### Logging

```typescript
// Strategy selection
console.log('[Scanner] Using worker strategy (3 healthy Workers)');
console.log('[Scanner] Falling back to local strategy (no Workers available)');

// Worker health
console.log('[Worker] worker1.workers.dev marked unhealthy (error rate: 75%)');
console.log('[Worker] worker2.workers.dev recovered (error rate: 10%)');

// Performance
console.log('[Worker] Batch completed in 1.2s (10 URLs)');
console.log('[Local] Batch completed in 0.8s (50 URLs)');
```

## Security Considerations

1. **Worker URL Validation**: Ensure only HTTPS URLs are accepted
2. **Rate Limiting**: Respect Worker rate limits to avoid bans
3. **Error Information**: Don't expose sensitive error details to clients
4. **Configuration Access**: Restrict Worker URL configuration to admins

## Future Enhancements

1. **Dynamic Worker Discovery**: Auto-discover Workers from a registry
2. **Load Balancing**: Weighted round-robin based on Worker performance
3. **Caching**: Cache Worker responses for frequently scanned URLs
4. **Analytics**: Track which Workers perform best for different URL types
5. **Cost Tracking**: Monitor Worker usage for billing purposes
