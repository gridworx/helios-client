# Next Feature: Bidirectional Sync & Conflict Resolution

**Priority:** High (after current bug fixes complete)
**Type:** OpenSpec Proposal Required

## Problem Statement

Current UI shows: "This user is managed by Google Workspace. Changes to core attributes (name, email) must be made in Google Admin Console."

This is WRONG. The intended behavior is:

1. **Helios is the primary management interface** - admins make changes here
2. **Changes sync TO Google Workspace** - Helios pushes updates
3. **Changes FROM Google sync back** - with audit log showing "synced from Google"
4. **Conflict resolution is configurable** - admin chooses the strategy

## Proposed Conflict Resolution Options

In Settings → Google Workspace → Sync Settings:

```
Conflict Resolution Strategy:
○ Helios Wins - Changes made in Helios overwrite Google (recommended)
○ Google Wins - Changes made in Google overwrite Helios
○ Last Write Wins - Most recent change takes precedence
○ Manual Review - Flag conflicts for admin review
```

## UI Changes Needed

### User Profile Page
- Remove "managed by Google Workspace" message
- Show "Synced with Google Workspace" badge instead
- Allow editing of all fields
- Show sync status indicator

### Audit Log
When changes sync:
- "User profile updated (synced from Google Workspace)"
- "User profile updated (pushed to Google Workspace)"
- "Conflict detected: [field] - resolved using [strategy]"

### Settings Page
Add conflict resolution dropdown in Google Workspace settings

## Technical Implementation

### Sync Direction
```typescript
enum SyncDirection {
  BIDIRECTIONAL = 'bidirectional',  // Default - both directions
  HELIOS_TO_GOOGLE = 'push_only',   // Helios is master
  GOOGLE_TO_HELIOS = 'pull_only'    // Google is master (current behavior)
}
```

### Conflict Detection
```typescript
interface SyncConflict {
  field: string;
  heliosValue: string;
  googleValue: string;
  heliosUpdatedAt: Date;
  googleUpdatedAt: Date;
  resolution: 'helios_wins' | 'google_wins' | 'pending';
}
```

## Files to Modify

- `frontend/src/components/UserSlideOut.tsx` - Remove "managed by" message
- `frontend/src/components/Settings.tsx` - Add conflict resolution setting
- `backend/src/services/google-workspace-sync.service.ts` - Implement bidirectional sync
- `backend/src/routes/organization.routes.ts` - Allow user edits, push to Google
- Database: Add `sync_direction`, `conflict_resolution` columns to settings

## Agent Instructions

1. Create OpenSpec proposal at `openspec/changes/bidirectional-sync/proposal.md`
2. Design the conflict resolution system
3. Implement in phases:
   - Phase 1: Remove "managed by" messaging, allow edits
   - Phase 2: Push changes to Google Workspace
   - Phase 3: Conflict detection and resolution
4. Test with gridworx.io test domain

## DO NOT START until current bug fixes are complete and verified.
