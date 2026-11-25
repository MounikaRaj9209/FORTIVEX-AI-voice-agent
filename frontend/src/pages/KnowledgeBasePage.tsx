import React, { useEffect, useState } from "react";
import { BookOpen, FileUp, Plus, Search, Trash2 } from "lucide-react";
import { api } from "../api/client";
import type { KnowledgeDocument, RagSource } from "../types";

export function KnowledgeBasePage() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("product");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RagSource[]>([]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await api.getKnowledge();
      setDocs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (title.trim()) fd.append("title", title.trim());
      fd.append("category", category);
      await api.uploadKnowledgeFile(fd);
      setMessage(`Uploaded and indexed "${file.name}" into vector chunks.`);
      setFile(null);
      setTitle("");
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTextAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      await api.addKnowledgeText({ title, category, content });
      setMessage(`Indexed "${title}" into RAG knowledge base.`);
      setTitle("");
      setContent("");
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
    if (!window.confirm("Delete this knowledge document and its chunks?")) return;
    await api.deleteKnowledge(id);
    await loadDocs();
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleFileUpload}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-blue-600" />
            <h3 className="font-display text-sm font-bold text-slate-900">
              Upload PDF or TXT Document
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <input
              type="text"
              placeholder="Optional document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl bg-white"
            >
              <option value="company">Company Info</option>
              <option value="product">Product Description</option>
              <option value="pricing">Pricing Info</option>
              <option value="faq">FAQs</option>
              <option value="general">General</option>
            </select>
          </div>
          <input
            type="file"
            accept=".pdf,.txt,.md,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            type="submit"
            disabled={!file || submitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer"
          >
            {submitting ? "Indexing..." : "Upload & Index"}
          </button>
        </form>

        <form
          onSubmit={handleTextAdd}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-teal-600" />
            <h3 className="font-display text-sm font-bold text-slate-900">
              Add Product / Pricing / FAQ Text
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <input
              required
              type="text"
              placeholder="Title (e.g. Enterprise SLA)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl bg-white"
            >
              <option value="company">Company Info</option>
              <option value="product">Product Description</option>
              <option value="pricing">Pricing Info</option>
              <option value="faq">FAQs</option>
            </select>
          </div>
          <textarea
            required
            minLength={10}
            rows={3}
            placeholder="Paste pricing tiers, specifications, or FAQ answers..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-[#0B1120] hover:bg-slate-800 text-white text-sm font-semibold rounded-xl cursor-pointer"
          >
            Save & Embed
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        <h3 className="font-display text-sm font-bold text-slate-900">
          Test RAG Semantic Retrieval
        </h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask a customer question (e.g. What does the Growth plan include?)"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl cursor-pointer"
          >
            Retrieve Chunks
          </button>
        </form>
        {searchResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {searchResults.map((r, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs">
                <div className="flex justify-between font-semibold text-blue-800 mb-1">
                  <span>{r.title}</span>
                  <span>Score: {r.score}</span>
                </div>
                <p className="text-slate-700">{r.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-900">
            Indexed Knowledge Documents ({docs.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading knowledge documents...</p>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-sm text-slate-900">{doc.title}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] uppercase font-medium">
                      {doc.category}
                    </span>
                    <span className="text-[11px] text-teal-700 font-semibold">
                      {doc.chunk_count} chunk(s)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{doc.content}</p>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                  title="Delete Document"
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
