# Requirements Document - Worker Failover Mechanism

## Introduction

The Worker Failover Mechanism implements a resilient scanning strategy that prioritizes Cloudflare Worker endpoints for HTTP probing, with automatic fallback to local scanning when Workers are exhausted, rate-limited, or unavailable. This ensures continuous scanning operations while optimizing for speed and cost-efficiency.

## Glossary

- **Worker**: Cloudflare Worker endpoint that performs HTTP HEAD/GET requests on behalf of the scanner
- **Worker Pool**: Collection of available Worker endpoints with health status tracking
- **Failover**: Automatic switching from Worker-based scanning to local scanning when Workers are unavailable
- **Health Check**: Periodic verification that a Worker endpoint is responsive and functional
- **Rate Limit**: Maximum number of requests a Worker can handle within a time window
- **Circuit Breaker**: Pattern that prevents repeated calls to a failing Worker
- **Local Scanning**: Direct HTTP requests from the Next.js server without using Workers
- **Batch Request**: Sending multiple URLs to a Worker in a single API call (up to 10 URLs per Worker API spec)

## Requirements

### Requirement 1: Worker Pool Management

**User Story:** As a system administrator, I want to configure multiple Worker endpoints, so that the system can distribute load and provide redundancy.

#### Acceptance Criteria

1. WHEN the system initializes THEN it SHALL load Worker endpoints from configuration
2. WHEN a Worker endpoint is added THEN the system SHALL validate its URL format
3. WHEN a Worker endpoint is added THEN the system SHALL perform an initial health check
4. WHEN a Worker fails health checks THEN the system SHALL mark it as unavailable
5. WHEN an unavailable Worker recovers THEN the system SHALL mark it as available again

### Requirement 2: Worker Health Monitoring

**User Story:** As a system operator, I want Workers to be continuously monitored, so that unhealthy Workers are automatically excluded from the pool.

#### Acceptance Criteria

1. WHEN a Worker is in the pool THEN the system SHALL track its success rate
2. WHEN a Worker's error rate exceeds 50% THEN the system SHALL mark it as unhealthy
3. WHEN a Worker is marked unhealthy THEN the system SHALL exclude it from selection for 5 minutes
4. WHEN the cooldown period expires THEN the system SHALL attempt to use the Worker again
5. WHEN a Worker returns 429 (rate limit) THEN the system SHALL mark it as exhausted temporarily
6. WHEN a Worker response contains "There is nothing here yet" THEN the system SHALL permanently disable that Worker
7. WHEN a Worker response contains "account has been blocked" THEN the system SHALL permanently disable that Worker
8. WHEN a Worker is permanently disabled THEN the system SHALL never attempt to use it again

### Requirement 3: Worker Selection Strategy

**User Story:** As a system architect, I want intelligent Worker selection, so that load is distributed evenly and healthy Workers are prioritized.

#### Acceptance Criteria

1. WHEN selecting a Worker THEN the system SHALL only consider healthy Workers
2. WHEN multiple healthy Workers exist THEN the system SHALL use round-robin selection
3. WHEN all Workers are unhealthy THEN the system SHALL fall back to local scanning
4. WHEN a Worker is selected THEN the system SHALL track the request count
5. WHEN a Worker reaches its rate limit THEN the system SHALL skip it for the next selection

### Requirement 4: Batch Request Optimization

**User Story:** As a performance engineer, I want to batch multiple URLs into single Worker requests, so that we minimize API calls and improve throughput.

#### Acceptance Criteria

1. WHEN scanning multiple URLs THEN the system SHALL group them into batches of up to 10 URLs
2. WHEN sending a batch to a Worker THEN the system SHALL use the Worker's batch API endpoint
3. WHEN a batch request fails THEN the system SHALL retry individual URLs from that batch
4. WHEN a batch request succeeds THEN the system SHALL extract individual results
5. WHEN batching is disabled THEN the system SHALL send one URL per request

### Requirement 5: Automatic Failover to Local Scanning

**User Story:** As a system operator, I want automatic failover to local scanning, so that scanning continues even when all Workers are unavailable.

#### Acceptance Criteria

1. WHEN all Workers are unavailable THEN the system SHALL switch to local scanning mode
2. WHEN in local scanning mode THEN the system SHALL use the existing http-client implementation
3. WHEN Workers become available again THEN the system SHALL switch back to Worker mode
4. WHEN failover occurs THEN the system SHALL log the event with reason
5. WHEN in local mode THEN the system SHALL continue to monitor Worker health

### Requirement 6: Worker Request Format

**User Story:** As a developer, I want to properly format Worker API requests, so that they conform to the Worker API specification.

#### Acceptance Criteria

1. WHEN sending a request to a Worker THEN the system SHALL use POST method with JSON body
2. WHEN sending a batch THEN the request body SHALL include `urls` array (max 10 items)
3. WHEN configuring the request THEN the system SHALL set `method` to "head"
4. WHEN configuring the request THEN the system SHALL set `timeout` based on task configuration
5. WHEN configuring the request THEN the system SHALL set `retry` to 2

### Requirement 7: Worker Response Parsing

**User Story:** As a developer, I want to parse Worker responses correctly, so that scan results are accurately recorded.

#### Acceptance Criteria

1. WHEN a Worker returns a response THEN the system SHALL parse the JSON structure
2. WHEN parsing results THEN the system SHALL extract `status`, `summary.contentType`, and `summary.contentLengthBytes`
3. WHEN a URL in the batch fails THEN the system SHALL mark it with error status
4. WHEN a Worker returns 200 but individual URL fails THEN the system SHALL handle it gracefully
5. WHEN response parsing fails THEN the system SHALL fall back to local scanning for that batch

### Requirement 8: Error Handling and Retry Logic

**User Story:** As a system operator, I want robust error handling, so that transient failures don't cause scanning to stop.

#### Acceptance Criteria

1. WHEN a Worker request times out THEN the system SHALL retry with the next available Worker
2. WHEN a Worker returns 5xx error THEN the system SHALL mark it as unhealthy
3. WHEN a Worker returns 429 THEN the system SHALL mark it as rate-limited for 60 seconds
4. WHEN all retry attempts fail THEN the system SHALL fall back to local scanning
5. WHEN a network error occurs THEN the system SHALL log the error and try the next Worker

### Requirement 9: Configuration Management

**User Story:** As a system administrator, I want to configure Worker settings, so that I can optimize performance and cost.

#### Acceptance Criteria

1. WHEN the system starts THEN it SHALL load Worker URLs from the settings table
2. WHEN Worker configuration changes THEN the system SHALL reload the Worker pool
3. WHEN batch size is configured THEN the system SHALL respect the maximum of 10 URLs
4. WHEN Worker timeout is configured THEN the system SHALL use it for all Worker requests
5. WHEN Worker mode is disabled THEN the system SHALL use local scanning exclusively
6. WHEN a Worker is configured THEN the system SHALL track its daily request quota (default 100,000)
7. WHEN a Worker's daily quota is exhausted THEN the system SHALL exclude it until the next day
8. WHEN a new day begins THEN the system SHALL reset all Workers' daily request counters

### Requirement 10: Performance Metrics and Logging

**User Story:** As a system operator, I want visibility into Worker performance, so that I can optimize the configuration.

#### Acceptance Criteria

1. WHEN a Worker request completes THEN the system SHALL log the response time
2. WHEN failover occurs THEN the system SHALL log the reason and timestamp
3. WHEN a Worker is marked unhealthy THEN the system SHALL log the error rate
4. WHEN scanning completes THEN the system SHALL report Worker vs local request counts
5. WHEN a Worker recovers THEN the system SHALL log the recovery event

### Requirement 11: Graceful Degradation

**User Story:** As a user, I want scanning to continue smoothly, so that I don't notice when Workers fail.

#### Acceptance Criteria

1. WHEN Workers fail THEN the scanning progress SHALL continue without interruption
2. WHEN switching to local mode THEN the scan speed MAY decrease but SHALL not stop
3. WHEN a Worker fails mid-batch THEN the system SHALL complete the batch using another method
4. WHEN all Workers are exhausted THEN the system SHALL inform the user via logs
5. WHEN Workers recover THEN the system SHALL automatically resume using them

### Requirement 12: Worker API Compatibility

**User Story:** As a developer, I want to ensure compatibility with the Worker API spec, so that requests are handled correctly.

#### Acceptance Criteria

1. WHEN sending requests THEN the system SHALL follow the Worker API specification from cloudworker_api.md
2. WHEN parsing responses THEN the system SHALL handle all documented response formats
3. WHEN a Worker returns redirect information THEN the system SHALL record the final URL
4. WHEN a Worker returns timing information THEN the system SHALL log it for analysis
5. WHEN the Worker API version changes THEN the system SHALL remain backward compatible
