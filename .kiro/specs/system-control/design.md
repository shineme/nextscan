# Design Document

## Overview

This document describes the design for system control features that enable administrators to manage domain assets and control automation behavior. The design includes two main features:

1. **Clear All Domains**: A one-click operation to remove all domain records from the database
2. **Automation Control**: A toggle mechanism to pause and resume automated scanning operations

These features integrate with the existing NextScan architecture, leveraging the configuration service for state persistence and the automation scheduler for controlling automated tasks.

## Architecture

The system control features follow a layered architecture:

```
┌─────────────────────────────────────────┐
│         Dashboard UI Layer              │
│  (DashboardApp.tsx)                     │
└──────────────┬──────────────────────────┘
               │
               ├─ Clear All Button
               └─ Automation Toggle Button
               │
┌──────────────▼──────────────────────────┐
│           API Layer                      │
│  - /api/domains/clear-all (DELETE)      │
│  - /api/automation (GET/POST)           │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        Service Layer                     │
│  - AutomationController                  │
│  - ConfigService                         │
│  - Database Service                      │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Data Persistence Layer              │
│  - SQLite Database (domains table)       │
│  - SQLite Database (settings table)      │
└──────────────────────────────────────────┘
```

## Components and Interfaces

### 1. AutomationController

A service class that manages the global automation state.

```typescript
interface AutomationStatus {
  enabled: boolean;
  lastPaused?: string;
  uptime?: number;
}

class AutomationController {
  isEnabled(): boolean;
  enable(): void;
  disable(): void;
  toggle(): boolean;
  getStatus(): AutomationStatus;
  shouldRun(): boolean;
}
```

**Responsibilities:**
- Manage automation enabled/disabled state
- Persist state to configuration storage
- Provide status information including last pause timestamp
- Determine if automated operations should execute

### 2. API Endpoints

#### DELETE /api/domains/clear-all

Deletes all domain records from the database.

**Request:** None

**Response:**
```typescript
{
  success: boolean;
  message: string;
  deletedCount: number;
}
```

**Error Response:**
```typescript
{
  success: false;
  message: string;
}
```

#### GET /api/automation

Retrieves the current automation status.

**Request:** None

**Response:**
```typescript
{
  success: boolean;
  data: {
    enabled: boolean;
    lastPaused?: string;
    uptime?: number;
  }
}
```

#### POST /api/automation

Controls automation state (enable/disable/toggle).

**Request:**
```typescript
{
  action: 'enable' | 'disable' | 'toggle';
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  data: {
    enabled: boolean;
    lastPaused?: string;
    uptime?: number;
  }
}
```

### 3. UI Components

#### Dashboard Enhancements

The Dashboard component will be enhanced with:

1. **Automation Toggle Button**
   - Displays current state (Play icon when disabled, Pause icon when enabled)
   - Color-coded: Green when enabled, Orange when disabled
   - Shows tooltip with current state
   - Disabled during loading operations

2. **Clear All Button**
   - Only visible when domains exist
   - Red gradient styling to indicate destructive action
   - Triggers confirmation dialog before execution

3. **Confirmation Dialog**
   - Modal overlay with backdrop blur
   - Shows warning icon and domain count
   - Provides Cancel and Confirm buttons
   - Prevents accidental deletions

## Data Models

### Configuration Keys

The following configuration keys are used for automation control:

```typescript
{
  'automation_enabled': 'true' | 'false',  // Current automation state
  'automation_last_paused': string         // ISO timestamp of last pause
}
```

### Database Schema

No new tables are required. The feature uses existing tables:

**domains table** (for clear all operation):
```sql
CREATE TABLE domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT UNIQUE,
  rank INTEGER,
  first_seen_at TEXT,
  last_seen_in_csv_at TEXT,
  has_been_scanned INTEGER DEFAULT 0
);
```

**settings table** (for automation state):
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

**scan_tasks table** (for checking running tasks):
```sql
CREATE TABLE scan_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- other fields...
);
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Clear all button triggers confirmation dialog

*For any* dashboard state with domains present, clicking the clear all button should display a confirmation dialog containing the current domain count.
**Validates: Requirements 1.1**

### Property 2: Confirmation deletes all domains

*For any* database state with domains, confirming the clear all action should result in zero domains remaining in the database.
**Validates: Requirements 1.2**

### Property 3: Successful clear shows success message

*For any* successful clear all operation, the system should display a success message that includes the number of domains that were deleted.
**Validates: Requirements 1.3**

### Property 4: Failed clear preserves data

*For any* clear all operation that fails, the domain count before and after the operation should be identical.
**Validates: Requirements 1.4**

### Property 5: Clear button visibility depends on domain count

*For any* dashboard state, the clear all button should be visible if and only if the domain count is greater than zero.
**Validates: Requirements 1.5**

### Property 6: Toggle changes automation state

*For any* automation state (enabled or disabled), clicking the toggle button should result in the opposite state.
**Validates: Requirements 2.1**

### Property 7: Enabled automation shows pause button

*For any* dashboard state where automation is enabled, the automation button should display a pause icon.
**Validates: Requirements 2.2**

### Property 8: Disabled automation shows play button

*For any* dashboard state where automation is disabled, the automation button should display a play icon.
**Validates: Requirements 2.3**

### Property 9: Disabled automation blocks scans

*For any* scan attempt when automation is disabled, the scan should not execute and should return an error indicating automation is disabled.
**Validates: Requirements 2.4**

### Property 10: Automation state persistence

*For any* automation state change, reading the state from configuration storage immediately after the change should return the new state.
**Validates: Requirements 2.5**

### Property 11: State change shows confirmation

*For any* automation state change, the system should display a success message indicating the new state (enabled or disabled).
**Validates: Requirements 2.6**

### Property 12: Running task blocks new scans

*For any* automation scheduler state where a task is currently running, attempting to start a new automated scan should wait until the running task completes.
**Validates: Requirements 2.7**

### Property 13: Idle automation allows scans

*For any* automation scheduler state where automation is enabled and no tasks are running, new automated scans should be allowed to start.
**Validates: Requirements 2.8**

### Property 14: Dashboard loads automation status

*For any* dashboard mount event, the system should make an API call to retrieve the current automation status.
**Validates: Requirements 3.1**

### Property 15: Status includes enabled field

*For any* automation status response, the response should contain an 'enabled' boolean field.
**Validates: Requirements 3.2**

### Property 16: Status includes last pause timestamp

*For any* automation status response after a pause event, the response should contain a 'lastPaused' field with an ISO timestamp.
**Validates: Requirements 3.3**

## Error Handling

### Clear All Domains

**Error Scenarios:**
1. **Database Connection Failure**: If the database is unavailable, return a 500 error with message "Database connection failed"
2. **Transaction Failure**: If the DELETE operation fails mid-transaction, rollback and return error
3. **Permission Denied**: If user lacks permissions (future enhancement), return 403 error

**Error Response Format:**
```typescript
{
  success: false,
  message: string
}
```

**Recovery Strategy:**
- All database operations use transactions to ensure atomicity
- Failed operations leave data unchanged
- User receives clear error message with actionable information

### Automation Control

**Error Scenarios:**
1. **Invalid Action**: If action is not 'enable', 'disable', or 'toggle', return 400 error
2. **Empty Request Body**: If request body is missing or empty, return 400 error
3. **Invalid JSON**: If request body is not valid JSON, return 400 error
4. **Configuration Write Failure**: If unable to persist state, return 500 error

**Error Response Format:**
```typescript
{
  success: false,
  message: string
}
```

**Recovery Strategy:**
- Validate all inputs before processing
- Use try-catch blocks around configuration operations
- Return specific error messages for debugging
- Maintain current state if update fails

### Task Blocking Logic

**Error Scenarios:**
1. **Task Status Check Failure**: If unable to query task status, log error and allow operation (fail-open)
2. **Concurrent Task Detection**: If task is running, return error "Automation is currently disabled" or wait based on context

**Recovery Strategy:**
- Automation scheduler checks task status before starting new scans
- Scanner service checks automation state before executing
- Clear error messages guide users to wait for task completion

## Testing Strategy

### Unit Testing

Unit tests will verify specific behaviors and edge cases:

1. **AutomationController Tests**
   - Test enable/disable/toggle methods
   - Test state persistence to configuration
   - Test getStatus returns correct data structure
   - Test shouldRun returns correct boolean based on state

2. **API Endpoint Tests**
   - Test clear-all endpoint with various domain counts (0, 1, many)
   - Test automation endpoint with valid and invalid actions
   - Test error handling for malformed requests
   - Test response format compliance

3. **UI Component Tests**
   - Test button visibility based on domain count
   - Test button icon changes based on automation state
   - Test confirmation dialog appearance and dismissal
   - Test loading states during operations

### Property-Based Testing

Property-based tests will verify universal properties across many inputs:

1. **State Consistency Properties**
   - Property 6: Toggle always inverts state
   - Property 10: State changes persist correctly
   - Property 4: Failed operations preserve data

2. **UI Rendering Properties**
   - Property 5: Button visibility matches domain count
   - Property 7 & 8: Icon matches automation state

3. **Operational Properties**
   - Property 9: Disabled automation blocks all scans
   - Property 12: Running tasks block new scans
   - Property 2: Clear all removes all domains

### Integration Testing

Integration tests will verify end-to-end workflows:

1. **Clear All Workflow**
   - Add domains → Click clear all → Confirm → Verify empty database
   - Add domains → Click clear all → Cancel → Verify domains unchanged

2. **Automation Control Workflow**
   - Enable automation → Start scan → Verify scan executes
   - Disable automation → Attempt scan → Verify scan blocked
   - Toggle automation → Verify state persists across page reload

3. **Task Blocking Workflow**
   - Start long-running task → Enable automation → Verify new scan waits
   - Complete task → Verify new scan can start

### Testing Framework

- **Unit Tests**: Vitest for TypeScript/React components
- **Property-Based Tests**: fast-check library for JavaScript/TypeScript
- **API Tests**: Supertest or built-in fetch with test database
- **UI Tests**: React Testing Library for component testing

### Test Configuration

- Property-based tests should run a minimum of 100 iterations
- Each property test must include a comment referencing the design property
- Comment format: `// Feature: system-control, Property N: <property text>`
- Tests should use isolated test databases to avoid side effects

## Implementation Considerations

### 1. Task Status Checking

To implement Property 12 (running task blocks new scans), the automation scheduler needs to check task status:

```typescript
async function hasRunningTask(): Promise<boolean> {
  const stmt = db.prepare(
    "SELECT COUNT(*) as count FROM scan_tasks WHERE status IN ('pending', 'running')"
  );
  const result = stmt.get() as { count: number };
  return result.count > 0;
}
```

### 2. Atomic Clear Operation

The clear all operation must be atomic to ensure data consistency:

```typescript
const clearAll = db.transaction(() => {
  const result = db.prepare('DELETE FROM domains').run();
  return result.changes;
});
```

### 3. State Synchronization

The automation state must be checked at multiple points:

- **Scheduler**: Before starting scheduled scans
- **Scanner Service**: Before executing scan operations
- **API Endpoints**: When manually triggering scans

### 4. UI State Management

The Dashboard component should:

- Load automation status on mount
- Refresh domain count after clear operation
- Show loading states during async operations
- Handle errors gracefully with user-friendly messages

### 5. Configuration Keys

Use consistent naming for configuration keys:

- `automation_enabled`: Main automation toggle
- `automation_last_paused`: Timestamp of last pause
- Avoid creating multiple similar keys

### 6. Backward Compatibility

The automation controller should:

- Default to enabled if no configuration exists
- Handle missing configuration gracefully
- Not break existing automation scheduler functionality

## Security Considerations

1. **Authentication**: All endpoints should require authenticated user (existing auth middleware)
2. **Authorization**: Clear all and automation control should require admin role (future enhancement)
3. **CSRF Protection**: Use Next.js built-in CSRF protection for state-changing operations
4. **Input Validation**: Validate all API inputs before processing
5. **SQL Injection**: Use parameterized queries (already implemented with better-sqlite3)

## Performance Considerations

1. **Clear All Operation**: 
   - Use single DELETE statement instead of iterating
   - Expected to complete in <100ms for 1M domains
   - No pagination needed as it's a single operation

2. **Status Checks**:
   - Cache automation status in memory for 1 second
   - Avoid database queries on every scan attempt
   - Use indexed queries for task status checks

3. **UI Updates**:
   - Use optimistic UI updates for better UX
   - Debounce rapid toggle clicks
   - Show loading states immediately

## Future Enhancements

1. **Selective Clear**: Clear domains by criteria (date range, scan status)
2. **Automation Schedule**: More granular control over when automation runs
3. **Task Queue Management**: View and cancel queued tasks
4. **Audit Log**: Track who cleared domains or changed automation state
5. **Bulk Operations**: Import/export domain lists
6. **Notification System**: Alert when automation state changes
