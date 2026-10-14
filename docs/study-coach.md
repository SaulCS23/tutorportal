# Adaptive Study Coach

Visit `/study-coach` after running `npm run dev`.

This first iteration uses an **explainable rules engine**, not an LLM or trained ML model. It prioritizes topics with lower recent accuracy and assigns a time budget. It runs entirely in the browser: no credentials, paid API, or student records are required.

## Design decisions
- Accuracy <60%: concept review; 60–79%: targeted practice; >=80%: timed practice.
- Input validation prevents impossible scores and out-of-range time budgets.
- The plan is a suggestion, not a prediction of exam performance.
- No persistent student data, analytics, or user tracking.

## Next iterations
1. Connect to authenticated homework results and store progress with access controls.
2. Use spaced repetition and confidence-weighted mastery estimates.
3. Add instructor-approved practice questions and measure improvement over time.
4. Only then consider LLM-assisted explanations with privacy safeguards.

## Verification
Run `npm install`, `npx tsc --noEmit`, and `npm run build`. This branch was created without running the project's full build in a network-enabled environment.
