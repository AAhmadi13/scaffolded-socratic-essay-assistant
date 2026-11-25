Prose word count (excluding code blocks, commands, and URLs): 963 words

# SocraticCanvas - Scaffolded Socratic Essay Assistant

## Project status

* **Working:** A browser writing canvas with sign-up, a document library, a collapsible outline, font and theme controls (Lora, Inter, Mono, Paper Light, Dark Mode), a floating format bar, and Get Hint. Hints start at Level 1. Level 2 and Level 3 open only from buttons. Nothing inserts or replaces essay text. Editing the flagged paragraph clears the highlight. Demo mode returns one of four fixed JSON hints. Live mode calls Gemini 2.5 Flash only after a reviewer pastes their own key. **Trace** opens a session log for each hint: time, a short selection summary, Demo fallback or Live Gemini, the context that was used, the unlocked levels, a no-replacement check, and latency. Clear empties that log. It stays in memory for the visit and is not saved with the essay.
* **Simulated:** In Demo mode, or in Live mode with no key, the hint is chosen from those four written replies by simple wording rules. It is not a live model judgement.
* **Not in this prototype:** Focus dimming was removed so the page stays visible while typing. Rubric retrieval, argument or fact checking, and a long-term writer profile are not built.

## Technology stack

* **Pages:** HTML, CSS, and vanilla JavaScript (`index.html`, `style.css`, `ui.js`). No framework and no build step. The trace panel is part of the same page.
* **Hint harness:** `app.js` stores the system instruction, checks the JSON fields, and either returns a demo hint or posts to the Gemini API.
* **Model:** Gemini 2.5 Flash when Live mode has a key. A retrieval store for course rubrics is still undecided, because that feature is not built.
* **Development tools:** Cursor’s coding assistant drafted and revised the interface, the harness, and the trace. The result was checked in the browser.

## Running or inspecting the work

No install is required. Clone the repository and open `index.html` in a current browser.

1. Sign up, open a document, and click in a paragraph or highlight a sentence.
2. Leave the hint control on **Demo** and click **Get Hint**. Open Level 2, then Level 3. Edit the highlighted paragraph and confirm the amber mark disappears.
3. For a live reply, open **Aa**, choose **Live Gemini**, and paste your own key. The key stays in this browser only. Do not put it in a file or commit it. `.gitignore` lists `.env`, `config.js`, `.DS_Store`, and `node_modules/`. With no key, the app keeps using the demo hints.
4. Click **Trace**. A new entry starts at Level 1. It updates to Level 2 and then Level 3 as those buttons are used. Demo entries say that a local rule was used and that no API call was made. Live entries name the system instructions, the target excerpt, and surrounding paragraph context when that text was sent.

## Development record

* **Stage 1 — Canvas and explicit trigger** ([5d38171](https://github.com/AAhmadi13/scaffolded-socratic-essay-assistant/commit/5d38171)): Added the editor, document library, collapsible outline, type and theme menu, floating format bar, and a Get Hint button that does nothing until the writer asks. The hint stays off the page until then so the canvas is not filled with feedback. Checked the sidebar, both themes, the format bar, and the hint button in the browser.
* **Stage 2 — API wrapper and demo prompts** ([c38125b](https://github.com/AAhmadi13/scaffolded-socratic-essay-assistant/commit/c38125b)): Added `app.js` so a hint must be JSON (`issue_type`, `level1_flag`, `level2_question`, `level3_template`) and must not rewrite the sentence. Demo mode uses four written replies, for a broad claim, a missing evidence link, a weak transition, and an unsupported claim, so the interaction can be tested with no key. Checked that those replies are questions and frames rather than replacement sentences, and that no key is in the repository.
* **Stage 3 — Three hint levels and no auto-replace** ([832b7db](https://github.com/AAhmadi13/scaffolded-socratic-essay-assistant/commit/832b7db)): Level 1 shows first. Level 2 and Level 3 stay behind buttons so a deeper hint is a choice, not an automatic rewrite. There is no apply or insert control. Editing the flagged paragraph clears the highlight, because the writer’s own edit is the revision. Typing dimming was removed so the header and status bar stay readable. Checked the three steps and the highlight clearance in the browser.
* **Stage 4 — Session trace** ([12fcf68](https://github.com/AAhmadi13/scaffolded-socratic-essay-assistant/commit/12fcf68)): Added the collapsible trace beside the canvas so a reviewer can see how a hint was produced. The log keeps a short summary, the mode, a context line, the unlocked levels, a no-replacement check, and the latency. It is not written to storage, so the essay is not kept in the log. Demo lines state that a local rule was used and that no API call was made. Live lines state whether surrounding paragraph context was sent with the system instructions. The entry starts at Level 1 and updates when Level 2 and Level 3 are opened. Checked those updates, both context lines, and Clear in the browser.

## AI assistance

Cursor’s coding assistant drafted the page, the hint harness, the three-level popover, and the trace panel. Gemini 2.5 Flash is used only in Live mode: the harness asks it for the JSON hint and tells it not to rewrite the sentence. Those replies stay in the popover.

After browser checks, dimming was removed because it hid the header and status bar while typing. A written guardrail sentence was removed. Rejected direct apply/insert controls so hints never write into the essay. The hint card and toolbar were restyled, and the trace field was named Context / Execution. Checked in the browser: one level at a time, highlight clearance on edit, the demo context line, the live context line, and the tier list moving from Level 1 to Level 1, Level 2 and then Level 1, Level 2, Level 3. The Stage 1–3 diffs were reviewed before they were pushed.

## Additional files

Everything needed is in this repository. There is no dataset, install step, or separate ZIP.
