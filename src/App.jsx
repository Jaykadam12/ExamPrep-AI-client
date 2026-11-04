import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  GraduationCap,
  Layers3,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Target,
  Upload,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import {
  uploadAndAnalyzePDF,
  analyzeTextContent,
  fetchDetailedAnswer,
  sendChatMessage,
  updateSessionPreferences,
} from "./services/api";
import {
  saveLocalSession,
  loadLocalSession,
  cacheDetailedAnswer,
  getCachedDetailedAnswer,
} from "./services/offlineStorage";
import "./App.css";

const tabs = [
  { id: "important", label: "Important questions", icon: Target },
  { id: "revision", label: "Quick revision", icon: Brain },
  { id: "answers", label: "Detailed answers", icon: BookOpen },
  { id: "chat", label: "Ask AI", icon: MessageCircle },
];

const fallbackNotes = [
  {
    title: "BJT vs MOSFET",
    unit: "Unit 4",
    type: "Differentiate",
    explanation: "Fundamental comparison between bipolar current-controlled devices and unipolar voltage-controlled field-effect transistors.",
    comparisonTable: {
      headers: ["Parameter", "BJT (Bipolar Junction)", "MOSFET (Field Effect)"],
      rows: [
        ["Control Mechanism", "Current-controlled (Base current Ib)", "Voltage-controlled (Gate voltage Vgs)"],
        ["Input Impedance", "Low (kilo-ohms range)", "Extremely high (mega-ohms / giga-ohms)"],
        ["Charge Carriers", "Both electrons & holes (Bipolar)", "Only majority carriers (Unipolar)"],
        ["Thermal Stability", "Prone to thermal runaway", "Better thermal stability (negative temp coefficient)"],
        ["Switching Speed", "Moderate switching speed", "Very high switching speed (ideal for power supplies)"],
      ],
    },
    points: [
      "BJT relies on current injection, while MOSFET operates via electrostatic field control.",
      "MOSFETs are preferred in high-frequency switching and modern VLSI circuits due to low gate dissipation.",
    ],
    memory: "BJT: Current + Heat prone. MOSFET: Voltage + High speed.",
  },
  {
    title: "Half-wave rectifier efficiency & DC output",
    unit: "Unit 2",
    type: "Derive",
    explanation: "Mathematical derivation of the average DC output voltage and theoretical rectification efficiency.",
    derivationSteps: [
      "Step 1: Write input voltage equation: V_in(t) = V_m * sin(omega * t).",
      "Step 2: Average output voltage V_dc = (1 / 2*pi) * integral from 0 to pi of (V_m * sin(theta) d_theta).",
      "Step 3: Integrate: V_dc = (V_m / 2*pi) * [-cos(theta)] from 0 to pi = (V_m / pi) = 0.318 * V_m.",
      "Step 4: Efficiency calculation: Maximum theoretical rectification efficiency eta_max = (P_dc / P_ac) = 40.6%.",
    ],
    points: [
      "Conducts only during the positive half-cycle of alternating input voltage.",
      "Produces pulsating DC with a high ripple factor (gamma = 1.21), requiring an external filter circuit.",
    ],
    memory: "One diode → Half cycle → Vdc = Vm / pi (40.6% max efficiency)",
  },
  {
    title: "SQL Injection (SQLi) Attack",
    unit: "Unit 1",
    type: "Define",
    definition: "A code injection security vulnerability where malicious SQL commands are inserted into input data fields to execute unintended database queries.",
    explanation: "SQL Injection occurs when user-supplied input is directly concatenated into dynamic SQL queries without parameterized binding or sanitization. Attackers can bypass authentication, extract confidential data, modify records, or execute administrative operations.",
    advantages: [],
    disadvantages: [
      "Critical database exposure: Allows attackers to dump password hashes and credit card credentials.",
      "Data tampering: Malicious DROP TABLE or UPDATE statements destroy data integrity.",
      "Potential Remote Code Execution (RCE) via database stored procedures like xp_cmdshell.",
    ],
    points: [
      "Root cause is trusting unvalidated user input inside query strings.",
      "Primary defense is using Prepared Statements (Parameterized Queries) and ORMs.",
    ],
    memory: "Concatenation = Vulnerable. Parameterization = Protected.",
  },
];

function Brand() {
  return (
    <a className="brand" href="#" aria-label="ExamPrep home">
      <span className="brand-mark">
        <GraduationCap size={21} strokeWidth={2.2} />
      </span>
      <span className="brand-name">
        exam<span>prep</span>
        <sup>®</sup>
      </span>
    </a>
  );
}

function FormattedText({ text }) {
  if (!text) return null;

  const cleaned = String(text)
    .replace(/^#{1,4}\s+/, "")
    .replace(/^[\*\-•]\s+/, "")
    .trim();

  const parts = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleaned.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={match.index} className="inline-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    parts.push(cleaned.slice(lastIndex));
  }

  return <>{parts}</>;
}

// ─── Markdown Renderer ──────────────────────────────────────────────────────
function parseMarkdown(text) {
  if (!text) return [];
  const lines = text.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block ```
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", language: lang, content: codeLines.join("\n") });
      i++;
      continue;
    }

    // Table: line starts with | and next non-empty line is separator
    if (line.trimStart().startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2 && /^\s*\|[\s\-|:]+\|\s*$/.test(tableLines[1])) {
        const headers = tableLines[0]
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean);
        const rows = tableLines
          .slice(2)
          .map((r) =>
            r
              .split("|")
              .map((c) => c.trim())
              .filter(Boolean)
          )
          .filter((r) => r.length > 0);
        blocks.push({ type: "table", headers, rows });
      } else {
        tableLines.forEach((l) => blocks.push({ type: "p", text: l }));
      }
      continue;
    }

    // Heading: matches ###, ##, #, or # # # (with spaces between hashes)
    const hMatch = line.match(/^\s*(#(?:\s*#){0,4})\s+(.+)/);
    if (hMatch) {
      const hashCount = (hMatch[1].match(/#/g) || []).length;
      blocks.push({
        type: "heading",
        level: Math.min(4, Math.max(1, hashCount)),
        text: hMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Bold title on a single line like "**Heading:**" or "**Heading**"
    const boldTitleMatch = line.match(/^\s*\*\*([^*]+)\*\*:?\s*$/);
    if (boldTitleMatch && boldTitleMatch[1].length < 80) {
      blocks.push({
        type: "heading",
        level: 3,
        text: boldTitleMatch[1].trim(),
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Unordered list
    if (/^[\s]*[-*•]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\s]*[-*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*•]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\s]*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Blank line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    blocks.push({ type: "p", text: line });
    i++;
  }

  return blocks;
}

function renderInline(text) {
  if (!text) return null;
  const regex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("***") && token.endsWith("***")) {
      parts.push(<strong key={idx++}><em>{token.slice(3, -3)}</em></strong>);
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={idx++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={idx++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={idx++} className="inline-code">{token.slice(1, -1)}</code>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function MarkdownRenderer({ text }) {
  if (!text) return null;
  const blocks = parseMarkdown(text);

  return (
    <div className="md-content">
      {blocks.map((block, bi) => {
        switch (block.type) {
          case "heading":
            return (
              <div key={bi} className={`md-heading md-h${block.level}`}>
                {renderInline(block.text)}
              </div>
            );
          case "p":
            return (
              <p key={bi} className="md-p">
                {renderInline(block.text)}
              </p>
            );
          case "ul":
            return (
              <ul key={bi} className="md-ul">
                {block.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={bi} className="md-ol">
                {block.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          case "table":
            return (
              <div key={bi} className="md-table-wrap">
                <table className="md-table">
                  <thead>
                    <tr>
                      {block.headers.map((h, hi) => (
                        <th key={hi}>{renderInline(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{renderInline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "code":
            return (
              <pre key={bi} className="md-code-block">
                <code>{block.content}</code>
              </pre>
            );
          case "hr":
            return <hr key={bi} className="md-hr" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

function SectionEyebrow({ children }) {
  return (
    <div className="eyebrow">
      <span className="eyebrow-dot" />
      {children}
    </div>
  );
}

function UploadPanel({
  file,
  onFile,
  studyInstructions,
  setStudyInstructions,
  onAnalyze,
  analyzing,
  statusMessage,
  errorMessage,
}) {
  const inputRef = useRef(null);

  function handleFile(event) {
    const selected = event.target.files?.[0];
    if (selected) onFile(selected);
  }

  const hasFile = !!file;
  const hasText = studyInstructions && studyInstructions.trim().length >= 10;
  const canAnalyze = hasFile || hasText;

  function handleAnalyze() {
    if (hasFile) {
      onAnalyze(studyInstructions, { mode: "pdf" });
    } else if (hasText) {
      onAnalyze(studyInstructions, { mode: "text", plainText: studyInstructions.trim() });
    }
  }

  return (
    <section className="setup-card">
      <div className="setup-heading">
        <div>
          <SectionEyebrow>LET'S GET YOU EXAM-READY</SectionEyebrow>
          <h2>
            Start with your
            <br />
            <span>question bank.</span>
          </h2>
          <p>
            Upload your PDF or paste your questions directly below. We'll turn it into a study plan that makes sense.
          </p>
        </div>
        <div className="setup-illustration" aria-hidden="true">
          <div className="paper paper-back" />
          <div className="paper paper-front">
            <span className="paper-line wide" />
            <span className="paper-line" />
            <span className="paper-line short" />
            <span className="paper-diagram">
              <span />
              <span />
              <span />
            </span>
            <span className="paper-line wide" />
          </div>
          <span className="sparkle sparkle-one">
            <Sparkles size={19} />
          </span>
          <span className="sparkle sparkle-two">
            <Zap size={15} />
          </span>
        </div>
      </div>

      <button
        className={`upload-zone ${file ? "has-file" : ""}`}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={handleFile}
        />
        <span className="upload-icon">
          {file ? <FileText size={23} /> : <Upload size={23} />}
        </span>
        <span className="upload-copy">
          <strong>{file ? file.name : "Upload question bank PDF (Optional)"}</strong>
          <span>
            {file
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace`
              : "Drop your PDF here, or click to browse (or paste questions directly below)"}
          </span>
        </span>
        <span className="upload-action">
          {file ? <Check size={18} /> : "Choose PDF"}
        </span>
      </button>

      <div className="form-divider">
        <span>QUESTIONS, EXAM PATTERN & STUDY PREFERENCES</span>
      </div>

      <div className="field study-instructions-field">
        <label htmlFor="study-instructions">
          Paste your questions & describe how you want to study
        </label>
        <textarea
          id="study-instructions"
          className="study-instructions-input"
          value={studyInstructions}
          onChange={(event) => setStudyInstructions(event.target.value)}
          placeholder={
            "Paste your questions or syllabus directly here if you don't have a PDF, along with your exam preferences and marks!\n\nFor example:\nQuestions:\n1. Explain SQL Injection attack. State countermeasures to prevent the attack. (10 marks)\n2. Differentiate between Virus and Worm. (5 marks)\n3. Explain steps for penetration testing. (10 marks)\n\nPreferences: Use simple English, comparison tables, step-by-step derivations, and memory tricks."
          }
          rows={7}
        />
        <span className="field-hint">
          {hasFile
            ? "Your PDF is attached. Any exam instructions or extra questions in this box will be combined with your PDF."
            : "No PDF uploaded? No problem! Type or paste your questions and preferences in this box and click Analyze below."}
        </span>
      </div>

      {errorMessage && (
        <div style={{ padding: "10px 14px", background: "rgba(220, 38, 38, 0.1)", border: "1px solid rgba(220, 38, 38, 0.25)", borderRadius: "8px", color: "#ef4444", fontSize: "13px", marginTop: "12px" }}>
          ⚠️ {errorMessage}
        </div>
      )}

      <button
        className="primary-button analyze-button"
        disabled={!canAnalyze || analyzing}
        onClick={handleAnalyze}
      >
        {analyzing ? (
          <>
            <LoaderCircle className="spin" size={18} /> {statusMessage || "Analyzing your material…"}
          </>
        ) : hasFile ? (
          <>
            Analyze question bank PDF <ArrowRight size={18} />
          </>
        ) : (
          <>
            Analyze questions & preferences <ArrowRight size={18} />
          </>
        )}
      </button>
      <p className="privacy-note">
        <span className="privacy-dot" /> Your questions and materials are processed privately to prepare your
        study session.
      </p>
    </section>
  );
}

function QuestionCard({ item, index, onSelect }) {
  const qText = item.questionText || item.question;
  const qUnit = item.unit || item.topic || "General";
  const qType = item.questionType || item.type || "Theory";
  const qFreq = item.frequency || (item.occurrences > 1 ? `Asked ${item.occurrences} times` : "Asked once");
  const qPriority = item.priority || "Medium";
  const qMarks = item.marks || 5;

  return (
    <button className="question-card" onClick={() => onSelect(item)}>
      <span className="question-index">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="question-body">
        <span className="question-text">{qText}</span>
        <span className="question-meta">
          <span>{qUnit}</span>
          <span className="meta-dot" />
          {qType}
          <span className="meta-dot" />
          {qFreq}
        </span>
      </span>
      <span className="question-end">
        <span className={`priority-pill ${qPriority.toLowerCase()}`}>
          <span />
          {qPriority}
        </span>
        <span className="marks-pill">{qMarks} marks</span>
        <ChevronRight size={17} className="question-chevron" />
      </span>
    </button>
  );
}

function ImportantTab({ questions, onSelect }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = questions.filter((q) => {
    const text = (q.questionText || q.question || "").toLowerCase();
    const marks = Number(q.marks) || 5;
    const matchesFilter = filter === "All" || marks === Number(filter);
    const matchesSearch = text.includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const distinctMarks = [...new Set(questions.map((q) => Number(q.marks) || 5))].sort(
    (a, b) => a - b
  );

  return (
    <div className="tab-content">
      <div className="section-title-row">
        <div>
          <SectionEyebrow>YOUR STUDY SHORTLIST</SectionEyebrow>
          <h2>
            Know what <span>matters.</span>
          </h2>
          <p>Start with questions that give your revision the most value.</p>
        </div>
        <div className="result-count">
          <strong>{questions.length}</strong>
          <span>questions found</span>
        </div>
      </div>
      <div className="insight-banner">
        <span className="insight-icon">
          <Lightbulb size={19} />
        </span>
        <span>
          <strong>Your study strategy</strong>
          <small>
            Priorities and repetitions are calculated from your uploaded document
            evidence and syllabus patterns.
          </small>
        </span>
      </div>
      <div className="list-toolbar">
        <div className="filter-pills">
          {["All", ...distinctMarks.map(String)].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? "active" : ""}
            >
              {f === "All" ? "All marks" : `${f} marks`}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={15} />
          <input
            placeholder="Find a question"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="question-list">
        {filtered.map((item, index) => (
          <QuestionCard
            key={item._id || item.id || index}
            item={item}
            index={index}
            onSelect={onSelect}
          />
        ))}
        {!filtered.length && (
          <div className="empty-state">No questions match this filter.</div>
        )}
      </div>
      <p className="list-footnote">
        <Layers3 size={14} /> Similar questions are automatically grouped by evidence-based
        analysis.
      </p>
    </div>
  );
}

function RevisionTab({ revisionNotes }) {
  const [expanded, setExpanded] = useState(0);
  const activeNotes = revisionNotes && revisionNotes.length > 0 ? revisionNotes : fallbackNotes;

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case "Differentiate":
        return "badge-differentiate";
      case "Derive":
        return "badge-derive";
      case "Define":
        return "badge-define";
      case "Numerical":
        return "badge-numerical";
      case "Advantages":
        return "badge-advantages";
      case "Disadvantages":
        return "badge-disadvantages";
      default:
        return "badge-explain";
    }
  };

  return (
    <div className="tab-content">
      <div className="section-title-row">
        <div>
          <SectionEyebrow>ADAPTIVE EXAM REVISION</SectionEyebrow>
          <h2>
            Make it <span>stick.</span>
          </h2>
          <p>
            Quick revision calibrated to question type: comparisons, derivations, definitions, and high-yield notes.
          </p>
        </div>
        <span className="small-count">{activeNotes.length} note sets</span>
      </div>
      <div className="revision-list">
        {activeNotes.map((note, i) => {
          const noteType =
            note.type ||
            (note.comparisonTable?.headers?.length
              ? "Differentiate"
              : note.derivationSteps?.length
              ? "Derive"
              : note.definition
              ? "Define"
              : "Explain");
          return (
            <article
              className={`revision-card ${expanded === i ? "expanded" : ""}`}
              key={note.title || i}
            >
              <button
                className="revision-head"
                onClick={() => setExpanded(expanded === i ? -1 : i)}
                type="button"
              >
                <span className="revision-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="revision-heading">
                  <div className="revision-meta-row">
                    <span className="revision-unit-tag">{note.unit || "General"}</span>
                    <span className={`adaptive-type-pill ${getTypeBadgeClass(noteType)}`}>
                      {noteType === "Differentiate" ? "Comparison Table" : noteType}
                    </span>
                  </div>
                  <strong>{note.title}</strong>
                </span>
                <span className="revision-expand">
                  {expanded === i ? <X size={17} /> : <Plus size={17} />}
                </span>
              </button>
              {expanded === i && (
                <div className="revision-details">
                  {/* Adaptive: Definition */}
                  {note.definition && (
                    <div className="adaptive-block definition-block">
                      <span className="block-label">Official Definition</span>
                      <p className="definition-content">
                        <FormattedText text={note.definition} />
                      </p>
                    </div>
                  )}

                  {/* Adaptive: Explanation */}
                  {note.explanation && (
                    <div className="adaptive-block explanation-block">
                      <span className="block-label">Explanation</span>
                      <p className="explanation-content">
                        <FormattedText text={note.explanation} />
                      </p>
                    </div>
                  )}

                  {/* Adaptive: Comparison Table */}
                  {note.comparisonTable && note.comparisonTable.headers?.length > 0 && (
                    <div className="adaptive-block comparison-block">
                      <span className="block-label">Comparison Breakdown</span>
                      <div className="revision-table-container">
                        <table className="adaptive-table">
                          <thead>
                            <tr>
                              {note.comparisonTable.headers.map((h, hi) => (
                                <th key={hi}><FormattedText text={h} /></th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {note.comparisonTable.rows?.map((row, ri) => (
                              <tr key={ri}>
                                {row.map((cell, ci) => (
                                  <td key={ci}><FormattedText text={cell} /></td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Adaptive: Step-by-Step Derivation */}
                  {note.derivationSteps && note.derivationSteps.length > 0 && (
                    <div className="adaptive-block derivation-block">
                      <span className="block-label">Step-by-Step Derivation</span>
                      <div className="derivation-list">
                        {note.derivationSteps.map((step, sIdx) => (
                          <div key={sIdx} className="derivation-item">
                            <span className="derivation-step-badge">Step {sIdx + 1}</span>
                            <div className="derivation-text">
                              <FormattedText text={step} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Adaptive: Numerical */}
                  {note.numerical && (note.numerical.formula || note.numerical.calculation) && (
                    <div className="adaptive-block numerical-block">
                      <span className="block-label">Numerical Breakdown</span>
                      <div className="numerical-details">
                        {note.numerical.formula && (
                          <div className="num-row">
                            <span className="num-title">Formula:</span>
                            <code className="num-code">{note.numerical.formula}</code>
                          </div>
                        )}
                        {note.numerical.substitution && (
                          <div className="num-row">
                            <span className="num-title">Substitution:</span>
                            <span><FormattedText text={note.numerical.substitution} /></span>
                          </div>
                        )}
                        {note.numerical.calculation && (
                          <div className="num-row">
                            <span className="num-title">Calculation:</span>
                            <span><FormattedText text={note.numerical.calculation} /></span>
                          </div>
                        )}
                        {note.numerical.result && (
                          <div className="num-row num-result-row">
                            <span className="num-title">Final Result:</span>
                            <strong><FormattedText text={note.numerical.result} /></strong>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Adaptive: Advantages */}
                  {note.advantages && note.advantages.length > 0 && (
                    <div className="adaptive-block pros-block">
                      <span className="block-label">Key Advantages</span>
                      <ul className="adaptive-bullet-list">
                        {note.advantages.map((adv, aIdx) => (
                          <li key={aIdx}><FormattedText text={adv} /></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Adaptive: Disadvantages */}
                  {note.disadvantages && note.disadvantages.length > 0 && (
                    <div className="adaptive-block cons-block">
                      <span className="block-label">Key Disadvantages & Limitations</span>
                      <ul className="adaptive-bullet-list">
                        {note.disadvantages.map((dis, dIdx) => (
                          <li key={dIdx}><FormattedText text={dis} /></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key points / Takeaways */}
                  {note.points && note.points.length > 0 && (
                    <div className="adaptive-block points-block">
                      <span className="block-label">Key Exam Takeaways</span>
                      <ul className="adaptive-bullet-list">
                        {note.points.map((point, pIdx) => (
                          <li key={pIdx}>
                            <FormattedText text={point} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Memory cue */}
                  {note.memory && (
                    <div className="memory-tip">
                      <Lightbulb size={18} />
                      <span>
                        <strong>Memory cue for exam recall</strong>
                        <FormattedText text={note.memory} />
                      </span>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="list-footnote">
        <Sparkles size={14} /> Grounded directly in your uploaded material and adapted to your exam requirements.
      </p>
    </div>
  );
}

function AnswersTab({ questions, selectedQuestion, setSelectedQuestion }) {
  const availableQuestions = questions.length ? questions : [];
  const activeQuestion = selectedQuestion || availableQuestions[0] || null;

  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [errorAnswer, setErrorAnswer] = useState("");

  const qKey = activeQuestion ? activeQuestion._id || activeQuestion.id : null;

  useEffect(() => {
    if (!activeQuestion) return;

    if (activeQuestion.detailedAnswer && activeQuestion.detailedAnswer.overview) {
      setCurrentAnswer(activeQuestion.detailedAnswer);
      setErrorAnswer("");
      return;
    }

    if (activeQuestion._id) {
      loadDetailedAnswer(activeQuestion._id, false);
    } else {
      setCurrentAnswer(null);
    }
  }, [qKey]);

  async function loadDetailedAnswer(questionId, forceRegenerate = false) {
    // If not forcing regenerate, check local offline cache first!
    if (!forceRegenerate) {
      const cached = getCachedDetailedAnswer(questionId);
      if (cached) {
        setCurrentAnswer(cached);
        if (activeQuestion) {
          activeQuestion.detailedAnswer = cached;
        }
        setErrorAnswer("");
        return;
      }
    }

    // Check if offline
    if (!navigator.onLine) {
      const cached = getCachedDetailedAnswer(questionId);
      if (cached) {
        setCurrentAnswer(cached);
        if (activeQuestion) activeQuestion.detailedAnswer = cached;
        return;
      }
      setErrorAnswer("You are currently offline. Detailed answer generation requires an internet connection.");
      return;
    }

    setLoadingAnswer(true);
    setErrorAnswer("");
    try {
      const data = await fetchDetailedAnswer(questionId, forceRegenerate);
      if (data.success && data.answer) {
        setCurrentAnswer(data.answer);
        if (activeQuestion) {
          activeQuestion.detailedAnswer = data.answer;
        }
        // Save to offline storage
        cacheDetailedAnswer(questionId, data.answer);
      }
    } catch (err) {
      console.error("Error generating answer:", err);
      // If network error occurred, try fallback to cached answer
      const cached = getCachedDetailedAnswer(questionId);
      if (cached) {
        setCurrentAnswer(cached);
        if (activeQuestion) activeQuestion.detailedAnswer = cached;
        setErrorAnswer("");
      } else {
        setErrorAnswer(err.message || "Failed to generate detailed answer.");
      }
    } finally {
      setLoadingAnswer(false);
    }
  }

  if (!activeQuestion) {
    return (
      <div className="tab-content">
        <div className="empty-state">No questions available. Please upload a question bank.</div>
      </div>
    );
  }

  const qText = activeQuestion.questionText || activeQuestion.question;
  const qMarks = activeQuestion.marks || 5;

  return (
    <div className="tab-content">
      <div className="section-title-row">
        <div>
          <SectionEyebrow>WRITE WITH CONFIDENCE</SectionEyebrow>
          <h2>
            Answers that <span>score.</span>
          </h2>
          <p>Structured for the marks you need—not a wall of AI text.</p>
        </div>
      </div>
      <div className="answer-selector">
        <label htmlFor="question-select">Choose a question</label>
        <select
          id="question-select"
          value={qKey}
          onChange={(e) => {
            const found = availableQuestions.find(
              (q) => String(q._id || q.id) === e.target.value
            );
            if (found) setSelectedQuestion(found);
          }}
        >
          {availableQuestions.map((q, idx) => (
            <option key={q._id || q.id || idx} value={q._id || q.id}>
              {q.questionText || q.question}
            </option>
          ))}
        </select>
        <div
          className="answer-tools"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="marks-pill">{qMarks} marks</span>
            <span className="answer-format-note">
              Depth adapted for {qMarks} marks according to your study
              preferences.
            </span>
          </div>
          {activeQuestion._id && (
            <button
              className="text-button"
              disabled={loadingAnswer}
              onClick={() => loadDetailedAnswer(activeQuestion._id, true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <RefreshCw size={13} className={loadingAnswer ? "spin" : ""} />
              {loadingAnswer ? "Regenerating..." : "Regenerate Answer"}
            </button>
          )}
        </div>
      </div>

      <article className="answer-paper">
        <div className="answer-paper-top">
          <span>
            <FileText size={15} /> ANSWER SHEET
          </span>
          <span>{qMarks} MARKS</span>
        </div>
        <h3>{qText}</h3>

        {loadingAnswer && (
          <div
            style={{ padding: "30px 0", textAlign: "center", color: "#6366f1" }}
          >
            <LoaderCircle
              className="spin"
              size={24}
              style={{ margin: "0 auto 10px" }}
            />
            <p style={{ fontSize: "14px", fontWeight: "500" }}>
              Generating personalized, mark-adapted answer with Gemini…
            </p>
          </div>
        )}

        {errorAnswer && !loadingAnswer && (
          <div
            style={{
              padding: "14px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "8px",
              color: "#ef4444",
              fontSize: "13px",
              margin: "15px 0",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "6px" }}>
              ⚠️ Could not generate answer
            </div>
            <div>{errorAnswer}</div>
            {activeQuestion._id && (
              <button
                className="secondary-button"
                style={{
                  marginTop: "10px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onClick={() => loadDetailedAnswer(activeQuestion._id, true)}
              >
                Retry Generation
              </button>
            )}
          </div>
        )}

        {!loadingAnswer && currentAnswer && (
          <div>
            {currentAnswer.overview && (
              <p
                style={{
                  fontSize: "16px",
                  lineHeight: "1.8",
                  color: "#c2bfd8",
                  marginBottom: "18px",
                }}
              >
                <FormattedText text={currentAnswer.overview} />
              </p>
            )}

            {(currentAnswer.sections || []).map((sec, idx) => (
              <div
                key={idx}
                style={{ marginTop: "18px", marginBottom: "16px" }}
              >
                <h4
                  style={{
                    fontSize: "17px",
                    fontWeight: "700",
                    marginBottom: "8px",
                    color: "#93b5ff",
                  }}
                >
                  <FormattedText text={sec.heading} />
                </h4>
                {sec.content && (
                  <p style={{ marginBottom: "10px" }}>
                    <FormattedText text={sec.content} />
                  </p>
                )}
                {sec.points && sec.points.length > 0 && (
                  <ol>
                    {sec.points.map((p, pIdx) => (
                      <li key={pIdx}>
                        <FormattedText text={p} />
                      </li>
                    ))}
                  </ol>
                )}
                {sec.equations && sec.equations.length > 0 && (
                  <div className="formula-box">
                    {sec.equations.map((eq, eqIdx) => (
                      <div key={eqIdx} style={{ margin: "4px 0" }}>
                        <FormattedText text={eq} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {currentAnswer.diagramDescription && (
              <div
                style={{
                  margin: "20px 0",
                  padding: "14px 18px",
                  border: "1px dashed #6366f1",
                  borderRadius: "10px",
                  background: "rgba(99, 102, 241, 0.08)",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 6px",
                    color: "#93b5ff",
                    fontSize: "16px",
                    fontWeight: "700",
                  }}
                >
                  Recommended Exam Diagram
                </h4>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.7" }}>
                  <FormattedText text={currentAnswer.diagramDescription} />
                </p>
              </div>
            )}

            {currentAnswer.advantages &&
              currentAnswer.advantages.length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <h4 style={{ color: "#79d6b0", fontSize: "16px", fontWeight: "700" }}>Key Advantages</h4>
                  <ul>
                    {currentAnswer.advantages.map((adv, aIdx) => (
                      <li key={aIdx}>
                        <FormattedText text={adv} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {currentAnswer.disadvantages &&
              currentAnswer.disadvantages.length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <h4 style={{ color: "#ff8d9b", fontSize: "16px", fontWeight: "700" }}>Key Disadvantages & Limitations</h4>
                  <ul>
                    {currentAnswer.disadvantages.map((dis, dIdx) => (
                      <li key={dIdx}>
                        <FormattedText text={dis} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {currentAnswer.conclusion && (
              <div style={{ marginTop: "18px" }}>
                <h4 style={{ color: "#a594fd", fontSize: "16px", fontWeight: "700" }}>Summary & Key Takeaway</h4>
                <p>
                  <FormattedText text={currentAnswer.conclusion} />
                </p>
              </div>
            )}

            {currentAnswer.keyPoints && currentAnswer.keyPoints.length > 0 && (
              <div className="answer-marking">
                {currentAnswer.keyPoints.map((kp, kpIdx) => (
                  <span key={kpIdx}>
                    <Check size={14} /> <FormattedText text={kp} />
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!loadingAnswer && !currentAnswer && !errorAnswer && (
          <div>
            <p>
              Select this question to review or click "Regenerate Answer" to
              create a fresh mark-adapted exam answer using Gemini.
            </p>
          </div>
        )}

        <div className="answer-source">
          <CircleHelp size={15} />
          <span>
            Grounded in your uploaded question bank and calibrated to your exam
            instructions.
          </span>
        </div>
      </article>
    </div>
  );
}

function ChatTab({ messages, setMessages, selectedQuestion, sessionId }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const activeContext = selectedQuestion?.questionText || selectedQuestion?.question || "Uploaded study material";

  // Virtual windowing: show latest visibleCount messages to prevent DOM bloat
  const hasEarlier = messages.length > visibleCount;
  const visibleMessages = hasEarlier ? messages.slice(-visibleCount) : messages;

  // Auto-scroll to bottom on new messages or loading state
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  const send = async (text) => {
    const value = text.trim();
    if (!value || loading) return;

    // Check if offline
    if (!navigator.onLine) {
      const userMsg = { role: "user", text: value };
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "assistant",
          text: "⚠️ **Offline Mode**: You are currently disconnected from the internet. You can still read all your previous questions, revision notes, and chat answers, but asking new AI questions requires an active connection.",
        },
      ]);
      setInput("");
      return;
    }

    // Append user message locally
    const userMsg = { role: "user", text: value };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      if (sessionId) {
        const response = await sendChatMessage(sessionId, {
          message: value,
          selectedQuestion: activeContext,
        });
        if (response.success && response.reply) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: response.reply },
          ]);
        }
      } else {
        // Fallback if session isn't uploaded yet
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `Here is a study breakdown for: "${value}". Once you upload your question bank, I'll ground all explanations in your specific PDF and exam requirements.`,
            },
          ]);
        }, 500);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `I ran into an issue connecting: ${err.message}. Please check your connection and try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-tab">
      {/* Sleek, space-saving chat header */}
      <div className="chat-top-header">
        <div className="chat-tutor-badge">
          <Sparkles size={15} className="sparkle-accent" />
          <span className="tutor-name">ExamPrep AI Tutor</span>
          {messages.length > 0 && (
            <span className="message-counter">{messages.length}</span>
          )}
        </div>
        <div className="chat-context-chip" title={activeContext}>
          <span className="context-dot" />
          <span className="context-label">Context:</span>
          <span className="context-val">{activeContext}</span>
        </div>
      </div>

      {/* Internally Scrollable & Windowed Messages Viewport */}
      <div className="chat-messages-scroll" ref={scrollContainerRef}>
        {messages.length === 0 && (
          <div className="chat-empty-intro">
            <span className="empty-chat-icon">
              <Sparkles size={24} />
            </span>
            <h3>How can I help you study?</h3>
            <p>
              Ask follow-up questions, request comparison tables, derive formulas step-by-step, or get simplified explanations.
            </p>
          </div>
        )}

        {hasEarlier && (
          <div className="load-earlier-wrap">
            <button
              className="load-earlier-btn"
              onClick={() => setVisibleCount((prev) => Math.min(messages.length, prev + 15))}
              type="button"
            >
              ↑ View earlier messages ({messages.length - visibleCount} more)
            </button>
            <button
              className="load-all-btn"
              onClick={() => setVisibleCount(messages.length)}
              type="button"
            >
              Show all
            </button>
          </div>
        )}

        {visibleMessages.map((m, i) => (
          <div key={i} className={`chat-message ${m.role}`}>
            <span className="message-avatar">
              {m.role === "assistant" ? <Sparkles size={16} /> : "Y"}
            </span>
            <div>
              <span className="message-role">
                {m.role === "assistant" ? "ExamPrep AI" : "You"}
              </span>
              {m.role === "assistant" ? (
                <MarkdownRenderer text={m.text} />
              ) : (
                <p className="user-msg-text">{m.text}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-message assistant">
            <span className="message-avatar">
              <Sparkles size={16} />
            </span>
            <div>
              <span className="message-role">ExamPrep AI</span>
              <p style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <LoaderCircle className="spin" size={16} /> Thinking…
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Bottom Dock: Slim composer + Prompt chips */}
      <div className="chat-bottom-fixed">
        <div className="suggested-prompts-bar">
          {[
            "Give a table based answer",
            "Explain it simply",
            "Step-by-step derivation",
            "Give me an example",
            "Key points to remember",
            "Advantages & disadvantages",
          ].map((p) => (
            <button key={p} onClick={() => send(p)} disabled={loading} type="button">
              {p}
            </button>
          ))}
        </div>

        <div className="chat-composer-box">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask anything about this topic… (Press Enter to send)"
            rows={1}
          />
          <button
            className="composer-send-btn"
            disabled={!input.trim() || loading}
            onClick={() => send(input)}
            aria-label="Send message"
            type="button"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [studyInstructions, setStudyInstructions] = useState("");
  const [activeTab, setActiveTab] = useState("important");
  const [analyzed, setAnalyzed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [sessionId, setSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sessionTitle, setSessionTitle] = useState("Untitled study session");
  const [showSetup, setShowSetup] = useState(true);

  // Online / Offline connectivity state
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Preference update state
  const [isUpdatingPrefs, setIsUpdatingPrefs] = useState(false);

  // ─── 1. Monitor Online / Offline Connectivity ──────────────────────────────
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ─── 2. Auto-Restore Last Saved Session on Mount ───────────────────────────
  useEffect(() => {
    try {
      const cached = loadLocalSession();
      if (cached && cached.sessionId) {
        setSessionId(cached.sessionId);
        setSessionData(cached.sessionData || null);
        setQuestions(cached.questions || []);
        setSelectedQuestion(cached.selectedQuestion || cached.questions?.[0] || null);
        setMessages(cached.messages || []);
        setSessionTitle(cached.sessionTitle || "Study Session");
        setStudyInstructions(cached.studyInstructions || "");
        if (cached.activeTab) setActiveTab(cached.activeTab);
        setAnalyzed(true);
        setShowSetup(false);
      }
    } catch (e) {
      console.warn("Could not restore cached session:", e);
    }
  }, []);

  // ─── 3. Auto-Persist Session Snapshot Whenever Data Changes ────────────────
  useEffect(() => {
    if (analyzed && sessionId) {
      saveLocalSession({
        sessionId,
        sessionData,
        questions,
        selectedQuestion,
        messages,
        sessionTitle,
        studyInstructions,
        activeTab,
      });
    }
  }, [
    analyzed,
    sessionId,
    sessionData,
    questions,
    selectedQuestion,
    messages,
    sessionTitle,
    studyInstructions,
    activeTab,
  ]);

  async function startAnalysis(instructions, opts = { mode: "pdf" }) {
    if (opts.mode === "pdf" && !file) return;
    if (opts.mode === "text" && !opts.plainText) return;

    setStudyInstructions(instructions);
    setAnalyzing(true);
    setErrorMessage("");
    setStatusMessage("Processing your material…");

    try {
      setStatusMessage("Extracting questions and preparing revision notes with Gemini…");

      let response;
      if (opts.mode === "text") {
        const title = "Pasted question bank";
        setSessionTitle(title);
        response = await analyzeTextContent({ text: opts.plainText, instructions, title });
      } else {
        const title = file.name.replace(/\.pdf$/i, "");
        setSessionTitle(title);
        response = await uploadAndAnalyzePDF({ file, instructions, title });
      }

      if (response.success) {
        setSessionId(response.session.id);
        setSessionData(response.session);
        setQuestions(response.questions || []);
        if (response.questions && response.questions.length > 0) {
          setSelectedQuestion(response.questions[0]);
        }
        setAnalyzed(true);
        setShowSetup(false);
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setErrorMessage(err.message || "Failed to process material. Please check backend server.");
    } finally {
      setAnalyzing(false);
      setStatusMessage("");
    }
  }

  async function handleSavePreferences() {
    if (!sessionId) {
      setShowSetup(false);
      return;
    }

    setIsUpdatingPrefs(true);
    try {
      await updateSessionPreferences(sessionId, studyInstructions);
      setShowSetup(false);
    } catch (err) {
      alert("Failed to update preferences: " + err.message);
    } finally {
      setIsUpdatingPrefs(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="topbar-center">
          {isOnline ? (
            <span className="online-pill">
              <span className="status-dot" /> Online Sync
            </span>
          ) : (
            <span className="offline-pill">
              <WifiOff size={13} /> Offline Mode (Saved Material Ready)
            </span>
          )}
        </div>
        <div className="topbar-right">
          <button
            className="icon-button"
            title="Settings"
            onClick={() => setShowSetup(!showSetup)}
          >
            <Settings2 size={18} />
          </button>
          <div className="avatar">J</div>
        </div>
      </header>

      <main className="main-wrap">
        {activeTab !== "chat" ? (
          <div className="workspace-heading">
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={13} />
              <span>{analyzed ? sessionTitle : "New study session"}</span>
            </div>
            <div className="session-heading">
              <div>
                <h1>{analyzed ? sessionTitle : "Study smarter. Not longer."}</h1>
                <p>
                  {analyzed
                    ? "Your material, organized around your exam."
                    : "Your syllabus is big. Your study plan doesn't have to be."}
                </p>
              </div>
              {analyzed && (
                <button
                  className="text-button"
                  onClick={() => setShowSetup(!showSetup)}
                >
                  <Settings2 size={15} /> Study preferences
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="workspace-heading-compact">
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={13} />
              <span>{analyzed ? sessionTitle : "Study session"}</span>
              <span className="dot-divider">•</span>
              <span className="chat-indicator-tag">Ask AI</span>
            </div>
          </div>
        )}

        {!isOnline && (
          <div className="offline-banner">
            <WifiOff size={16} />
            <span>
              <strong>You are offline:</strong> Viewing your saved question bank, revision notes, and cached answers. Reconnect to generate new content.
            </span>
          </div>
        )}

        {showSetup && (
          <div>
            <UploadPanel
              file={file}
              onFile={setFile}
              studyInstructions={studyInstructions}
              setStudyInstructions={setStudyInstructions}
              onAnalyze={startAnalysis}
              analyzing={analyzing}
              statusMessage={statusMessage}
              errorMessage={errorMessage}
            />
            {analyzed && (
              <div style={{ marginTop: "10px", textAlign: "right" }}>
                <button
                  className="secondary-button"
                  onClick={handleSavePreferences}
                  disabled={isUpdatingPrefs}
                  style={{ marginRight: "10px" }}
                >
                  {isUpdatingPrefs ? "Saving..." : "Save preferences"}
                </button>
                <button
                  className="text-button"
                  onClick={() => setShowSetup(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        )}

        {analyzed && (
          <section className={`study-workspace ${activeTab === "chat" ? "chat-workspace-mode" : ""}`}>
            {activeTab !== "chat" && (
              <div className="shared-instructions">
                <div className="shared-instructions-heading">
                  <Sparkles size={15} />
                  <strong>Shared study preferences</strong>
                  <button
                    className="text-button"
                    onClick={() => setShowSetup(true)}
                  >
                    Edit
                  </button>
                </div>
                <p>
                  {studyInstructions.trim() ||
                    "No special preferences added. Using standard academic exam structure."}
                </p>
              </div>
            )}
            <div className="tabbar" role="tablist" aria-label="Study tools">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => setActiveTab(id)}
                  className={`tab-button ${activeTab === id ? "active" : ""}`}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {id === "important" && (
                    <span className="tab-count">{questions.length}</span>
                  )}
                </button>
              ))}
            </div>
            {activeTab === "important" && (
              <ImportantTab
                questions={questions}
                onSelect={(q) => {
                  setSelectedQuestion(q);
                  setActiveTab("answers");
                }}
              />
            )}
            {activeTab === "revision" && (
              <RevisionTab
                revisionNotes={sessionData?.analysis?.revisionNotes || []}
              />
            )}
            {activeTab === "answers" && (
              <AnswersTab
                questions={questions}
                selectedQuestion={selectedQuestion}
                setSelectedQuestion={setSelectedQuestion}
              />
            )}
            {activeTab === "chat" && (
              <ChatTab
                messages={messages}
                setMessages={setMessages}
                selectedQuestion={selectedQuestion}
                sessionId={sessionId}
              />
            )}
          </section>
        )}

        {!analyzed && !showSetup && (
          <button
            className="secondary-button"
            onClick={() => setShowSetup(true)}
          >
            Upload a question bank
          </button>
        )}
        {activeTab !== "chat" && (
          <footer className="app-footer">
            <span>Made for the way students actually study.</span>
            <span>
              <span className="footer-dot" /> A little more clarity, every day.
            </span>
          </footer>
        )}
      </main>
    </div>
  );
}

export default App;
