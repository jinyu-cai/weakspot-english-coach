# WeakSpot English Coach — Demo Video Script
# H0 Hackathon · Target runtime: 2:30

---

## NARRATION SCRIPT (read this aloud as voiceover)

---

### Scene 1 — Hook (0:00–0:25)
**[Show: home page at englearning.jinxxx.de — sample paragraph in textarea]**

> "I'm two months into studying in the United States.
> My grades are fine — but I still struggle to connect with people around me.
> Not because I don't want to. Because when a conversation gets deep,
> the words just aren't there fast enough.
> And that gap — between what you mean and what you can say —
> makes it really hard to build genuine friendships.
>
> I built WeakSpot for people like me.
> Not another grammar app — but a system that learns exactly where *your* English breaks down,
> and fixes those specific gaps, session after session.
> Because most AI tutors are stateless. Every session starts from zero.
> WeakSpot remembers. It discovers what you need to practice —
> by analyzing your actual writing and tracking your weaknesses over time."

---

### Scene 2 — Diagnose: Input → Analysis (0:18–0:50)
**[Show: click "Analyze My English" → loading → results appear]**

> "A learner pastes any English they've written — a paragraph, an email, a chat message.
> WeakSpot sends it to our AI, which analyzes it against **11 error categories**:
> verb tense, articles, prepositions, word choice, register, sentence variety, clarity, transitions,
> repetition, Chinese-English transfer patterns, and completeness.
>
> The result is a full diagnostic report. The learner sees their **CEFR level estimate**, a score,
> and two sections: **Strengths** — what they already do well — and **Weaknesses** — the specific errors,
> each tagged to a skill category with a micro-lesson explaining the rule.
>
> Below that is a **corrected reference version** of their original text — not just marking errors,
> but showing exactly how a fluent speaker would say the same thing."

---

### Scene 3 — Notebook & History (0:50–1:05)
**[Show: navigate to Notebook → then History → show past submission entries]**

> "Every error from this diagnosis can be saved directly to the learner's **Notebook** for later review.
> And in **History**, every past submission is permanently logged — so learners can revisit any writing
> they've done and see exactly what mistakes they made that day."

---

### Scene 4 — Dashboard: The DynamoDB Proof (1:05–1:22)
**[Show: /dashboard — radar chart + skill bars + stat cards]**

> "Here is the key to the entire system: the **Dashboard**.
> This isn't a summary generated fresh each time — it's a live view of the learner's **DynamoDB weakness profile**.
> Every diagnosis writes structured error data into Amazon DynamoDB, updating skill mastery scores
> across all 11 categories. The database IS the learner's long-term memory.
> The radar chart shows at a glance where they're weakest. It gets more accurate with every submission."

---

### Scene 5 — 7-Day Plan (1:22–1:42)
**[Show: /plan → click "Generate Plan" → plan cards appear with skill tags]**

> "With one click, WeakSpot generates a personalized **7-Day Study Plan** —
> pulled directly from the DynamoDB weakness profile.
> The weakest skills come first. Every day targets a real gap, not a generic curriculum.
> The plan updates as the learner improves, so it's never the same plan twice."

---

### Scene 6 — Practice (1:42–2:00)
**[Show: /practice → exercise loads → learner types answer → grade + feedback appears]**

> "Practice exercises are **generated on demand** from the learner's weakness profile.
> Each exercise targets a specific error category. The learner submits their answer,
> the AI grades it and explains any mistakes, and the attempt is written back to DynamoDB —
> updating the skill mastery score in real time."

---

### Scene 7 — Chat: Text + Speaking (2:00–2:25)
**[Show: Chat page — text input mode → conversation → analysis panel after session]**

> "The **Chat** feature lets learners practice conversational English in real time.
>
> In text mode, after each session, WeakSpot automatically analyzes everything the learner typed,
> extracts all errors, and writes them into the personal weakness library —
> so even casual conversation becomes a source of diagnostic data.
>
> In **speaking mode**, the learner practices out loud. But here's where it gets genuinely different:
> when a learner hesitates mid-sentence — pausing because they can't find the right word —
> the system uses **function calling** to predict what they were about to say
> and surfaces candidate expressions in real time.
> It's not just transcription. It's live vocabulary scaffolding."

---

### Scene 8 — DynamoDB Architecture (2:25–2:38)
**[Show: AWS Console — WeakSpotEnglishCoach table — highlight PK/SK columns]**

> "Under the hood: **one DynamoDB table**, named WeakSpotEnglishCoach.
> Single-table design. Partition key: `USER#{learnerId}`.
> Sort keys encode every entity type — profile, skills, submissions, errors, plans, exercises, attempts.
> One contiguous partition per learner. Pay-per-request. Zero cold starts. Serverless."

---

### Scene 9 — Closing Loop (2:38–2:50)
**[Show: loop diagram — then product name + URL]**

> "Diagnose → Profile → Plan → Practice → Grade → Update. Every interaction tightens the model.
> WeakSpot English Coach — built with Vercel v0, FastAPI, DeepSeek, and Amazon DynamoDB single-table design.
> Visit englearning.jinxxx.de."

---

## FEATURE HIGHLIGHTS FOR DEVPOST TEXT

Highlights not obvious from UI screenshots:

- **Strengths AND weaknesses** — most tools only mark errors; WeakSpot also affirms what learners do well, which is critical for motivation.
- **Corrected reference text** — learners see a fluent rewrite of their own words, not abstract grammar rules. This is far more memorable.
- **Chat → weakness library pipeline** — every casual chat session is silently analyzed and feeds the weakness profile; the learner doesn't have to do anything special.
- **Speaking + function-call word prediction** — when learners hesitate, the system predicts their intended words using function calling, surfacing vocabulary scaffolds mid-utterance. This closes the gap between knowing a word passively and producing it actively.
- **Notebook** — learners can curate their own error review list rather than relying only on AI-generated exercises.
- **De-duplication** — re-submitting the same text doesn't re-penalize skill scores (tracked via DynamoDB `SUBHASH#` records), so the weakness model stays clean.
- **Manual delete with skill rollback** — deleting a submission reverses its error count impact, maintaining data integrity across the weakness profile.
