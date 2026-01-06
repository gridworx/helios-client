# Helios Autonomous Development

Run Claude Code autonomously on the Helios project using your Claude Pro/Max subscription (OAuth token) instead of an Anthropic API key.

## Authentication Setup

### Option 1: Already Logged In (Easiest)

If you've already used `claude` interactively:

```bash
# Your stored credentials will be used automatically
python autonomous/agent.py --dry-run
```

### Option 2: OAuth Token (Recommended for Headless/CI)

Generate a long-lived OAuth token for use without browser access:

```bash
# This opens a browser for OAuth authentication
claude setup-token

# Copy the token that starts with sk-ant-oat01-...
# Then set it as an environment variable:
export CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-your-token-here"

# On Windows PowerShell:
$env:CLAUDE_CODE_OAUTH_TOKEN = "sk-ant-oat01-your-token-here"
```

### Option 3: API Key (Pay-as-you-go)

If you prefer API billing instead of your subscription:

```bash
# Get from https://console.anthropic.com/
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Usage

```bash
cd D:\personal-projects\helios\helios-client

# Run autonomously (continues until stopped or task complete)
python autonomous/agent.py

# Run with iteration limit (for testing)
python autonomous/agent.py --max-iterations 3

# Run a specific task
python autonomous/agent.py --task "Fix all TypeScript errors in frontend"

# Dry run (see what would happen)
python autonomous/agent.py --dry-run
```

## How It Works

1. **CLI-based**: Uses `claude --print` mode which supports OAuth authentication
2. **Session Loop**: Runs multiple Claude sessions, each with fresh context
3. **Progress Tracking**: Saves state to `progress.json` for resumption
4. **Project-Scoped**: File access restricted to the Helios project directory

## Key Difference from SDK Approach

The Claude Agent SDK (`claude-code-sdk`) currently **only supports API keys**, not OAuth tokens. This script uses the CLI directly which **does support OAuth tokens**.

| Approach | OAuth Token | API Key | Subscription Billing |
|----------|-------------|---------|---------------------|
| This Script (CLI) | Yes | Yes | Yes |
| Agent SDK | No | Yes | No |

## Files

```
autonomous/
├── agent.py          # Main autonomous agent
├── progress.json     # Session state (gitignored)
├── README.md         # This file
└── .gitignore
```

## Stopping and Resuming

- Press `Ctrl+C` to stop at any time
- Run the same command again to resume from where you left off
- Progress is saved after each session

## Security

The agent operates with these restrictions:
- File operations limited to project directory
- Bash commands limited to safe development tools
- No external network access (curl, wget blocked)

## Customization

Edit `agent.py` to modify:
- `get_continuation_prompt()` - Default autonomous behavior
- `get_task_prompt()` - Task-specific instructions
- `create_settings_file()` - Permission allowlist

## Troubleshooting

**"No authentication configured"**
- Run `claude login` first, or
- Set `CLAUDE_CODE_OAUTH_TOKEN`, or
- Set `ANTHROPIC_API_KEY`

**Session times out**
- Default timeout is 30 minutes per session
- Increase `timeout` in `run_claude_session()` if needed

**Permission denied errors**
- Check the allowlist in `create_settings_file()`
- Add missing commands if safe to do so

## Sources

Based on:
- [Anthropic Claude Quickstarts - Autonomous Coding](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding)
- [Claude Code SDK Docker](https://github.com/cabinlab/claude-code-sdk-docker) - OAuth token setup
- [Claude Code OAuth Token Issue](https://github.com/anthropics/claude-code/issues/6536) - Discussion on SDK limitations
