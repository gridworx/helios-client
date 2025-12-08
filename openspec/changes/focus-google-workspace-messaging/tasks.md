# Tasks: Focus Google Workspace Messaging

## Status: Ready for Implementation

**Approach:** Test-Driven Development (TDD)
**Scope:** Frontend only
**Risk:** Low

---

## Pre-Implementation

- [ ] **TASK-001**: Review current messaging across all affected files
- [ ] **TASK-002**: Verify backend has no M365 dependencies that would break

---

## Phase 1: Write E2E Tests First

- [ ] **TASK-010**: Create test file `openspec/testing/tests/messaging/google-focus.test.ts`
- [ ] **TASK-011**: Write test: Setup page should not mention Microsoft 365 or Slack
- [ ] **TASK-012**: Write test: Login page should focus on Google Workspace
- [ ] **TASK-013**: Write test: Dashboard should not show Microsoft widgets when disabled
- [ ] **TASK-014**: Write test: Groups filter should not have Microsoft 365 option
- [ ] **TASK-015**: Write test: User list empty state should reference Google Workspace only
- [ ] **TASK-016**: Run tests - verify they FAIL (expected)

---

## Phase 2: Implement UI Changes

### AccountSetup.tsx
- [ ] **TASK-020**: Update domain hint text (line ~127)
- [ ] **TASK-021**: Update "What's Next" section (lines ~134-135)

### LoginPage.tsx
- [ ] **TASK-030**: Update feature description paragraph (line ~138)

### App.tsx
- [ ] **TASK-040**: Update platform description (lines ~479-480)
- [ ] **TASK-041**: Remove or conditionally hide Microsoft sync activity (line ~840)
- [ ] **TASK-042**: Remove or conditionally hide Microsoft sync alert (line ~898)

### UserList.tsx
- [ ] **TASK-050**: Update empty state message (line ~1059)

### Groups.tsx
- [ ] **TASK-060**: Remove Microsoft 365 filter option (line ~203)
- [ ] **TASK-061**: Add "Local Only" filter option if appropriate

### Widget Configuration
- [ ] **TASK-070**: Update `config/widgets.tsx` to hide Microsoft widgets
- [ ] **TASK-071**: Update `utils/widget-data.tsx` to handle missing Microsoft data gracefully

---

## Phase 3: Verification

- [ ] **TASK-080**: Run E2E tests - verify they PASS
- [ ] **TASK-081**: Manual verification: Setup page
- [ ] **TASK-082**: Manual verification: Login page
- [ ] **TASK-083**: Manual verification: Dashboard
- [ ] **TASK-084**: Manual verification: Users page (empty state)
- [ ] **TASK-085**: Manual verification: Groups page (filter)
- [ ] **TASK-086**: Take before/after screenshots for documentation

---

## Phase 4: Cleanup

- [ ] **TASK-090**: Remove any dead code (unused M365 imports, etc.)
- [ ] **TASK-091**: Ensure no TypeScript errors introduced
- [ ] **TASK-092**: Run full test suite to verify no regressions

---

## Completion Criteria

1. All E2E tests pass
2. No mention of Microsoft 365 or Slack in active UI areas
3. Google Workspace messaging is clear and focused
4. Settings page still shows M365 as "Coming Soon" (unchanged)
5. No TypeScript errors
6. All manual verifications pass

---

## Files Modified (Expected)

```
frontend/src/components/AccountSetup.tsx
frontend/src/pages/LoginPage.tsx
frontend/src/App.tsx
frontend/src/components/UserList.tsx
frontend/src/pages/Groups.tsx
frontend/src/config/widgets.tsx
frontend/src/utils/widget-data.tsx
```

## Files NOT Modified

```
frontend/src/components/Settings.tsx          # Keep M365 "Coming Soon"
frontend/src/pages/DeveloperConsole.tsx       # Keep M365 commands for dev
frontend/src/components/ui/PlatformIcon.tsx   # Keep icon components
```

---

## Agent Instructions

When implementing this proposal:

1. **Start with tests** - Create the E2E test file first
2. **Run tests to confirm failure** - This validates test correctness
3. **Make minimal changes** - Only modify what's specified
4. **Preserve module framework** - Don't delete M365 module definitions
5. **Keep Settings intact** - The M365 module card should remain as "Coming Soon"
6. **Test after each file** - Verify no regressions
7. **Commit atomically** - One commit per logical change group
