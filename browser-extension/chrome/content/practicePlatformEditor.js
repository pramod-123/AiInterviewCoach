/**
 * Best-effort editor + problem text for LeetCode, HackerRank, Codeforces, AtCoder, CodeChef, TopCoder.
 * Monaco in isolated world is often viewport-only; side panel uses MAIN-world Monaco models when present.
 */
function icHostPracticePlatform() {
  const h = (location.hostname || "").toLowerCase();
  if (h.endsWith("leetcode.com")) {
    return "leetcode";
  }
  if (h.endsWith("hackerrank.com")) {
    return "hackerrank";
  }
  if (h === "codeforces.com" || h === "www.codeforces.com") {
    return "codeforces";
  }
  if (h.endsWith("atcoder.jp")) {
    return "atcoder";
  }
  if (h.endsWith("codechef.com")) {
    return "codechef";
  }
  if (h.endsWith("topcoder.com")) {
    return "topcoder";
  }
  return "generic";
}

function extractLeetCodeEditorText() {
  const selectors = [
    ".monaco-editor .view-lines",
    '[data-cy="code-editor"] .view-lines',
    ".editor-scrollable .view-lines",
    "#editor .view-lines",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = (el.innerText || "").replace(/\u00a0/g, " ");
      if (text.trim().length > 0) {
        return text;
      }
    }
  }

  const monacoRoot = document.querySelector(".monaco-editor");
  if (monacoRoot) {
    const lines = monacoRoot.querySelectorAll(".view-line");
    if (lines.length > 0) {
      return Array.from(lines)
        .map((l) => (l.textContent || "").replace(/\u00a0/g, " "))
        .join("\n");
    }
  }

  return "";
}

/** CodeMirror 5: .CodeMirror wrapper has .CodeMirror instance */
function extractCodeMirror5Text() {
  const wraps = document.querySelectorAll(".CodeMirror");
  let best = "";
  for (const wrap of wraps) {
    const cm = wrap.CodeMirror;
    if (cm && typeof cm.getValue === "function") {
      try {
        const v = cm.getValue();
        if (typeof v === "string" && v.length > best.length) {
          best = v;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return best;
}

/** Ace editor */
function extractAceEditorText() {
  const roots = document.querySelectorAll(".ace_editor");
  const ace = globalThis.ace;
  if (!ace || typeof ace.edit !== "function") {
    return "";
  }
  let best = "";
  for (const el of roots) {
    try {
      const ed = ace.edit(el);
      const v = ed.getValue();
      if (typeof v === "string" && v.length > best.length) {
        best = v;
      }
    } catch {
      /* ignore */
    }
  }
  return best;
}

function extractTextareaCodeSelectors() {
  const sels = ['textarea[name="source"]', "#source", "textarea.cm-textarea", "textarea#program-source"];
  let best = "";
  for (const sel of sels) {
    const el = document.querySelector(sel);
    const v = el && "value" in el ? String(el.value || "") : "";
    if (v.length > best.length) {
      best = v;
    }
  }
  return best;
}

function extractGenericEditorText() {
  const a = extractLeetCodeEditorText();
  if (a.trim()) {
    return a;
  }
  const b = extractCodeMirror5Text();
  if (b.trim()) {
    return b;
  }
  const c = extractAceEditorText();
  if (c.trim()) {
    return c;
  }
  return extractTextareaCodeSelectors();
}

const QUESTION_TEXT_MAX = 100_000;

function problemSlugDisplayTitle() {
  const m = location.pathname.match(/\/problems\/([^/]+)/i);
  if (!m) {
    return "";
  }
  return m[1]
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function longestInnerTextAcross(selectors, maxLen) {
  let best = "";
  for (const sel of selectors) {
    let nodes;
    try {
      nodes = document.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const el of nodes) {
      const t = (el.innerText || "").replace(/\u00a0/g, " ").trim();
      if (t.length > best.length && t.length < maxLen) {
        best = t;
      }
    }
  }
  return best;
}

function extractGenericPracticeQuestion() {
  const platform = icHostPracticePlatform();
  const titleSelectors =
    platform === "hackerrank"
      ? [".challenge-name-title", "h1", ".challenge-title", "[data-cy='challenge-title']"]
      : platform === "codeforces"
        ? [".title", "div.title", "h1", "h2"]
        : platform === "atcoder"
          ? ["span.h2", "h2", "h1", ".contest-title"]
          : platform === "codechef"
            ? ["h1", "h2", ".problem-name", "#problem-name"]
            : platform === "topcoder"
              ? ["h1", "h2", ".problem-title"]
              : ["h1", "h2", "h3"];

  let title = "";
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    const t = (el?.textContent || "").replace(/\u00a0/g, " ").trim();
    if (t && t.length < 500) {
      title = t;
      break;
    }
  }
  if (!title) {
    title = document.title?.split(/[-|]/)[0]?.trim() || "";
  }

  const bodySelectors = [
    ".problem-statement",
    "#task-statement",
    ".challenge-body-html",
    "[data-e2e='challenge-description']",
    ".problem-statement-container",
    ".problemStatement",
    ".problem-statement-body",
    "#problem-statement",
    ".content--wide.problem-statement",
    "div[data-hook='problem-description']",
    "main",
    "article",
    '[role="main"]',
  ];
  let body = longestInnerTextAcross(bodySelectors, QUESTION_TEXT_MAX);
  if (!body || body.length < 120) {
    const fb = longestInnerTextAcross([".body", ".content", "#pageContent", "#main"], QUESTION_TEXT_MAX);
    if (fb.length > (body?.length || 0)) {
      body = fb;
    }
  }

  let combined = "";
  if (body) {
    combined = title ? `${title}\n\n${body}` : body;
  } else if (title) {
    combined = `${title}\n\n(Problem body was not read from the page — rely on tab video + editor snapshots.)`;
  } else {
    combined =
      "(Could not read problem text. Scroll the statement into view or use LeetCode/HackerRank problem pages with a visible description.)";
  }
  return combined.replace(/\u00a0/g, " ").trim().slice(0, QUESTION_TEXT_MAX);
}

function extractLeetCodeQuestion() {
  const slugTitle = problemSlugDisplayTitle();

  const titleSelectors = [
    '[data-cy="question-title"]',
    '[data-cy="qb-title"]',
    '[data-cy="interview-question-title"]',
    ".text-title-large",
    ".text-headline-medium",
    'a[class*="title"]',
    "h1",
    "h2",
  ];
  let title = "";
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    const t = (el?.textContent || "").replace(/\u00a0/g, " ").trim();
    if (t) {
      title = t;
      break;
    }
  }
  if (!title) {
    title = document.title?.replace(/\s*[-|]\s*LeetCode.*$/i, "").trim() || "";
  }

  let body = longestInnerTextAcross(
    [
      '[data-cy="question-content"]',
      '[data-cy="description-content"]',
      'div[data-track-load="description_content"]',
      '[class*="description-content"]',
      '[class*="question-content"]',
      '[class*="problem-statement"]',
      '[class*="ProblemStatement"]',
      ".lc-md",
      '[class*="lc-md"]',
      '[class*="_questionContent"]',
    ],
    QUESTION_TEXT_MAX,
  );
  if (!body || body.length < 80) {
    const tabFallback = longestInnerTextAcross(
      ['[data-cy="question-detail-main-tabs"] [role="tabpanel"]'],
      QUESTION_TEXT_MAX,
    );
    if (tabFallback.length > body.length) {
      body = tabFallback;
    }
  }

  const metaDesc =
    document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || "";

  const og = document.querySelector('meta[property="og:description"]')?.getAttribute("content")?.trim() || "";

  let combined = "";
  if (body) {
    combined = title ? `${title}\n\n${body}` : body;
  } else if (title) {
    combined = title;
    const extra =
      metaDesc && metaDesc.length > 50
        ? metaDesc
        : og && og.length > 50 && !title.includes(og.slice(0, 30))
          ? og
          : "";
    if (extra) {
      combined += `\n\n${extra}`;
    }
  } else if (metaDesc && metaDesc.length > 50) {
    combined = slugTitle ? `${slugTitle}\n\n${metaDesc}` : metaDesc;
  } else if (og && og.length > 50) {
    combined = slugTitle ? `${slugTitle}\n\n${og}` : og;
  } else if (slugTitle) {
    combined = `${slugTitle}\n\n(Full statement was not readable from the page. Keep the problem **Description** tab visible and try again, or rely on code + video on the server.)`;
  }

  return combined.replace(/\u00a0/g, " ").trim().slice(0, QUESTION_TEXT_MAX);
}

function extractPracticeQuestion() {
  if (icHostPracticePlatform() === "leetcode") {
    return extractLeetCodeQuestion();
  }
  return extractGenericPracticeQuestion();
}

function extractPracticeEditorText() {
  if (icHostPracticePlatform() === "leetcode") {
    return extractLeetCodeEditorText();
  }
  return extractGenericEditorText();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_QUESTION") {
    try {
      const question = extractPracticeQuestion();
      sendResponse({ ok: true, question });
    } catch (e) {
      sendResponse({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        question: "",
      });
    }
    return true;
  }

  if (msg?.type === "GET_CODE") {
    try {
      const code = extractPracticeEditorText();
      sendResponse({ ok: true, code });
    } catch (e) {
      sendResponse({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        code: "",
      });
    }
    return true;
  }
  return false;
});
