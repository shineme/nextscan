# Implementation Plan - Worker Failover Mechanism

## Task List

- [x] 1. Implement Worker Pool Management


  - Create `web/src/lib/worker-pool.ts` with WorkerPool class
  - Implement Worker endpoint tracking with health status
  - Implement round-robin selection algorithm
  - Implement quota tracking and daily reset logic
  - Implement permanent disable functionality
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.6, 2.7, 2.8, 9.6, 9.7, 9.8_



- [ ] 1.1 Write property test for Worker selection
  - **Property 1: Worker Selection Consistency**


  - **Validates: Requirements 3.2**



- [x] 1.2 Write property test for quota enforcement



  - **Property 9: Quota Enforcement**
  - **Validates: Requirements 9.6, 9.7**

- [ ] 1.3 Write property test for quota reset
  - **Property 11: Quota Reset**
  - **Validates: Requirements 9.8**



- [ ] 2. Implement Worker Client
  - Create `web/src/lib/worker-client.ts` with WorkerClient class

  - Implement batch request formatting (POST with JSON body)
  - Implement response parsing to ScanResponse format
  - Implement block detection logic (check for error strings)
  - Implement health check endpoint
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 12.1, 12.2_

- [ ] 2.1 Write property test for block detection
  - **Property 10: Permanent Disable Detection**
  - **Validates: Requirements 2.6, 2.7, 2.8**

- [ ] 2.2 Write property test for response parsing
  - **Property 6: Response Format Compatibility**
  - **Validates: Requirements 7.1, 7.2**

- [x] 3. Implement Scan Strategy Pattern


  - Create `web/src/lib/scan-strategy.ts` with ScanStrategy interface
  - Implement WorkerScanStrategy class
  - Implement batch splitting logic (configurable batch size, default 10)
  - Implement retry logic with Worker failover
  - Refactor existing code into LocalScanStrategy class
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 8.1, 8.2, 8.3, 8.4_


- [ ] 3.1 Write property test for batch size limit
  - **Property 3: Batch Size Limit**
  - **Validates: Requirements 4.1, 6.2**


- [ ] 3.2 Write property test for failover guarantee
  - **Property 2: Failover Guarantee**

  - **Validates: Requirements 5.1, 5.2**

- [x] 3.3 Write property test for result completeness

  - **Property 5: Result Completeness**
  - **Validates: Requirements 11.1, 11.3**


- [ ] 3.4 Write property test for error recovery
  - **Property 7: Error Recovery**
  - **Validates: Requirements 8.1, 8.4**

- [x] 4. Add Worker Configuration to Database

  - Add migration script for new settings entries
  - Add `worker_urls` setting (JSON array)
  - Add `worker_batch_size` setting (default: 10)
  - Add `worker_timeout` setting (default: 10000)
  - Add `enable_worker_mode` setting (default: false)
  - Add `worker_daily_quota` setting (default: 100000)
  - Add `worker_disabled_list` setting (JSON array)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_












- [ ] 5. Integrate Worker Strategy into Scanner Service
  - Modify `web/src/lib/scanner-service.ts` to load Worker configuration

  - Initialize WorkerPool, WorkerClient, and strategies in constructor


  - Implement strategy selection logic (check Worker availability once at task start)
  - Replace existing scanning logic with strategy pattern

  - Add logging for strategy selection and Worker usage
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3_



- [ ] 6. Implement Quota Reset Scheduler
  - Create scheduled job to reset Worker quotas at midnight UTC
  - Call `workerPool.resetDailyQuotas()` daily
  - Add logging for quota reset events
  - _Requirements: 9.8_


- [ ] 7. Add Worker Settings UI
  - Modify `web/src/components/SettingsView.tsx` to add Worker configuration section


  - Add toggle for "Enable Worker Mode"
  - Add text area for Worker URLs (one per line)

  - Add slider for batch size (1-10, default 10)
  - Add input for Worker timeout (milliseconds)
  - Add input for daily quota per Worker
  - Add display for disabled Workers list with reasons



  - Add button to manually re-enable disabled Workers
  - _Requirements: 9.1, 9.2_

- [ ] 8. Add Worker Status Display
  - Add Worker pool status section to dashboard



  - Show each Worker's health status (healthy/unhealthy/disabled)


  - Show each Worker's daily usage (e.g., "1,234 / 100,000")


  - Show quota reset countdown
  - Show disabled Workers with reasons
  - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [ ] 9. Add API Endpoints for Worker Management
  - Create `web/src/app/api/workers/status/route.ts` - Get Worker pool status
  - Create `web/src/app/api/workers/reset/route.ts` - Manually reset a Worker's quota


  - Create `web/src/app/api/workers/enable/route.ts` - Re-enable a disabled Worker
  - Create `web/src/app/api/workers/test/route.ts` - Test a Worker endpoint
  - _Requirements: 1.4, 1.5, 9.2_

- [ ] 10. Add Comprehensive Logging
  - Log strategy selection (Worker vs Local)
  - Log Worker selection for each batch
  - Log Worker health changes (healthy → unhealthy → recovered)
  - Log Worker permanent disables with reasons
  - Log quota exhaustion events
  - Log failover events
  - Log scan completion statistics (Worker vs Local request counts)



  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Add Error Handling and Edge Cases
  - Handle Worker URL validation (must be HTTPS)
  - Handle invalid Worker responses gracefully
  - Handle network timeouts with proper error messages
  - Handle empty Worker pool (all disabled)
  - Handle configuration reload without restart
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.2_

- [ ] 12.1 Write unit tests for error scenarios
  - Test Worker unavailable
  - Test Worker rate limited
  - Test Worker blocked
  - Test all Workers failed
  - Test batch partial failure
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 13. Performance Optimization
  - Implement connection pooling for Worker requests
  - Add request caching for frequently scanned URLs (optional)
  - Optimize batch splitting algorithm
  - Add metrics collection for performance analysis
  - _Requirements: 10.1_

- [ ] 14. Documentation and Migration Guide
  - Update README with Worker configuration instructions
  - Add example Worker URLs and setup guide
  - Document Worker API compatibility requirements
  - Add troubleshooting guide for common issues
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 15. Final Checkpoint - Integration Testing
  - Test full scan with Worker pool
  - Test failover when Workers fail
  - Test quota exhaustion and reset
  - Test block detection and permanent disable
  - Test configuration changes without restart
  - Ensure all tests pass, ask the user if questions arise.
