# Guided Learning Strategy — Evidence Notes

Updated: 2026-07-13

This file is the source record for `guided-learning-strategy.artifact.json`. It separates verified repository evidence, external research, recommendations, and open assumptions so product decisions are auditable.

## Product question

How can Weakspot English Coach help learners who do not know what to paste, what to watch, what to say, or what they need to practise, while preserving every existing tool and improving the quality of weakness evidence?

## Verified repository evidence

### The existing back end already has a strong learning loop

- `apps/api/app/services/decision_service.py` ranks the next skill and practice type from mastery gap, error density, prior failure and time since practice.
- `apps/api/app/services/stealth_practice_service.py` selects due weakness probes, creates natural opportunities in chat, distinguishes `success`, `hinted_success`, `failure`, `avoided` and `no_opportunity`, and already supports `replay`, `variation` and `transfer` progression.
- `apps/api/app/services/memory_service.py` requires repeated evidence across attempts, dates, task types and time before a weakness graduates. A single correct answer is not enough.
- `apps/api/app/services/session_analysis_service.py` extracts corrections, natural expressions and weaknesses after chat.
- `apps/api/app/services/input_learning_service.py` correctly separates grounded extraction from an attention mission when source text is unavailable. It does not invent quotations.
- `apps/api/app/services/chat_service.py` retrieves learner memory and can provide sentence-completion help when the learner is stuck.

Conclusion: the highest-value missing layer is not another diagnostic model. It is an activity orchestrator that decides what the learner should do now and creates a fair opportunity to produce English.

### The present user journey still asks the learner to create the activity

- `apps/web/components/diagnostic-input.tsx` starts from pasted writing. Example text reduces blank-page friction but does not produce evidence about the learner unless they replace it with their own output.
- `apps/web/app/chat/page.tsx` provides a small fixed scenario list. The learner still enters an empty conversation and normally has to write first.
- `apps/api/app/models/chat.py` accepts `scenarioPrompt`, but the current send-message path does not consistently turn it into a stateful goal, complication, success condition and AI opening line.
- `/chat/predict` already exists in `apps/api/app/api/routes/chat.py`, but the text-chat UI does not yet expose a graduated “I’m stuck” flow.
- `apps/web/app/input/page.tsx` supports useful before/during/after guidance, but the user still chooses the source and may need to find subtitles. The UI does not require a retell or new-context reuse that can become production evidence.
- New profiles fall back to B1 and `grammar.verb_tense`; this is a cold-start default, not an assessment of the learner.
- `SkillState` records mastery and success/error counts but does not explicitly model `unassessed` coverage by modality, context or independence.

### Existing infrastructure that should be reused

- Memory: goals, preferences, strategies, weaknesses and episodes.
- Decision service: prioritisation of due or weak skills.
- Stealth probes: fair opportunity gating, hint level, independent versus assisted success, and strategy-arm learning.
- Chat, Diagnose and Practice: output collection and scoring.
- Input Learning: grounded source processing and episode memory.
- Stats and Plan: surfaces that can host a daily recommendation, although completion and skip signals need stronger persistence.

## External evidence used in the recommendation

1. ACTFL’s 2024 proficiency guidance frames performance across function, accuracy, context/content and text type. One successful sentence in one setting is not broad proficiency evidence.  
   Source: https://www.actfl.org/uploads/files/general/Resources-Publications/ACTFL_Proficiency_Guidelines_2024.pdf

2. The CEFR Companion Volume includes real-world activities such as information exchange, obtaining goods and services, goal-oriented cooperation, interviewing, mediation and explaining data. These are useful task families for generated missions.  
   Source: https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4

3. Diagnostic language assessment should connect observations and targeted instruments to useful support and decisions; a single isolated example is insufficient.  
   Source: https://doi.org/10.1177/0265532214564505

4. An elicited-imitation meta-analysis found the task can discriminate proficiency, but design, sentence length and scoring affect the result. It should be one short probe, not the whole diagnostic.  
   Source: https://doi.org/10.1177/0265532215594643

5. Captioned-video evidence supports comprehension and vocabulary learning, but viewing alone does not demonstrate independent production. Retell and transfer steps are therefore product-design inferences, not claims that captions directly create speaking mastery.  
   Source: https://doi.org/10.1016/j.system.2013.07.013

6. Oral corrective-feedback evidence supports feedback that gives learners an opportunity to self-repair instead of immediately replacing their answer.  
   Source: https://doi.org/10.1017/S0272263109990520

7. Spacing research supports delayed retrieval, and task-repetition research supports combining an immediate redo with later variations.  
   Sources: https://doi.org/10.1111/lang.12479 and https://doi.org/10.1016/j.system.2025.103868

8. Automatic speech recognition can perform unevenly across non-native accents. ASR transcripts must not be treated as unquestionable pronunciation or grammar evidence.  
   Source: https://doi.org/10.1016/j.csl.2023.101567

9. Early AI role-play evidence is promising but narrow and small-sample. The recommendation therefore treats role-play as a mission format to validate, not a proven replacement for human interaction.  
   Source: https://doi.org/10.1002/tesq.70010

## Product synthesis

### Recommended primary experience

Add a single high-confidence entry point: **Today’s Mission / Coach Mode**.

The learner chooses only:

- available time: 5, 10 or 15 minutes;
- text or voice;
- energy: light, normal or challenge.

The system chooses the task, material, target and follow-up from:

- due weaknesses and relapse risk;
- abilities with insufficient evidence;
- a need to transfer a skill to a different setting;
- the learner’s goals, interests and recent activity;
- novelty and fatigue controls.

The shared activity loop is:

1. system supplies the stimulus and starts the scene;
2. learner gives an independent first answer;
3. system offers graduated help only when needed;
4. feedback focuses on one or two high-value issues;
5. learner self-corrects and immediately retries;
6. the same target returns later in a different context;
7. evidence is stored with task, modality, context and support level.

### Mission portfolio

- `guided_scene`: a stateful role-play with role, visible goal, hidden information, complication and success conditions;
- `picture_story`: describe one image or narrate an image sequence;
- `listen_retell`: hear a short graded item, answer for comprehension, then retell;
- `information_gap`: ask, clarify and confirm to recover missing information;
- `micro_write`: answer a realistic message, explain a decision or recount an event;
- `input_loop`: watch/read/listen, notice useful language, close the source, retell and reuse it in a new scene.

These formats should rotate because each creates different evidence. Unlimited random topics alone would add novelty without guaranteeing a fair diagnostic opportunity.

### Scene Director

Generate scenes from:

`role × setting × relationship × goal × obstacle × register × target skill`

Every scene needs:

- an AI opening line;
- a visible learner objective;
- a state that changes after each turn;
- a complication or twist;
- clear success conditions;
- a fingerprint to avoid accidental repetition;
- four help levels: intent hint, keyword, sentence starter and full model.

Using help must be recorded. A correct response after a full model is useful practice but is not independent mastery evidence.

### Input Lab 2.0

Make system-provided, graded micro-content the default. External links and user subtitles remain optional tools, so no existing feature is removed.

Recommended flow:

1. listen or watch once without captions;
2. answer one comprehension question;
3. reveal verified English captions if needed;
4. notice one to three useful chunks;
5. close captions and retell;
6. use one chunk in a new personal or role-play situation;
7. retrieve it again after a delay.

Start with a small owned or clearly licensed library. Automatic subtitle ingestion should degrade safely to an attention mission when captions or rights are unclear.

### Evidence and weakness states

Keep weakness status separate from assessment coverage.

- Coverage: `unassessed → exploring → enough evidence`.
- Weakness: `suspected → supported → assisted → independent → stable → archived`.

The system must retain:

- independent first output;
- hint level and model exposure;
- immediate repair;
- delayed retrieval;
- new-context transfer;
- modality and task type;
- fair-opportunity outcome;
- confidence and ASR uncertainty.

“No recorded mistake” must never silently mean “mastered.” It can also mean the learner has never received a fair opportunity.

## Proposed implementation boundaries

### Directional delivery-readiness rubric

The report visual uses a planning index from 1 to 5. It is not learner telemetry or an engineering estimate in days. The index is a transparent synthesis of three reviewed factors: how much existing code can be reused, whether a new persistent evidence model is required, and whether curated content or a new reliability boundary is required.

- 5 — text-chat graduated hints: the back-end prediction endpoint and hint semantics already exist;
- 4 — Today’s Mission, Scene Director and Input-to-Output loop: mostly orchestration and UI around existing services, with bounded new state;
- 2 — Discovery Sprint and SkillCoverage: requires a cross-surface evidence model and new selection logic;
- 1 — owned content plus broader speaking assessment: requires editorial operations, rights metadata and stronger audio reliability work.

This ordering is directional and must be re-estimated during technical design.

### P0 — remove the blank state with maximum reuse

1. Add “Today’s Mission” as the primary home action while retaining all existing tools.
2. Add a thin coach orchestration endpoint around Decision, Memory, Practice, Chat and stealth probes.
3. Make AI open every guided scene and persist the scene specification.
4. Connect the existing text-chat prediction endpoint to graduated hints.
5. Add an output and reuse step after every Input Lab mission.
6. Replace generic Daily Wins routing with the same coach recommendation.

### P1 — improve discovery and learning evidence

1. Add `ActivityRun` to record assignment, start, completion, skip and abandonment.
2. Add a cross-surface `EvidenceEvent` with modality, task, opportunity, support and outcome.
3. Add `SkillCoverage` so untested abilities can be explored deliberately.
4. Build a small graded content catalogue with verified transcripts and rights metadata.
5. Persist Plan completion and skip reasons so the coach can learn task fit.

### P2 — broaden the language model carefully

1. Add interaction, retell, listening and fluency dimensions.
2. Add dedicated pronunciation evidence only when audio scoring is reliable enough; do not infer it solely from ASR text.
3. Calibrate task selection using observed delayed-transfer outcomes.

## Measurement framework

No product-event baseline currently exists for this proposed journey. Absolute launch targets would be invented. Instrument first, establish a two-week baseline, and then use relative comparisons between the coach-led journey and the current tool-led journey.

Primary outcomes:

- **First meaningful output:** a new learner completes a scorable independent output during the first session.
- **Evidence yield:** fair, scorable independent opportunities per started guided mission.
- **Delayed transfer:** a due target is used independently in a later, novel context.

Drivers:

- one-tap mission start and completion;
- input-to-output completion;
- reduction in required hint level;
- growth in assessed skill/modality coverage;
- scenario novelty and voluntary return.

Guardrails:

- `no_opportunity`, contradiction and suspected false-weakness rate;
- abandonment and repeated “too hard” feedback;
- ASR-uncertain evidence entering the weakness model;
- latency and inference cost;
- unsafe or unlicensed source content;
- too much testing and too little enjoyable practice.

## Open product questions

- Should the first version support text only for faster evidence quality, or text and voice together?
- Which learner goal should receive the first owned content pack: everyday life, work, travel or study?
- What is the minimum scene state that remains reliable across model providers?
- Should users see the exact weakness target before a stealth probe, or only after completing it?
- How should learners correct a mistaken system inference without deleting the historical evidence?

## Caveats

- This is a repository and research synthesis, not an analysis of real learner event data.
- Research task effects are population- and implementation-dependent; they justify experiments, not guaranteed product outcomes.
- AI role-play and ASR-based assessment need stricter validation than text tasks.
- The owned-content recommendation carries editorial, copyright and maintenance cost.
- ACTFL Can-Do wording has usage restrictions; the product may use the underlying dimensions but should not copy restricted commercial text without permission.
