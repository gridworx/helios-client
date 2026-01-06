# Agent Operating Rules

## CRITICAL: Read Before Every Task

### Rule 1: Stay In Scope
- ONLY work on the current task in `progress.json`
- Do NOT "improve" or "refactor" unrelated code
- Do NOT add features not in the spec
- If you see something broken elsewhere, LOG IT but don't fix it

### Rule 2: Minimal Changes
- Change the MINIMUM code needed to complete the task
- Prefer editing existing files over creating new ones
- Do NOT reorganize file structure unless spec requires it
- Do NOT rename variables/functions unless spec requires it

### Rule 3: Preserve Working Code
- Before modifying a file, verify it currently works
- After modifying, verify it still works AND the new feature works
- If something breaks, REVERT and try a different approach
- NEVER comment out working code "for later"

### Rule 4: Test Before and After
- Run relevant tests BEFORE making changes (baseline)
- Run tests AFTER each file change
- If tests fail after your change, fix or revert immediately
- Take screenshots of UI at key states

### Rule 5: One Thing At A Time
- Complete ONE task fully before starting the next
- Mark task complete in tasks.md only when verified working
- Do NOT parallelize tasks that touch the same files

### Rule 6: Design System Compliance
- Read DESIGN-SYSTEM.md before any UI work
- Use ONLY colors, spacing, typography from design system
- Use Lucide icons, NEVER emojis in production UI
- Verify responsive design at 3 breakpoints

### Rule 7: Do NOT Modify These Files Without Explicit Instruction
- `docker-compose.yml`
- `.env` or `.env.example`
- `package.json` (except adding dependencies)
- Any migration file that's already been applied
- `CLAUDE.md`, `DESIGN-SYSTEM.md`

### Rule 8: API Contract Stability
- Do NOT change API response shapes without updating all consumers
- Do NOT remove fields from responses (add new ones instead)
- Do NOT change URL paths without adding redirects
- Document any API changes in the task completion notes

### Rule 9: Regression Checklist
After EVERY change, verify:
- [ ] Login still works
- [ ] Dashboard loads with data
- [ ] Navigation works in both views (admin/user)
- [ ] No console errors in browser
- [ ] No errors in backend logs

### Rule 10: When Stuck
- Do NOT make random changes hoping something works
- Document what you tried and what failed
- Move to next task or stop and report
- NEVER delete code you don't understand

## File Change Limits

| Task Type | Max Files Changed | Max Lines Changed |
|-----------|-------------------|-------------------|
| Bug fix | 3 | 50 |
| Small feature | 5 | 200 |
| Medium feature | 10 | 500 |
| Large feature | 15 | 1000 |

If you exceed these limits, STOP and break the task into smaller pieces.

## Verification Commands

Run these after every significant change:

```bash
# Backend health
curl http://localhost:3001/health

# Frontend builds
cd frontend && npm run build

# Run tests
cd backend && npm test
cd e2e && npx playwright test --grep "smoke"

# Check for TypeScript errors
cd frontend && npx tsc --noEmit
cd backend && npx tsc --noEmit
```

## Commit Rules

- Commit after EACH completed task (not at end of session)
- Commit message must reference task ID
- Never commit broken code
- Never commit console.logs or debug code
