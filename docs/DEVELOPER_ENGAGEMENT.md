# Engaging Developers Without Traditional Salary

A practical guide for bootstrapped founders who need development help but can't afford market-rate salaries.

---

## The Reality Check

**AI (like me) is great for:**
- Greenfield features with clear specs
- Boilerplate and scaffolding
- Refactoring with defined patterns
- Documentation and tests

**AI struggles with:**
- Subtle bugs that require deep context
- Debugging production issues
- UI/UX polish and feel
- Architecture decisions with tradeoffs
- Maintaining coherence across many files over time

You're right that AI can go "out of alignment" on bug fixes and create bigger issues. A human developer with context is often faster for these tasks.

---

## Option 1: Unpaid Internships (Careful Here)

### Legal Requirements (US - check your jurisdiction)

Unpaid internships must meet ALL of these criteria (DOL guidelines):
1. Training is similar to an educational environment
2. Experience is for the intern's benefit
3. Intern doesn't displace regular employees
4. Employer gets no immediate advantage from work
5. No guarantee of job at the end
6. Both parties understand it's unpaid

**Reality:** If they're doing production work that benefits you, it's probably not legal to be unpaid.

### When It Works

✅ **University credit programs**
- Student gets academic credit
- School has formal internship program
- Structured learning objectives
- Faculty supervisor involved

✅ **Genuine mentorship**
- They're learning, not producing
- Pair programming with you
- Code reviews and teaching
- You're investing time, not extracting value

### When It Doesn't Work

❌ "Build this feature, it's good experience"
❌ "Fix these bugs, add it to your portfolio"
❌ Anything that looks like employment without pay

---

## Option 2: Stipend Internships (Recommended)

### How It Works

Pay something, but below market rate. The deal:
- They get: Real experience, portfolio piece, mentorship, stipend
- You get: Development work, fresh perspective, future hire pipeline

### Typical Stipends (2024)

| Context | Monthly Range | Notes |
|---------|---------------|-------|
| US (remote) | $500-2000 | Cover basics, not living wage |
| University program | $0-1500 | Often subsidized by school |
| Developing markets | $200-800 | Can be meaningful there |
| Part-time (10hr/wk) | $200-500 | Supplement, not income |

### Structure It Right

```
Internship Agreement:
├── Duration: 3-6 months (fixed term)
├── Hours: 10-20 per week (part-time)
├── Stipend: $X/month
├── Deliverables: Specific features/tasks
├── Mentorship: Weekly 1:1 calls
├── IP: Work belongs to company
├── No employment relationship
└── Exit: Clean end date
```

### Find Them

1. **University career boards** - Post as "paid internship"
2. **Bootcamp partnerships** - Coding bootcamps place grads
3. **Discord/Slack communities** - Junior developer channels
4. **Twitter/X** - "Looking for intern" posts
5. **Local meetups** - People wanting to break in

---

## Option 3: Equity / Ownership

### The Problem

"I'll give you 10% equity" sounds good until:
- Company is worth $0 and might stay that way
- No liquidity for years (if ever)
- They can't pay rent with equity
- Disagreements about valuation

### Vesting Explained

**Vesting** = Equity earned over time, not all at once

Standard: **4-year vesting with 1-year cliff**

```
Timeline:
├── Month 0-11: No equity earned yet (cliff period)
├── Month 12: 25% vests (cliff)
├── Month 13-48: Remaining 75% vests monthly
└── Month 48: 100% vested

Example: 4% grant with 4-year vesting
├── Year 1 (after cliff): 1%
├── Year 2: 2%
├── Year 3: 3%
└── Year 4: 4%

If they leave at month 8: 0%
If they leave at month 14: 1.08% (25% + 2 months of remaining)
```

### Cliff Explained

The **cliff** protects you from:
- Someone getting equity then leaving immediately
- Testing fit before commitment

1-year cliff is standard. Before that, they get nothing.

### Options vs. Shares

| Stock Options | Actual Shares |
|---------------|---------------|
| Right to buy at set price | Ownership now |
| Must exercise (pay) to own | Already own |
| Tax on exercise + sale | Tax on grant + sale |
| Common for employees | Common for founders/early |
| More complex | Simpler |

For early contributors, **options** are usually better (for tax reasons).

### Realistic Equity Grants

| Role | Typical Range | Notes |
|------|---------------|-------|
| Co-founder | 20-50% | Day 1, full commitment |
| First employee | 1-5% | Full-time, critical role |
| Early intern | 0.1-0.5% | Part-time, learning |
| Contractor (equity comp) | 0.25-1% | Short engagement |

**Warning:** 0.1% of nothing is nothing. Equity is lottery ticket.

### When Equity Works

✅ They believe in the mission
✅ They have runway (savings, other income)
✅ Clear vesting terms in writing
✅ Both understand it might be worthless

### When Equity Fails

❌ Used to avoid paying anything
❌ Vague "we'll figure out the split later"
❌ They need income to survive
❌ No vesting (they can walk with equity)

---

## Option 4: Revenue Share

### How It Works

Instead of equity, share revenue from specific work:
- "You build the billing system, you get 5% of revenue for 2 years"
- "You build feature X, you get $Y per customer who uses it"

### Pros
- Aligns incentives with actual results
- No complex equity paperwork
- Easier to understand
- Can sunset (unlike equity)

### Cons
- Hard to track attribution
- Complicates accounting
- Might exceed what equity would have paid

### Template

```
Revenue Share Agreement:
├── Scope: Specific feature/module
├── Share: X% of revenue from [defined source]
├── Duration: Y years from launch
├── Cap: Maximum $Z total
├── Reporting: Monthly revenue reports
└── Termination: On cap hit or duration end
```

---

## Option 5: Bounties / Contracts

### Per-Feature Bounties

Post specific tasks with fixed prices:
- "Implement OAuth login - $300"
- "Fix pagination bug - $50"
- "Add export to CSV - $150"

**Where to post:**
- GitHub Issues (tag with bounty)
- Gitcoin (crypto projects)
- Bountysource
- Your Discord/community

### Pros
- Pay only for completed work
- No ongoing commitment
- Global talent pool
- Clear scope and price

### Cons
- Quality varies
- May need cleanup after
- No context building
- Transactional relationship

---

## Option 6: Open Source Contributors

### Different Model Entirely

Open source contributors aren't employees or interns. They contribute because:
- They use the software and want improvements
- Building their reputation
- Learning in public
- Believe in the mission

### How to Attract Contributors

1. **Make it easy to contribute**
   - Good CONTRIBUTING.md
   - "Good first issue" labels
   - Clear code structure
   - Fast PR reviews

2. **Recognition**
   - Contributors page on website
   - Public thank-yous
   - Swag (stickers, t-shirts)
   - Reference letters

3. **Community**
   - Discord/Slack for chat
   - Regular calls/streams
   - Roadmap visibility
   - Decision input

### What You Can't Expect

- Specific timelines
- Production support
- Reliability
- Taking direction like an employee

### What You Can Hope For

- Bug fixes for issues they hit
- Features they personally need
- Code reviews
- Testing and feedback
- Evangelism

---

## Option 7: Deferred Compensation

### How It Works

"Work now, get paid later when we have money"

```
Agreement:
├── Work: X hours over Y months
├── Rate: $Z/hour (fair market)
├── Payment trigger: When company reaches [milestone]
│   ├── Option A: Revenue > $X/month
│   ├── Option B: Funding raised
│   └── Option C: Acquisition
├── Expiration: Agreement voids if trigger not hit by [date]
└── Priority: Paid before founders take salary
```

### Pros
- Fair valuation of work
- Not equity (no ownership dilution)
- Clear terms

### Cons
- Still might never pay out
- Accounting complexity
- Trust required

---

## Hybrid Approaches

### Stipend + Equity

```
├── Stipend: $500/month (survival money)
└── Equity: 0.25% over 2 years (upside)
```

### Bounties + Revenue Share

```
├── Bounty: $500 to build feature
└── Revenue share: 2% of that feature's revenue for 1 year
```

### Contract-to-Hire

```
├── Phase 1: Contract at $X/hour (fixed scope)
├── Phase 2: If fit is good, offer full-time
└── Equity vesting starts at hire date
```

---

## Practical Advice

### What Works for Early Stage

1. **Find people who want the experience**
   - Career changers
   - Bootcamp grads
   - Self-taught developers
   - Students

2. **Offer real value**
   - Mentorship and teaching
   - Real portfolio pieces
   - Reference letters
   - Network introductions

3. **Be transparent**
   - "We can't pay market rate"
   - "Here's what we can offer"
   - "Here's the risk"
   - "Here's the potential upside"

4. **Structure it formally**
   - Written agreements
   - Clear expectations
   - Defined duration
   - Clean exit

### Red Flags (For You)

- They need this to pay rent → Don't do equity-only
- They don't understand vesting → Educate or don't proceed
- "We'll figure it out later" → Figure it out now

### Red Flags (For Them)

- No written agreement → Get it in writing
- "Equity could be worth millions" → Probably won't be
- Vague scope, endless work → Define boundaries
- No cliff, immediate full vest → Unusual, ask why

---

## Template: Intern/Contributor Agreement

```markdown
# Contributor Agreement

Between: [Your Company] ("Company")
And: [Contributor Name] ("Contributor")

## Engagement
- Role: Development Contributor
- Duration: [3 months] starting [date]
- Hours: Approximately [15] hours per week
- This is not an employment relationship.

## Compensation
- Stipend: $[X] per month
- Equity: [0.25]% stock options, 2-year vesting, 6-month cliff
- Expenses: None covered

## Deliverables
- [List specific features/tasks]

## Intellectual Property
All work product belongs to Company.

## Mentorship
Company provides:
- Weekly 1:1 video calls
- Code reviews on all PRs
- Architecture guidance

## Termination
Either party may end with 2 weeks notice.
Vested equity is retained.

## Signatures
[...]
```

---

## Bottom Line

1. **Pay something if you can** - Even $500/month changes the dynamic
2. **Be honest about the deal** - Underpaying for upside only works if there's real upside
3. **Write it down** - Verbal agreements cause problems later
4. **Vesting protects both sides** - Always use it for equity
5. **Open source ≠ free labor** - Different relationship, different expectations

The best early contributors are people who:
- Believe in what you're building
- Have some financial runway
- Want the experience genuinely
- Understand the risk

Find those people, treat them well, and many will become your best employees when you can afford to pay market rate.
