# Performance Testing with 20 Concurrent Participants

## Overview

This test suite validates that the WebSocket real-time infrastructure can handle 20 concurrent participants in an estimation session without performance degradation.

## Test Coverage

The `performance.spec.ts` file includes four comprehensive tests:

### 1. Vote Submission Test
- **What it tests**: 20 participants submitting votes simultaneously
- **Verification**:
  - All participants receive vote events from others
  - Event propagation latency < 500ms
  - At least 80% of participants receive events
- **Metrics tracked**:
  - Total events received across all participants
  - Min/Avg/Max latency
  - Event reception rate

### 2. Vote Reveal Test
- **What it tests**: Vote reveal propagating to 20 concurrent participants
- **Verification**:
  - Reveal event reaches all participants
  - Propagation latency < 500ms
  - At least 80% of participants receive the reveal event

### 3. Connection Stability Test
- **What it tests**: 20 concurrent WebSocket connections remain stable over time
- **Verification**:
  - At least 90% of participants successfully connect
  - Connections remain stable for 5+ seconds
  - No unexpected disconnections

### 4. Participant Join Events Test
- **What it tests**: All 20 participants joining and join events propagating
- **Verification**:
  - Join events are received by existing participants
  - Join event latency < 1000ms (2x allowance due to volume)
  - All participants successfully join the session

## Running the Tests

### Prerequisites
1. Ensure PostgreSQL is running (via Docker or local installation)
2. Ensure Redis is running
3. Start the API server: `pnpm dev:api` (from project root)
4. The Playwright config will automatically start the web server

### Run All Performance Tests
```bash
# From project root
pnpm test:e2e apps/web/e2e/performance.spec.ts

# Or from apps/web directory
npx playwright test e2e/performance.spec.ts
```

### Run Specific Test
```bash
# Vote submission test only
npx playwright test e2e/performance.spec.ts -g "submit votes"

# Connection stability test only
npx playwright test e2e/performance.spec.ts -g "stable connections"
```

### Run with UI Mode (Recommended for Debugging)
```bash
npx playwright test e2e/performance.spec.ts --ui
```

### Run with Headed Browser (Watch the Test)
```bash
npx playwright test e2e/performance.spec.ts --headed
```

## Performance Benchmarks

Based on acceptance criteria:
- **Max Event Latency**: 500ms
- **Connection Success Rate**: >90%
- **Event Reception Rate**: >80%
- **Connection Stability**: 5+ seconds without drops

## Test Architecture

Each test follows this pattern:
1. **Setup**: Create N browser contexts (one per participant)
2. **Connect**: Navigate all participants to the same session
3. **Initialize**: Set up event listeners on all participants
4. **Action**: Perform the test action (vote, reveal, etc.)
5. **Measure**: Track event reception timestamps and calculate latencies
6. **Verify**: Assert performance criteria are met
7. **Cleanup**: Close all browser contexts

## Troubleshooting

### Tests Timing Out
- Increase timeout in playwright.config.ts
- Check that API and database are running
- Verify WebSocket server is accepting connections

### High Latency
- Check server load and system resources
- Verify network conditions
- Review WebSocket event handler performance

### Failed Connections
- Check WebSocket server configuration
- Verify session exists in database
- Review authentication/authorization setup

## Notes

- Tests use the demo session ID: `11111111-1111-1111-1111-111111111111`
- Each participant simulates a real user with separate browser context
- Console logs show detailed performance metrics during test execution
- Tests are marked as "slow" in Playwright to allow adequate time for 20 concurrent connections
