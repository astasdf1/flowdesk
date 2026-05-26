# FlowDesk Workflow Dispatch + Model Selection Design — V1

**Date**: 2026-05-26  
**Goal**: Main agent plans work, splits it into subtasks, assigns an agent per subtask, and selects the best available model using usage, performance, and task-fit.

---

## 1. Core principle

1. **Agent selection is role-based**.
   - The task type decides which agent profile should be used.
   - Example: security → `reviewer-claude-opus`, architecture → `reviewer-gpt-frontier`, verification → `reviewer-gemini-pro`.

2. **Model selection is score-based** among available models.
   - Only models that are currently available and policy-eligible may be considered.
   - The model picker combines:
     - usage headroom
     - historical performance
     - task fit / model-family suitability
     - policy / availability constraints

3. **Main agent does not do the work itself**.
   - It creates a workflow plan.
   - It dispatches subtasks.
   - It summarizes results.

---

## 2. Existing building blocks we can reuse

- `flowdesk_agent_task_run` for one subtask on one agent/model
- `flowdesk_quick_reviewer_run` for multi-perspective review fan-out
- `flowdesk_status_live` for workflow/result/status aggregation
- `flowdesk_provider_usage_live` for provider usage pressure
- `exact_model_availability_cache.v1` for currently available models
- `eligibleEntries()` in `model-availability-cache.ts` already ranks by:
  1. model-family preference
  2. usage pressure
  3. stable deterministic tiebreaker

This design extends the existing ranking instead of replacing it.

---

## 3. Agent assignment design

### 3.1 Default agent map

| Task class | Default agent |
|---|---|
| Security / policy | `reviewer-claude-opus` |
| Architecture / design | `reviewer-gpt-frontier` |
| Verification / test / implementation check | `reviewer-gemini-pro` |
| General subtask | `reviewer-gpt-frontier` |

### 3.2 Agent selection rule

1. Classify the user request into workflow task classes.
2. Split into subtasks if multiple perspectives are needed.
3. Assign each subtask a default agent from the table above.
4. Allow explicit user override only if it stays inside the same safe family.

### 3.3 Agent selection output

The planner should emit:

- `workflow_id`
- `goal_summary`
- `subtasks[]`
  - `subtask_id`
  - `task_role`
  - `agent_name`
  - `model_family_preference[]`
  - `prompt`
  - `requires_provider_call`

---

## 4. Model selection design

### 4.1 Candidate pool

Only models satisfying all of these are eligible:

- present in `exact_model_availability_cache.v1`
- `registered === true`
- `available === true`
- `highest_tier_eligible === true`
- provider/auth/usage evidence is present and fresh enough

### 4.2 Scoring dimensions

Each candidate model gets a score:

| Dimension | Source | Meaning |
|---|---|---|
| Suitability | model family preference | how well the model family matches the task role |
| Usage headroom | provider usage snapshot / pressure label | avoids overloaded models |
| Performance | historical task success / response quality | favors models that have worked well for similar tasks |
| Fit | task-specific constraints | e.g. code review, architecture reasoning, verification strictness |

### 4.3 Suggested weight model

Proposed score formula:

```
final_score =
  0.40 * fit_score +
  0.30 * performance_score +
  0.20 * usage_headroom_score +
  0.10 * availability_stability_score
```

- **fit_score**: task-role fit (0..1)
- **performance_score**: historical success on similar tasks (0..1)
- **usage_headroom_score**: derived from `ok/warning/critical/exhausted/unknown`
- **availability_stability_score**: recency/freshness of usage and cache evidence

### 4.4 Usage pressure mapping

Re-use the existing pressure ordering:

| pressure | score |
|---|---:|
| ok | 1.0 |
| warning | 0.65 |
| critical | 0.25 |
| exhausted | 0.0 |
| unknown | 0.15 |

### 4.5 Performance score (new evidence-driven input)

Add a durable model performance summary later, sourced from prior task results:

- task completion success rate
- result acceptance rate
- average correction count
- timeout rate

If no performance evidence exists, use a neutral default (`0.5`) rather than blocking.

### 4.6 Fit score

Task-role to model-family fit defaults:

| Role | Preferred families |
|---|---|
| Security / policy | claude |
| Architecture / reasoning | openai |
| Verification / implementation | gemini |
| General task | openai, claude |

This is only a preference, not a hard requirement.

---

## 5. Workflow decomposition design

### 5.1 Workflow planner

Create a workflow planner that returns:

- overall goal
- subtask list
- agent assignment per subtask
- model candidate ranking per subtask
- dependency graph (optional)

### 5.2 Dispatch policy

| Task shape | Dispatch style |
|---|---|
| One clear task | single `flowdesk_agent_task_run` |
| Several independent angles | parallel multi-task dispatch |
| Review-like work | `flowdesk_quick_reviewer_run` |
| Long multi-step project | workflow plan + several agent tasks + final synthesis |

### 5.3 Result aggregation

Each subtask returns:

- `summaryForUser`
- raw result text (truncated for display)
- task evidence ids

The main agent then synthesizes:

- what each lane said
- which model was chosen and why
- blockers / next actions

---

## 6. Priority order for implementation

### Phase 1
- keep current single-task dispatch (`flowdesk_agent_task_run`)
- add workflow planner structure
- add model score selection helper

### Phase 2
- implement multi-task workflow dispatch
- parallel lane launch
- aggregate results and status summary

### Phase 3
- persist model performance evidence
- improve selection with historical quality/success data
- add auto-routing heuristics to main agent prompt

---

## 7. Important safety constraints

- Never pick a model that is unavailable or unauthenticated
- Never promote fallback/model switching outside explicit workflow selection rules
- Never use hidden OMO-style prompt injection
- Never let the main agent bypass FlowDesk evidence
- Keep `dispatch_authority_enabled=false` in all planner/evidence records

---

## 8. Implementation note

The key design choice is:

> **Agent = role binding, Model = score-based selection among eligible models**

This gives deterministic behavior, uses existing usage/availability evidence, and keeps the main agent focused on orchestration only.
