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

    print(f"\n{'='*70}")
    print("  CLAUDE SESSION STARTING")
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
        return result.returncode, output

    except subprocess.TimeoutExpired:
        print("Session timed out after 30 minutes")
        return 1, "TIMEOUT"
    except Exception as e:
        print(f"Error running Claude: {e}")
        return 1, str(e)


def get_continuation_prompt() -> str:
    """Get the prompt for continuing development."""
    return """You are continuing autonomous development on the Helios Client Portal.

## First: Orient Yourself

1. Check git status to see what's changed
2. Review the TODO list or recent commits
3. Check for any failing tests or build errors

## Your Task

Continue implementing features or fixing issues based on:
1. Any open TODO items in the codebase
2. Issues mentioned in PROJECT-TRACKER-V2.md
3. TypeScript/build errors that need fixing

## Guidelines

- Work on ONE task at a time
- Commit your work frequently with clear messages
- Update TODO/progress files as you complete tasks
- If you get stuck, document the issue and move on

## When Done

Before ending:
1. Ensure the build passes (npm run build in frontend/backend)
2. Commit all changes
3. Update progress tracking

Begin by checking the current state of the project."""


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
        prompt = get_continuation_prompt()

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

            # For continuation, use the standard prompt
            prompt = get_continuation_prompt()

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        print("To resume, run the same command again")

    finally:
        save_progress(progress)
        print(f"\nProgress saved to {get_progress_file()}")


if __name__ == "__main__":
    main()
