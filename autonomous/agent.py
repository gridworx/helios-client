#!/usr/bin/env python3
"""
Helios Autonomous Development Agent
====================================

Runs Claude Code in autonomous mode using the CLI with --print flag.
This approach supports OAuth token authentication (CLAUDE_CODE_OAUTH_TOKEN)
unlike the SDK which requires ANTHROPIC_API_KEY.

Usage:
    python autonomous/agent.py
    python autonomous/agent.py --max-iterations 5
    python autonomous/agent.py --task "Fix all TypeScript errors in the frontend"
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional


# Configuration
PROJECT_DIR = Path(__file__).parent.parent.resolve()
PROMPTS_DIR = Path(__file__).parent / "prompts"
AUTO_CONTINUE_DELAY = 3  # seconds between sessions


def check_auth() -> str:
    """Check which authentication method is available."""
    if os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
        return "oauth_token"
    elif os.environ.get("ANTHROPIC_API_KEY"):
        return "api_key"
    else:
        # Check if claude CLI is available (it will use stored credentials if logged in)
        try:
            # On Windows, use 'where', on Unix use 'which'
            import shutil
            if shutil.which("claude"):
                return "cli_stored"
        except Exception:
            pass
        return "none"


def create_settings_file() -> Path:
    """Create Claude Code settings file with security restrictions."""
    settings = {
        "permissions": {
            "allow": [
                # File operations within project
                f"Read({PROJECT_DIR}/**)",
                f"Write({PROJECT_DIR}/**)",
                f"Edit({PROJECT_DIR}/**)",
                f"Glob({PROJECT_DIR}/**)",
                f"Grep({PROJECT_DIR}/**)",
                # Bash commands (validated by CLAUDE.md instructions)
                "Bash(npm:*)",
                "Bash(node:*)",
                "Bash(npx:*)",
                "Bash(git:*)",
                "Bash(docker:*)",
                "Bash(docker-compose:*)",
                "Bash(ls:*)",
                "Bash(cat:*)",
                "Bash(pwd:*)",
                "Bash(mkdir:*)",
                "Bash(cp:*)",
                "Bash(rm:*)",
                # Task and TodoWrite for planning
                "Task",
                "TodoWrite",
            ],
            "deny": [
                # Block dangerous operations
                "Bash(curl:*)",
                "Bash(wget:*)",
                "Bash(ssh:*)",
                "Bash(scp:*)",
            ]
        }
    }

    settings_path = PROJECT_DIR / ".claude_settings_autonomous.json"
    with open(settings_path, "w") as f:
        json.dump(settings, f, indent=2)

    return settings_path


def get_progress_file() -> Path:
    """Get the path to the progress tracking file."""
    return PROJECT_DIR / "autonomous" / "progress.json"


def load_progress() -> dict:
    """Load progress from file."""
    progress_file = get_progress_file()
    if progress_file.exists():
        with open(progress_file) as f:
            return json.load(f)
    return {
        "iterations": 0,
        "tasks_completed": [],
        "current_task": None,
        "started_at": None,
        "last_session": None,
    }


def save_progress(progress: dict) -> None:
    """Save progress to file."""
    progress_file = get_progress_file()
    progress_file.parent.mkdir(parents=True, exist_ok=True)
    with open(progress_file, "w") as f:
        json.dump(progress, f, indent=2)


def run_claude_session(prompt: str, settings_path: Path) -> tuple[int, str]:
    """
    Run a single Claude Code session using CLI --print mode.

    Returns:
        (exit_code, output)
    """
    cmd = [
        "claude",
        "--print",  # Non-interactive mode
        "--dangerously-skip-permissions",  # Use settings file instead
        prompt,
    ]

    env = os.environ.copy()
    env["CLAUDE_CODE_SETTINGS"] = str(settings_path)

    session_start = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{'='*70}")
    print(f"  SESSION STARTED: {session_start}")
    print(f"{'='*70}\n")

    try:
        result = subprocess.run(
            cmd,
            cwd=str(PROJECT_DIR),
            env=env,
            capture_output=True,
            text=True,
            timeout=1800,  # 30 minute timeout per session
        )

        output = result.stdout
        if result.stderr:
            output += f"\n\nSTDERR:\n{result.stderr}"

        print(output)

        session_end = time.strftime("%Y-%m-%d %H:%M:%S")
        duration = "completed"
        print(f"\n{'='*70}")
        print(f"  SESSION ENDED: {session_end}")
        print(f"  Status: Exit code {result.returncode}")
        print(f"{'='*70}\n")

        return result.returncode, output

    except subprocess.TimeoutExpired:
        session_end = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n{'='*70}")
        print(f"  SESSION TIMED OUT: {session_end}")
        print(f"  Duration: 30 minutes (limit reached)")
        print(f"{'='*70}\n")
        return 1, "TIMEOUT"
    except Exception as e:
        session_end = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n{'='*70}")
        print(f"  SESSION ERROR: {session_end}")
        print(f"  Error: {e}")
        print(f"{'='*70}\n")
        return 1, str(e)


def get_continuation_prompt(progress: dict) -> str:
    """Get the prompt for continuing development."""

    # Check if there's a specific task queued
    next_task = progress.get("next_task")

    # Handle bug fix tasks
    if next_task and next_task.get("type") == "bug_fix":
        import json
        task_json = json.dumps(next_task, indent=2)
        return f"""You are fixing critical bugs in the Helios Client Portal.

## CRITICAL: Read Rules First

**Before making ANY code changes, read `AGENT-RULES.md`**

## Bug Fix Task

{task_json}

## Your Approach

1. **First, verify the test environment works:**
   - Load the service account from the path specified
   - Test API connection to Google Workspace
   - Confirm you can list users from the test domain

2. **Fix bugs one at a time:**
   - Start with BUG-001 (module not enabled)
   - Trace the code flow from frontend → API → database
   - Add logging if needed to debug
   - Fix the issue
   - Test by making API calls and checking database

3. **Verify each fix:**
   - Run the SQL verification queries
   - Make actual API calls to test endpoints
   - Check the database state matches expectations

4. **Only commit when ALL bugs are fixed and tested**

## Database Quick Reference

Tables: `modules`, `organization_modules`, `gw_credentials`, `gw_synced_users`
Columns in modules: `id`, `name`, `slug` (NOT module_key!)

## Testing Commands

```bash
# Test API connection
cd backend && npx ts-node -e "
const {{ google }} = require('googleapis');
const fs = require('fs');
const sa = JSON.parse(fs.readFileSync('.secrets/test-service-account.json'));
const auth = new google.auth.JWT({{
  email: sa.client_email,
  key: sa.private_key,
  scopes: ['https://www.googleapis.com/auth/admin.directory.user'],
  subject: 'mike@gridworx.io'
}});
auth.authorize().then(() => console.log('API OK')).catch(e => console.error(e));
"

# Check database state
docker exec helios_client_postgres psql -U postgres -d helios_client -c "SELECT * FROM organization_modules;"
```

Begin by reading AGENT-RULES.md, then verify the test environment works."""

    # Handle OpenSpec tasks
    if next_task and next_task.get("type") == "openspec":
        proposal_path = next_task.get("proposal", "")
        approach = next_task.get("approach", "implement")
        instructions = next_task.get("instructions", "")

        return f"""You are continuing autonomous development on the Helios Client Portal.

## PRIORITY TASK: OpenSpec Implementation

There is a staged OpenSpec proposal ready for implementation:

**Proposal:** {proposal_path}
**Approach:** {approach}
**Instructions:** {instructions}

### Your Steps:

1. **Read the proposal files:**
   - `{proposal_path}/proposal.md` - Understand the goal
   - `{proposal_path}/design.md` - Technical approach
   - `{proposal_path}/tasks.md` - Specific tasks to complete

2. **Follow TDD approach:**
   - Write E2E tests FIRST (before implementation)
   - Run tests to verify they fail
   - Implement the changes
   - Run tests to verify they pass

3. **Mark tasks complete:**
   - Check off tasks in tasks.md as you complete them
   - Commit atomically per task group

4. **When done:**
   - All tests pass
   - All tasks checked off
   - Update autonomous/progress.json to remove next_task

## Guidelines

- Follow the OpenSpec proposal exactly
- Use test-driven development
- Commit frequently with descriptive messages
- Do NOT deviate from the proposal scope

Begin by reading the proposal files."""

    # Default continuation prompt
    return """You are continuing autonomous development on the Helios Client Portal.

## CRITICAL: Read Rules First

**Before making ANY code changes, read these files:**
1. `AGENT-RULES.md` - Database schema, API scopes, testing requirements
2. `CLAUDE.md` - Project conventions and constraints

## First: Orient Yourself

1. Check autonomous/progress.json for any queued tasks
2. Check git status to see what's changed
3. Review the TODO list or recent commits
4. Check for any failing tests or build errors

## Your Task

Continue implementing features or fixing issues based on:
1. Any next_task in autonomous/progress.json
2. Open OpenSpec proposals in openspec/changes/
3. Issues mentioned in PROJECT-TRACKER-V2.md
4. TypeScript/build errors that need fixing

## Testing Google Workspace

Test credentials are at `backend/.secrets/test-service-account.json`
- Domain: gridworx.io
- Admin: mike@gridworx.io
- Always test API calls before committing changes

## Guidelines

- Work on ONE task at a time
- Commit your work frequently with clear messages
- Update TODO/progress files as you complete tasks
- VERIFY database table/column names before writing queries
- Use FULL OAuth scopes, not readonly versions
- If you get stuck, document the issue and move on

## When Done

Before ending:
1. Ensure the build passes (npm run build in frontend/backend)
2. Test Google Workspace integration if you touched that code
3. Commit all changes
4. Update progress tracking

Begin by reading AGENT-RULES.md, then check the current state of the project."""


def get_task_prompt(task: str) -> str:
    """Get prompt for a specific task."""
    return f"""You are working on the Helios Client Portal.

## Your Specific Task

{task}

## Guidelines

- Focus ONLY on this task
- Test your changes work
- Commit when complete with a descriptive message
- Update any relevant documentation

## Context

Read CLAUDE.md for project conventions.
This is a single-organization portal (NOT multi-tenant).

Begin by understanding what needs to be done, then implement it."""


def main():
    parser = argparse.ArgumentParser(
        description="Helios Autonomous Development Agent"
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=None,
        help="Maximum number of iterations (default: unlimited)",
    )
    parser.add_argument(
        "--task",
        type=str,
        default=None,
        help="Specific task to work on (default: continue general development)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without running",
    )

    args = parser.parse_args()

    # Check authentication
    auth_method = check_auth()
    if auth_method == "none":
        print("ERROR: No authentication configured!")
        print()
        print("Option 1 - Login via Claude CLI (uses your Pro/Max subscription):")
        print("  claude login")
        print()
        print("Option 2 - OAuth Token (for headless/CI environments):")
        print("  claude setup-token")
        print("  export CLAUDE_CODE_OAUTH_TOKEN='sk-ant-oat01-...'")
        print()
        print("Option 3 - API Key (pay-as-you-go):")
        print("  export ANTHROPIC_API_KEY='sk-ant-...'")
        sys.exit(1)

    print(f"Authentication: {auth_method}")
    if auth_method == "cli_stored":
        print("  (Using stored CLI credentials. Run 'claude login' if auth fails)")
    print(f"Project: {PROJECT_DIR}")

    # Create settings
    settings_path = create_settings_file()
    print(f"Settings: {settings_path}")

    # Load progress
    progress = load_progress()
    if progress["started_at"] is None:
        progress["started_at"] = time.strftime("%Y-%m-%d %H:%M:%S")

    if args.task:
        progress["current_task"] = args.task
        prompt = get_task_prompt(args.task)
    else:
        prompt = get_continuation_prompt(progress)

    if args.dry_run:
        print("\n--- DRY RUN ---")
        print(f"Would run with prompt:\n{prompt[:500]}...")
        return

    # Main loop
    iteration = 0

    try:
        while True:
            iteration += 1
            progress["iterations"] += 1

            if args.max_iterations and iteration > args.max_iterations:
                print(f"\nReached max iterations ({args.max_iterations})")
                break

            print(f"\n--- Iteration {iteration} ---")

            exit_code, output = run_claude_session(prompt, settings_path)

            progress["last_session"] = time.strftime("%Y-%m-%d %H:%M:%S")
            save_progress(progress)

            if exit_code != 0:
                print(f"Session ended with error (code {exit_code})")
                print("Waiting before retry...")
                time.sleep(AUTO_CONTINUE_DELAY * 2)
            else:
                # Check if task was marked complete
                if "TASK COMPLETE" in output or "All done" in output.lower():
                    if args.task:
                        progress["tasks_completed"].append(args.task)
                        save_progress(progress)
                        print("\nTask completed!")
                        break

                print(f"\nContinuing in {AUTO_CONTINUE_DELAY}s...")
                time.sleep(AUTO_CONTINUE_DELAY)

            # Reload progress in case it was updated, then get continuation prompt
            progress = load_progress()
            prompt = get_continuation_prompt(progress)

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        print("To resume, run the same command again")

    finally:
        save_progress(progress)
        print(f"\nProgress saved to {get_progress_file()}")


if __name__ == "__main__":
    main()
