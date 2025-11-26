# Implementation Plan

- [x] 1. Create AutomationController service



  - Implement singleton class for managing automation state
  - Add methods: isEnabled(), enable(), disable(), toggle(), getStatus(), shouldRun()
  - Use ConfigService for state persistence
  - Store automation state in 'automation_enabled' config key
  - Store last pause timestamp in 'automation_last_paused' config key
  - _Requirements: 2.1, 2.4, 2.5, 3.2, 3.3_



- [ ] 1.1 Write property test for automation state toggle
  - **Property 6: Toggle changes automation state**

  - **Validates: Requirements 2.1**




- [ ] 1.2 Write property test for state persistence
  - **Property 10: Automation state persistence**
  - **Validates: Requirements 2.5**

- [-] 2. Create automation control API endpoint

  - Create /api/automation route with GET and POST handlers
  - GET: Return current automation status


  - POST: Accept action (enable/disable/toggle) and update state
  - Validate request body and action parameter

  - Handle empty body and invalid JSON errors
  - Return consistent response format with success, message, and data
  - _Requirements: 2.1, 2.5, 2.6, 3.1, 3.2, 3.3_


- [ ] 2.1 Write property test for status response structure
  - **Property 15: Status includes enabled field**



  - **Validates: Requirements 3.2**

- [ ] 2.2 Write property test for last pause timestamp
  - **Property 16: Status includes last pause timestamp**
  - **Validates: Requirements 3.3**



- [ ] 2.3 Write unit tests for API error handling
  - Test invalid action parameter returns 400

  - Test empty request body returns 400
  - Test invalid JSON returns 400
  - _Requirements: 2.1_



- [ ] 3. Create clear all domains API endpoint
  - Create /api/domains/clear-all route with DELETE handler
  - Execute DELETE FROM domains in transaction



  - Return deleted count in response
  - Handle database errors gracefully
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 3.1 Write property test for clear all operation







  - **Property 2: Confirmation deletes all domains**
  - **Validates: Requirements 1.2**

- [x] 3.2 Write property test for failed clear preserves data

  - **Property 4: Failed clear preserves data**
  - **Validates: Requirements 1.4**


- [ ] 3.3 Write unit tests for clear all endpoint
  - Test with zero domains
  - Test with one domain
  - Test with many domains
  - Test database error handling
  - _Requirements: 1.2, 1.3, 1.4_


- [ ] 4. Integrate automation control into scanner service
  - Import AutomationController in scanner-service.ts
  - Check automationController.shouldRun() before executing scans
  - Throw error "Automation is currently disabled" when blocked
  - _Requirements: 2.4_

- [ ] 4.1 Write property test for disabled automation blocks scans
  - **Property 9: Disabled automation blocks scans**
  - **Validates: Requirements 2.4**

- [x] 5. Add task status checking to automation scheduler


  - Create hasRunningTask() helper function
  - Query scan_tasks table for pending/running status
  - Check task status before starting new automated scans
  - Wait for task completion if one is running
  - _Requirements: 2.7, 2.8_

- [x] 5.1 Write property test for running task blocks new scans

  - **Property 12: Running task blocks new scans**
  - **Validates: Requirements 2.7**

- [x] 5.2 Write property test for idle automation allows scans

  - **Property 13: Idle automation allows scans**
  - **Validates: Requirements 2.8**

- [x] 6. Update Dashboard UI with automation toggle button


  - Add state variables: automationEnabled, loading
  - Create loadAutomationStatus() function to fetch status on mount
  - Create handleToggleAutomation() function to toggle state
  - Add automation toggle button with Play/Pause icons
  - Style button with green (enabled) or orange (disabled) gradient
  - Show loading state during operations
  - Display success message after state change
  - _Requirements: 2.1, 2.2, 2.3, 2.6, 3.1_

- [ ] 6.1 Write property test for toggle button icon
  - **Property 7: Enabled automation shows pause button**
  - **Property 8: Disabled automation shows play button**
  - **Validates: Requirements 2.2, 2.3**

- [ ] 6.2 Write property test for dashboard loads status
  - **Property 14: Dashboard loads automation status**
  - **Validates: Requirements 3.1**

- [ ] 6.3 Write unit tests for automation toggle UI
  - Test button renders with correct icon based on state
  - Test button click triggers state change
  - Test loading state disables button
  - Test success message appears after toggle
  - _Requirements: 2.1, 2.2, 2.3, 2.6_

- [-] 7. Update Dashboard UI with clear all button

  - Add state variable: clearAllDialog
  - Create handleClearAllDomains() function to call API
  - Add clear all button (only visible when domains exist)
  - Style button with red gradient for destructive action
  - Add Trash2 icon from lucide-react
  - _Requirements: 1.1, 1.5_

- [ ] 7.1 Write property test for clear button visibility
  - **Property 5: Clear button visibility depends on domain count**
  - **Validates: Requirements 1.5**

- [-] 8. Create confirmation dialog for clear all

  - Add modal overlay with backdrop blur
  - Show warning icon and domain count
  - Display "Clear all domains" heading
  - Show warning message with domain count
  - Add Cancel and Confirm buttons
  - Close dialog on cancel
  - Execute clear operation on confirm
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 8.1 Write property test for confirmation dialog
  - **Property 1: Clear all button triggers confirmation dialog**
  - **Validates: Requirements 1.1**

- [ ] 8.2 Write property test for successful clear message
  - **Property 3: Successful clear shows success message**
  - **Validates: Requirements 1.3**

- [ ] 8.3 Write unit tests for confirmation dialog
  - Test dialog appears on button click
  - Test dialog shows correct domain count
  - Test cancel button closes dialog without deleting
  - Test confirm button executes delete operation
  - Test success message appears after deletion
  - _Requirements: 1.1, 1.2, 1.3_


- [x] 9. Add necessary icon imports to Dashboard


  - Import Trash2, Play, Pause icons from lucide-react
  - Ensure AlertTriangle is imported for confirmation dialog
  - _Requirements: 1.1, 2.2, 2.3_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
