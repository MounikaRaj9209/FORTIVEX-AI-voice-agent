import React, { useEffect, useState } from "react";
import { BookOpen, FileUp, GraduationCap, Plus, Search, Trash2 } from "lucide-react";
import { api } from "../api/client";
import type { KnowledgeDocument, RagSource } from "../types";

const CATEGORY_OPTIONS = [
  { value: "company",  label: "Company Info" },
  { value: "product",  label: "Product" },
  { value: "pricing",  label: "Pricing" },
  { value: "course",   label: "Course" },
  { value: "faq",      label: "FAQs" },
  { value: "general",  label: "General" },
];

const CATEGORY_COLORS: Record<string, string> = {
  company:  "bg-pink-50   text-pink-700   border-pink-200",
  product:  "bg-rose-50   text-rose-700   border-rose-200",
  pricing:  "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  course:   "bg-purple-50 text-purple-700 border-purple-200",
  faq:      "bg-amber-50  text-amber-700  border-amber-200",
  general:  "bg-slate-100 text-slate-600  border-slate-200",
  seed:     "bg-slate-100 text-slate-500  border-slate-200",
};

export function KnowledgeBasePage() {
  const [docs, setDocs]           = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading]     = useState(true);
  const [title, setTitle]         = useState("");
  const [category, setCategory]   = useState("product");
  const [content, setContent]     = useState("");
  const [file, setFile]           = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage]     = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<RagSource[]>([]);
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");

  const loadDocs = async () => {
    setLoading(true);
    try {
      setDocs(await api.getKnowledge());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDocs(); }, []);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null); setMessage(null); setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (title.trim()) fd.append("title", title.trim());
      fd.append("category", category);
      await api.uploadKnowledgeFile(fd);
      setMessage(`✅ "${file.name}" uploaded and indexed into RAG chunks.`);
      setFile(null); setTitle("");
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTextAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMessage(null); setSubmitting(true);
    try {
      await api.addKnowledgeText({ title, category, content });
      setMessage(`✅ "${title}" indexed into RAG knowledge base.`);
      setTitle(""); setContent("");
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add document");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const res = await api.searchKnowledge(searchQuery.trim());
    setSearchResults(res.results);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this knowledge document and all its chunks?")) return;
    await api.deleteKnowledge(id);
    await loadDocs();
  };

  // group by category for display
  const courses = docs.filter(d => d.category === "course");
  const others  = docs.filter(d => d.category !== "course");

  return (
    <div className="space-y-6">

      {/* ── feedback banners ── */}
      {message && (
        <div className="p-3 rounded-xl bg-pink-50 border border-pink-200 text-pink-900 text-sm flex items-center gap-2">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="ml-auto text-pink-400 hover:text-pink-700 cursor-pointer">✕</button>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-700 cursor-pointer">✕</button>
        </div>
      )}

      {/* ── course highlight cards ── */}
      {courses.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-5 w-5 text-purple-600" />
            <h2 className="font-display text-sm font-bold text-slate-900">Available Courses ({courses.length})</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {courses.map(doc => (
              <div key={doc.id} className="bg-white rounded-2xl border border-purple-200 p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-display text-sm font-bold text-slate-900 leading-tight">{doc.title}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border mt-1 ${CATEGORY_COLORS.course}`}>
                        course
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* key details parsed from content */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: "Duration",  val: doc.content.match(/Duration:\s*([^\n]+)/)?.[1]?.trim() },
                    { label: "Price",     val: doc.content.match(/Price:\s*([^\n]+)/)?.[1]?.trim() },
                    { label: "Level",     val: doc.content.match(/Level:\s*([^\n]+)/)?.[1]?.trim() },
                    { label: "Language",  val: doc.content.match(/Language:\s*([^\n]+)/)?.[1]?.trim() },
                    { label: "Certificate", val: doc.content.match(/Certificate:\s*([^\n]+)/)?.[1]?.trim() },
                    { label: "RAG Chunks", val: `${doc.chunk_count} indexed` },
                  ].filter(r => r.val).map(({ label, val }) => (
                    <div key={label} className="bg-purple-50/60 rounded-lg px-2.5 py-1.5 border border-purple-100">
                      <span className="block text-purple-500 text-[10px] font-semibold uppercase tracking-wide">{label}</span>
                      <span className="text-slate-800 font-medium">{val}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{doc.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── add new document ── */}
      <div className="bg-white rounded-2xl border border-pink-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-pink-100 flex items-center gap-3 bg-pink-50/40">
          <Plus className="h-4 w-4 text-pink-600" />
          <h3 className="font-display text-sm font-bold text-slate-900">Add to Knowledge Base</h3>
          <div className="ml-auto flex rounded-xl overflow-hidden border border-pink-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("text")}
              className={`px-3 py-1.5 cursor-pointer transition ${activeTab === "text" ? "bg-pink-600 text-white" : "bg-white text-slate-600 hover:bg-pink-50"}`}
            >
              Text / Course
            </button>
            <button
              onClick={() => setActiveTab("file")}
              className={`px-3 py-1.5 cursor-pointer transition ${activeTab === "file" ? "bg-pink-600 text-white" : "bg-white text-slate-600 hover:bg-pink-50"}`}
            >
              Upload PDF/TXT
            </button>
          </div>
        </div>

        <div className="p-5">
          {activeTab === "text" ? (
            <form onSubmit={handleTextAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <input
                  required type="text"
                  placeholder="Title (e.g. Python Course, React Guide)"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="px-3 py-2 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="px-3 py-2 border border-pink-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                required minLength={10} rows={4}
                placeholder="Paste course description, pricing, syllabus, FAQs, or any product details here..."
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              <button
                type="submit" disabled={submitting}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer transition"
              >
                {submitting ? "Indexing…" : "Save & Embed into RAG"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleFileUpload} className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <input
                  type="text" placeholder="Optional title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="px-3 py-2 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="px-3 py-2 border border-pink-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="border-2 border-dashed border-pink-200 rounded-xl p-4 text-center">
                <FileUp className="h-7 w-7 text-pink-300 mx-auto mb-2" />
                <input
                  type="file" accept=".pdf,.txt,.md,.csv"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 mt-1">PDF, TXT, MD, CSV · max 5MB</p>
              </div>
              <button
                type="submit" disabled={!file || submitting}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer transition"
              >
                {submitting ? "Indexing…" : "Upload & Index"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── RAG search ── */}
      <div className="bg-white rounded-2xl border border-pink-200 p-5 shadow-sm space-y-3">
        <h3 className="font-display text-sm font-bold text-slate-900">Test RAG Semantic Retrieval</h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-pink-400 absolute left-3 top-2.5" />
            <input
              type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder='Try: "What does the C++ course include?" or "Java Spring Boot price"'
              className="w-full pl-9 pr-3 py-2 text-sm border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>
          <button type="submit"
            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold rounded-xl cursor-pointer">
            Search
          </button>
        </form>
        {searchResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {searchResults.map((r, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-pink-50/60 border border-pink-100 text-xs">
                <div className="flex justify-between font-semibold text-pink-800 mb-1">
                  <span>{r.title}</span>
                  <span className="text-pink-500">Score: {r.score}</span>
                </div>
                <p className="text-slate-700 leading-relaxed">{r.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── all documents ── */}
      <div className="bg-white rounded-2xl border border-pink-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-pink-100 bg-pink-50/40 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-900">
            All Indexed Documents ({docs.length})
          </h3>
          <span className="text-xs text-slate-500">
            {courses.length} course{courses.length !== 1 ? "s" : ""} · {others.length} other docs
          </span>
        </div>
        <div className="divide-y divide-pink-50">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading knowledge documents…</p>
          ) : docs.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No documents indexed yet. Add one above.</p>
          ) : (
            docs.map(doc => (
              <div key={doc.id} className="p-4 flex items-start justify-between gap-4 hover:bg-pink-50/30 transition">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {doc.category === "course"
                      ? <GraduationCap className="h-4 w-4 text-purple-600 shrink-0" />
                      : <BookOpen className="h-4 w-4 text-pink-500 shrink-0" />}
                    <span className="font-semibold text-sm text-slate-900 truncate">{doc.title}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.general}`}>
                      {doc.category}
                    </span>
                    <span className="text-[11px] text-pink-600 font-semibold">
                      {doc.chunk_count} chunk{doc.chunk_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{doc.content}</p>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
                  title="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
