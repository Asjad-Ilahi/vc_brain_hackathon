# Sourcing and Intelligence Tasks

Based on the [VC Brain Challenge Brief](README.md), the following areas in Sourcing and Intelligence require further development, refinement, or UI integration.

## 1. Outbound Activation & Outreach Pipeline (Core Requirement)
**Status**: Partially Implemented (`src/lib/services/outreach.ts`)
**What's Missing**: 
- The backend drafts outreach messages, but there is no mechanism or UI to review, approve, and "send" these cold outreach emails.
- **Task 1.1**: Build the **Outreach Command Center UI** to let investors review AI-drafted messages and trigger activation.
- **Task 1.2**: Implement the state transition in the pipeline: `Sourced` → `Activated` (Outreach Sent) → `Inbound` (Application Received).

## 2. Agentic Traceability & Chain-of-Thought UI (Stretch Goal 1)
**Status**: Backend implemented (`reasoningSteps` table), UI visualization missing
**What's Missing**:
- Every recommendation must visually cite the exact data point (e.g., a specific line from a pitch deck or a GitHub commit) that drove the conclusion.
- **Task 2.1**: Implement a **Step-Level Chain of Thought UI** in the Opportunity Details page to visualize the `reasoningSteps` and map them directly to highlighted evidence from the signals.

## 3. Advanced Confidence Scoring & Prediction Intervals (Area of Research 1)
**Status**: Basic confidence [0, 1] implemented in `score.ts`
**What's Missing**:
- No explicit prediction intervals or models evaluating soft-skill assessments like "resilience" or "founder-market fit."
- **Task 3.1**: Enhance the Founder Axis scoring in `score.ts` to output explicit soft-skill metrics with prediction intervals (e.g., "Resilience: 80% ± 10%").
- **Task 3.2**: Visualize the prediction intervals and confidence ranges in the 3-axis screening UI.

## 4. Data Quality vs. Volume Management (Area of Research 2)
**Status**: Basic conviction threshold filtering exists
**What's Missing**:
- The system doesn't explicitly flag or prune low-confidence data points before they poison the intelligence layer. 
- **Task 4.1**: Implement a **Data Intake Filter** that assesses the reliability of a source *before* recording a signal, and automatically flags or discards low-quality noise.

## 5. Sourcing Graph Optimization Feedback Loop (Stretch Goal 3)
**Status**: Backend metrics calculated (`src/lib/services/channels.ts`), feedback loop incomplete
**What's Missing**:
- The model doesn't automatically adjust its sourcing sweep behavior based on historic conversion quality.
- **Task 5.1**: Build a feedback loop that updates the `enabledSources` or weighting of different channels dynamically based on the `quality` metrics computed in `channels.ts`.

## 6. Self-Correction Validator Agent Expansion (Stretch Goal 2)
**Status**: Implemented for memo claims (`memo.ts`)
**What's Missing**:
- Needs a more robust market database cross-referencing system. Currently, it relies on a single Tavily query.
- **Task 6.1**: Expand the Validator Agent to perform multi-step verification against specific comparable funding rounds and explicit competitor databases.
