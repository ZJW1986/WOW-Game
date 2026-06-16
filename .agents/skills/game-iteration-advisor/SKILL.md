---
name: game-iteration-advisor
description: Generate next-version recommendations from Play feedback and gameplay metrics for the AI game production platform. Use after a game has been published and player feedback, rating, play length, failure points, or restart data exists.
---

# Game Iteration Advisor

Turn Play feedback into the next version plan.

## Inputs

- Published version
- GDD
- QA report
- Player rating
- Comments
- Play duration, failure points, restart count when available

## Output

Return an iteration report with:

- priority
- recommended change
- affected artifact
- expected player impact
- validation check

Prefer small changes that can pass through the same standard pipeline again.
