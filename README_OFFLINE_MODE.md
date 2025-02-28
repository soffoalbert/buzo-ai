# Buzo AI Data Synchronization

This directory contains the services responsible for data synchronization between the local device and the Buzo AI backend.

## Overview

The data synchronization mechanism is designed to provide a seamless experience for users, allowing them to use the app even when offline and automatically synchronizing their data when they come back online.

### Key Components

1. **offlineStorage.ts**: Handles local storage of data using AsyncStorage and provides basic functions for checking network connectivity.

2. **syncQueueService.ts**: Manages a priority-based queue of pending changes that need to be synchronized with the backend. It tracks sync status, handles retry logic, and provides a robust mechanism for managing the sync queue.

3. **syncService.ts**: Orchestrates the synchronization process, including background sync, app state monitoring, and network connectivity changes.

## Features

- **Offline-First Architecture**: All data is stored locally first, allowing users to use the app even when offline.
- **Priority-Based Sync Queue**: Changes are synchronized based on priority, ensuring critical updates are processed first.
- **Background Synchronization**: Data is synchronized in the background when the app is not in use.
- **Automatic Retry**: Failed sync operations are automatically retried with exponential backoff.
- **Visual Indicators**: The OfflineStatusBar component provides visual feedback about the sync status.
- **Error Handling**: Robust error handling ensures data integrity even when sync operations fail.

## Usage

### Adding Items to Sync Queue

```typescript
import syncQueueService from '../services/syncQueueService';

// Add an item to the sync queue
await syncQueueService.addToSyncQueue({
  id: 'unique-id', // Optional, will be generated if not provided
  type: 'create',  // 'create', 'update', or 'delete'
  entity: 'budget', // 'budget', 'expense', 'savings', or 'transaction'
  data: { /* your data */ },
}, 2); // Priority (higher number = higher priority)
```

### Manually Triggering Sync

```typescript
import syncService from '../services/syncService';

// Perform a full sync (push pending changes and pull latest data)
await syncService.performFullSync();
```

### Listening for Sync Status Changes

```typescript
import syncService from '../services/syncService';
import { SyncStatus } from '../services/syncQueueService';

// Add a listener for sync status changes
const unsubscribe = syncService.addSyncStatusListener((status: SyncStatus) => {
  console.log('Sync status changed:', status);
});

// Later, when you're done listening
unsubscribe();
```

## Implementation Details

### Sync Queue Item Structure

```typescript
interface SyncQueueItem {
  id: string;              // Unique identifier
  type: 'create' | 'update' | 'delete'; // Operation type
  entity: 'budget' | 'expense' | 'savings' | 'transaction'; // Entity type
  data: any;               // Data to sync
  timestamp: number;       // When the item was added to the queue
  priority: number;        // Higher number = higher priority
  attempts: number;        // Number of sync attempts
  lastAttempt: number | null; // Timestamp of last attempt
  error?: string;          // Last error message if sync failed
}
```

### Sync Status Structure

```typescript
interface SyncStatus {
  lastSyncAttempt: number | null;    // Timestamp of last sync attempt
  lastSuccessfulSync: number | null; // Timestamp of last successful sync
  isSyncing: boolean;                // Whether sync is currently in progress
  pendingCount: number;              // Number of items pending sync
  failedCount: number;               // Number of items that failed to sync
  syncProgress: number;              // Progress of current sync (0-100)
  error?: string;                    // Last error message if sync failed
}
```

## Background Sync Configuration

The background sync is configured to run every 15 minutes when the app is in the background. This interval can be adjusted in the `syncService.ts` file by modifying the `SYNC_INTERVAL_MS` constant.

## Error Handling

Failed sync operations are tracked and can be retried manually or automatically. The system will automatically retry failed operations with an exponential backoff strategy up to a maximum number of attempts (configurable in `syncService.ts` as `MAX_RETRY_ATTEMPTS`).

## Future Improvements

- Implement conflict resolution strategies for concurrent changes
- Add data compression for more efficient storage and transfer
- Implement selective sync for large datasets
- Add encryption for sensitive data 