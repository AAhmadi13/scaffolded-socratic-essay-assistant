(function () {
  const SOCRATIC_SYSTEM_PROMPT = `
Diagnose one rhetorical or structural weakness in the student's sentence or paragraph. Check for a broad claim, a missing link to evidence, vague wording, and a weak transition.
Do not write a replacement sentence. Do not rewrite their words.
Reply with JSON only, using these fields:
issue_type is a short label.
level1_flag is one or two sentences about what to look at.
level2_question is one question about evidence or structure.
level3_template is a short bracketed frame, such as [Claim] because [evidence], which matters for [thesis].
`.trim();

  const DEMO_SCAFFOLDS = {
    broad: {
      issue_type: "Broad Claim",
      level1_flag: "This passage states a wide claim. The scope, and the words doing the work, are not pinned down.",
      level2_question: "Which part of this claim can the reader actually check, and what would count as support for it?",
      level3_template: "[Limited claim] holds when [condition], because [evidence], which matters for [thesis]."
    },
    evidence: {
      issue_type: "Missing Evidence Link",
      level1_flag: "A source is named, but the passage does not say what that source shows or how it bears on the claim.",
      level2_question: "What finding from this source supports, or complicates, the point you are making here?",
      level3_template: "While [Author, Year] shows [finding], this matters for [claim] because [link]."
    },
    transition: {
      issue_type: "Weak Transition",
      level1_flag: "This passage stacks more than one idea, and the move from one idea to the next is left implicit.",
      level2_question: "What is the single point of this passage, and how does the next idea follow from it?",
      level3_template: "[Point] follows from [previous idea] because [link], so [next step]."
    },
    unsupported: {
      issue_type: "Unsupported Claim",
      level1_flag: "A claim is made here, but the passage does not yet show the reason a reader should accept it.",
      level2_question: "What specific evidence or example would make this claim hold?",
      level3_template: "[Claim] because [evidence], which matters for [thesis]."
    }
  };

  function buildUserPrompt(selectedText, contextText) {
    const lines = ["Target excerpt to inspect:", `"""${selectedText}"""`];
    const context = (contextText || "").trim();
    if (context && context !== selectedText) {
      lines.push("", "Surrounding context:", `"""${context.slice(0, 500)}"""`);
    }
    return lines.join("\n");
  }

  function parseSocraticJson(rawText) {
    let cleaned = String(rawText || "").trim();
    const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) cleaned = fenced[1].trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error("The hint response was not valid JSON.");
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    }

    ["issue_type", "level1_flag", "level2_question", "level3_template"].forEach((field) => {
      if (!parsed || typeof parsed[field] !== "string" || !parsed[field].trim()) {
        throw new Error(`The hint response is missing ${field}.`);
      }
    });

    return {
      issue_type: parsed.issue_type.trim(),
      level1_flag: parsed.level1_flag.trim(),
      level2_question: parsed.level2_question.trim(),
      level3_template: parsed.level3_template.trim()
    };
  }

  function demoScaffold(selectedText) {
    const text = selectedText.replace(/\s+/g, " ").trim();
    const lower = text.toLowerCase();
    let key = "unsupported";
    if (/\b(always|never|everyone|obviously|clearly|a lot|very|really|things|stuff|many people)\b/.test(lower)) {
      key = "broad";
    } else if (/\([12]\d{3}\)|\bet al\.|\baccording to\b/i.test(text)) {
      key = "evidence";
    } else if (text.split(/\s+/).length > 35) {
      key = "transition";
    }
    return { ...DEMO_SCAFFOLDS[key] };
  }

  async function requestSocraticScaffold(options) {
    const settings = options || {};
    const selectedText = String(settings.selectedText || "").trim();
    if (!selectedText) {
      throw new Error("Highlight a passage, or click into a paragraph, then ask for a hint.");
    }

    const apiKey = String(settings.apiKey || "").trim();
    if (settings.mode !== "live" || !apiKey) return demoScaffold(selectedText);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SOCRATIC_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildUserPrompt(selectedText, settings.contextText) }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`API error (${response.status}): ${errBody.slice(0, 140)}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return parseSocraticJson(candidateText);
  }

  window.SocraticHarness = {
    SOCRATIC_SYSTEM_PROMPT,
    parseSocraticJson,
    requestSocraticScaffold
  };
})();
