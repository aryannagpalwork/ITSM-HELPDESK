
import React, { useState, useEffect } from 'react';
import { useApp } from '../shared/AppContext';
import { Search, BookOpen, Tag, Plus, X, File, AlertCircle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { listKnowledgeDocuments, uploadKnowledgeDocument, deleteKnowledgeDocument, KnowledgeDocument } from '../shared/api';
import toast, { Toaster } from 'react-hot-toast';

export const KnowledgeBase: React.FC = () => {
  const { currentUser } = useApp();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const categories = ['all', 'Authentication', 'Network', 'Procurement', 'Software', 'Other'];

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const docs = await listKnowledgeDocuments(search, activeCategory === 'all' ? undefined : activeCategory);
      setDocuments(docs);
    } catch (e) {
      console.error('Failed to load documents:', e);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const clearSelectedFile = () => {
    setUploadFile(null);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      const tags = uploadTags.split(',').map(t => t.trim()).filter(Boolean);
      await uploadKnowledgeDocument(uploadFile, uploadTitle || uploadFile.name, uploadCategory || undefined, tags);
      toast.success('Document uploaded and processed!');
      setIsModalOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadCategory('');
      setUploadTags('');
      await loadDocuments();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteKnowledgeDocument(docId);
      toast.success('Document deleted');
      await loadDocuments();
    } catch (e) {
      toast.error('Failed to delete document');
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = search
      ? doc.title.toLowerCase().includes(search.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
      : true;
    const matchesCategory = activeCategory === 'all' ? true : doc.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div id="knowledge-base-workspace" className="flex-1 bg-app p-8 overflow-y-auto h-full font-sans">
      <Toaster position="top-right" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-accent font-semibold mb-1 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Systems Library</span>
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Knowledge Base</h1>
          <p className="text-xs text-secondary">
            Upload and manage documents for AI-powered search and retrieval.
          </p>
        </div>

        {currentUser.role !== 'Employee' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 accent-btn rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg cursor-pointer self-start sm:self-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        )}
      </div>

      <div className="bg-card border border-token rounded-2xl p-4 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 text-[11px] rounded-lg font-medium capitalize border transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-accent-soft text-accent border-token-strong font-semibold'
                  : 'bg-card-solid border-token text-secondary hover-text'
              }`}
            >
              {cat === 'all' ? 'All Documents' : cat}
            </button>
          ))}
        </div>

        <div className="relative flex items-center w-full md:max-w-xs">
          <Search className="absolute left-3 w-3.5 h-3.5 text-tertiary" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadDocuments();
            }}
            className="w-full input-token rounded-lg pl-9 pr-3 py-2 text-xs outline-none transition-all"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="border border-dashed border-token rounded-2xl p-16 text-center bg-card">
          <BookOpen className="w-10 h-10 text-tertiary mx-auto mb-3" />
          <h3 className="text-sm font-bold text-secondary">No Documents Found</h3>
          <p className="text-xs text-tertiary max-w-sm mx-auto mt-1.5 leading-relaxed">
            {currentUser.role !== 'Employee'
              ? 'Upload your first document to get started with AI-powered search.'
              : 'No documents available yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDocs.map(doc => (
            <div
              key={doc.id}
              className="bg-card border border-token hover-border rounded-2xl p-5 flex items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-card-solid rounded-xl border border-token">
                  <File className="w-5 h-5 text-accent" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-primary truncate">{doc.title}</h3>
                    {getStatusIcon(doc.status)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-card-solid text-secondary border border-token">
                      {doc.file_type}
                    </span>
                    {doc.category && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-card-solid text-secondary border border-token">
                        {doc.category}
                      </span>
                    )}
                    <span className="text-xs text-tertiary">
                      Uploaded by {doc.uploaded_by || 'Unknown'} • {new Date(doc.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                  {doc.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Tag className="w-3 h-3 text-tertiary shrink-0" />
                      {doc.tags.map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] font-mono text-secondary bg-card-solid px-2 py-0.5 rounded border border-token"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {currentUser.role === 'Administrator' && (
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card-solid border border-token rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <Plus className="w-4.5 h-4.5 text-accent" />
                Upload Document
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-secondary hover-text hover-elev rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4 relative ${
                uploadFile
                  ? 'bg-accent-soft border-token-strong'
                  : 'border-token bg-input hover-border'
              }`}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              {uploadFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center gap-3">
                    <File className="w-8 h-8 text-accent" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-primary">{uploadFile.name}</p>
                      <p className="text-xs text-tertiary">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSelectedFile();
                    }}
                    className="p-1.5 text-secondary hover-text hover-elev rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <File className="w-10 h-10 text-tertiary mx-auto mb-3" />
                  <p className="text-sm text-secondary">Drag and drop a file here, or click to browse</p>
                  <p className="text-xs text-tertiary mt-1">Supports PDF, DOCX, TXT, and Markdown</p>
                </div>
              )}
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-tertiary mb-1">
                  Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Document title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-tertiary mb-1">
                  Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full input-token rounded-lg p-2 text-xs outline-none cursor-pointer"
                >
                  <option value="">Select a category</option>
                  <option value="Authentication">Authentication</option>
                  <option value="Network">Network</option>
                  <option value="Procurement">Procurement</option>
                  <option value="Software">Software</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-tertiary mb-1">
                  Tags (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="vpn, credential, network"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-token">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-secondary hover-text bg-card border border-token cursor-pointer"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!uploadFile || isUploading}
                className="px-4 py-2 rounded-lg text-xs font-semibold accent-btn disabled:opacity-50 cursor-pointer shadow-md flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
