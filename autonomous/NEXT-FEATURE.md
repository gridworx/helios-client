# Next Feature: Add User UX Improvements (Phase 3 & 4)

**Priority:** High
**Type:** Implementation from Spec

## Overview
Complete the UX improvements for user creation, specifically focusing on data consistency (dropdowns), layout alignment, and license management.

**Spec Files:**
- Design: `openspec/specs/add-user-ux/sdd.md`
- Test Plan: `openspec/specs/add-user-ux/tdd.md`

## Requirements

### 1. Refine QuickAddUserSlideOut
- Convert "Job Title" input to a selectable dropdown (source: Master Data).
- Convert "Manager" input to a selectable dropdown (source: Active Users).
- Ensure validation logic prevents submission if required dropdowns are empty.

### 2. Improve /add-user Page
- Fix CSS alignment issues in `AddUser.tsx` (use grid/flex properly).
- Add "Create in Google/Microsoft" checkboxes.
- Ensure field consistency with the slideout.

### 3. Backend License API
- Create endpoint `GET /api/v1/licenses` to list available licenses.
- Update `POST /api/v1/organization/users` to accept license assignments.

## Agent Instructions
1.  Read the SDD and TDD files carefully.
2.  Implement the requirements in `QuickAddUserSlideOut.tsx` first (minimize changes to existing working code).
3.  Implement the API changes.
4.  Update the `AddUser.tsx` page.
5.  Verify improvements with tests as defined in TDD.
