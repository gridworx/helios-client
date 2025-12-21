# Tasks: Quick Add UX Alignment

## Refactor
- [x] **TASK-UX-REF-001**: Remove floating label CSS from `QuickAddUserSlideOut.css`
- [x] **TASK-UX-REF-002**: Refactor `QuickAddUserSlideOut.tsx` to use standard `<label>` + `<input>` structure (remove field-container/floating logic)
- [x] **TASK-UX-REF-003**: Standardize input padding/height to match `UserSlideOut` inputs
- [x] **TASK-UX-REF-004**: Align "Provider" section with "Groups" or "Settings" styling from User Details (using standard headers/cards)

## Verification
- [x] **TASK-TEST-001**: Verify visually that labels are static and aligned top-left.
- [x] **TASK-TEST-002**: Verify input fields have same height/border as other forms.
- [x] **TASK-TEST-003**: Ensure validation errors still appear correctly below inputs.

## Implementation Notes

### Changes Made
1. **CSS refactored to use theme variables** - replaced hardcoded `#667eea` with `var(--theme-primary)` and `var(--theme-primary-end)` for consistency
2. **Label styling aligned with UserSlideOut** - uppercase, 0.75rem font-size, 600 font-weight, #6b7280 color
3. **Input styling standardized** - 0.625rem padding, 6px border-radius, 0.9375rem font-size
4. **Provider section styled like platform-card** - larger icons (48px), increased padding (1.25rem), hover effects matching UserSlideOut
5. **Spacing converted to rem units** - consistent with UserSlideOut (2rem padding, 1.5rem margins)
6. **Added E2E test for visual verification** - tests/add-user-ux.test.ts validates labels are static/uppercase and inputs have correct border-radius

### Test Results
All 9 E2E tests pass including new visual styling verification test.
