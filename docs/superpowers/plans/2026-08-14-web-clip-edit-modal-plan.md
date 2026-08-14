# Web ClipEditModal Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Web (Cloud) ClipEditModal with Desktop by adding a Word Grid UI and a manual AI assistant flow, replacing the direct API integration.

**Architecture:** We will modify `web/src/components/ClipEditModal.tsx` to include new React states and utility functions for the Word Grid and AI Prompt. The existing OutputStyle and SubtitlePreset sections will remain intact.

**Tech Stack:** React, Tailwind CSS, Lucide React

---

### Task 1: Update State and Utility Functions

**Files:**
- Modify: `web/src/components/ClipEditModal.tsx`

- [ ] **Step 1: Add new state variables and Lucide icons**

```tsx
import { X, Wand2, RefreshCcw, Search, RotateCcw, Copy, Check, ChevronRight } from "lucide-react";
// ... inside component
  const [originalWords, setOriginalWords] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
```

- [ ] **Step 2: Update `useEffect` to initialize `originalWords`**

```tsx
  useEffect(() => {
    let mounted = true;
    apiGetClipWords(jobId, clipIndex).then((res) => {
      if (mounted) {
        const fetched = res.words || [];
        setWords(fetched);
        setOriginalWords(JSON.parse(JSON.stringify(fetched)));
        setLoading(false);
      }
    }).catch((err) => {
      console.error(err);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [jobId, clipIndex]);
```

- [ ] **Step 3: Add utility functions**

```tsx
  const generatePrompt = () => {
    const jsonStr = JSON.stringify(words, null, 2);
    return `You are a subtitle editor. Here is a JSON array of video subtitles. Correct any spelling, grammar, or punctuation errors. KEEP the exact JSON format. DO NOT change the 'start' or 'end' properties. Return ONLY the valid JSON array without markdown wrapping.\n\nSubtitles:\n${jsonStr}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatePrompt());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const applyManualJSON = () => {
    try {
      let cleanStr = pasteInput.trim();
      if (cleanStr.startsWith('```json')) cleanStr = cleanStr.substring(7);
      else if (cleanStr.startsWith('```')) cleanStr = cleanStr.substring(3);
      if (cleanStr.endsWith('```')) cleanStr = cleanStr.substring(0, cleanStr.length - 3);
      cleanStr = cleanStr.trim();
      
      const parsed = JSON.parse(cleanStr);
      const arr = Array.isArray(parsed) ? parsed : (parsed.words || null);
      
      if (!arr || !Array.isArray(arr) || arr.length === 0 || typeof arr[0].word !== 'string') {
        throw new Error('Invalid JSON format. Expected array of words.');
      }
      
      setWords(arr);
      setPasteInput('');
      alert("Subtitle berhasil diperbarui");
    } catch (e: any) {
      alert('Gagal memproses JSON: ' + e.message);
    }
  };

  const handleWordChange = (idx: number, newText: string) => {
    const newWords = [...words];
    newWords[idx] = { ...newWords[idx], word: newText };
    setWords(newWords);
  };

  const handleReset = () => {
    setWords(JSON.parse(JSON.stringify(originalWords)));
  };

  const hasChanges = JSON.stringify(words) !== JSON.stringify(originalWords);
```

- [ ] **Step 4: Remove legacy AI functions**
Remove `handleAiCorrect`, `handleApplyManual`, `manualJson`, `isManualEditOpen` and `setManualJson`.


### Task 2: Implement UI Sections

**Files:**
- Modify: `web/src/components/ClipEditModal.tsx`

- [ ] **Step 1: Replace legacy AI and Manual sections with the new AI Assistant**

Remove the two `<div className="border border-neutral-800 rounded-xl...">` blocks for AI Auto Correct and Manual JSON Edit. Replace with:

```tsx
              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                <button 
                  onClick={() => setIsAiAssistantOpen(!isAiAssistantOpen)}
                  className="w-full flex items-center justify-between p-4 bg-neutral-900/50 hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-2 text-amber-400 font-medium">
                    <Wand2 className="w-4 h-4" /> AI Auto Correction
                  </div>
                  <ChevronRight className={`w-4 h-4 text-neutral-500 transition-transform ${isAiAssistantOpen ? 'rotate-90' : ''}`} />
                </button>
                
                {isAiAssistantOpen && (
                  <div className="p-4 border-t border-neutral-800 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">1. Generate & Copy Prompt</span>
                          <button onClick={copyToClipboard} className="flex items-center gap-1.5 text-xs text-amber-400 hover:opacity-80 transition-opacity">
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {isCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          value={generatePrompt()}
                          className="w-full h-32 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-300 font-mono resize-none focus:outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">2. Paste AI Result (JSON)</span>
                        </div>
                        <textarea
                          value={pasteInput}
                          onChange={(e) => setPasteInput(e.target.value)}
                          placeholder='[{"word": "Hello", "start": 0.0, "end": 0.5}]'
                          className="w-full h-32 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-300 font-mono resize-none focus:border-amber-400/80 focus:outline-none"
                        />
                        <button 
                          onClick={applyManualJSON}
                          disabled={!pasteInput.trim()}
                          className="w-full py-2 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-200 text-xs font-medium rounded-lg transition-colors"
                        >
                          Apply Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
```

- [ ] **Step 2: Add Word Grid UI**

Below the new AI Assistant section (before Output Settings), add:

```tsx
              <div className="space-y-4 pt-4 border-t border-neutral-800">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <h3 className="font-medium text-neutral-200">Word Grid</h3>
                  <div className="flex items-center gap-3">
                    {hasChanges && (
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1 text-xs text-neutral-400 hover:text-amber-400 transition-colors"
                        title="Reset changes"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                      </button>
                    )}
                    <div className="relative">
                      <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search word..."
                        className="bg-neutral-900 border border-neutral-800 rounded-md pl-9 pr-3 py-1.5 text-sm text-neutral-200 focus:border-amber-400/80 outline-none"
                      />
                    </div>
                    <span className="text-xs bg-amber-400/10 text-amber-400 px-2 py-1 rounded-md">
                      {words.length} words
                    </span>
                  </div>
                </div>

                {words.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 text-sm">
                    No words found.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {words.map((w, idx) => {
                      const isMatch = search && w.word.toLowerCase().includes(search.toLowerCase());
                      const isChanged = originalWords[idx] && w.word !== originalWords[idx].word;
                      return (
                        <div key={idx} className="flex flex-col gap-1">
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {w.start.toFixed(1)}s - {w.end.toFixed(1)}s
                          </span>
                          <input
                            type="text"
                            value={w.word}
                            onChange={e => handleWordChange(idx, e.target.value)}
                            className={`bg-neutral-900 border rounded-md px-2 py-1.5 text-sm text-neutral-200 focus:outline-none ${
                              isMatch ? 'border-amber-400 bg-amber-400/10' :
                              isChanged ? 'border-yellow-500/50 bg-yellow-500/5' :
                              'border-neutral-800 focus:border-amber-400/80'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
```

- [ ] **Step 3: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

If `auto_commit: true` (default when absent):
```bash
git add web/src/components/ClipEditModal.tsx
git commit -m "feat(web): align ClipEditModal with desktop word grid and manual AI correction"
```

If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."
