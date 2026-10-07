"use client";

import { X, Download, FileText } from "lucide-react";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
}

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  title,
  url,
}: DocumentPreviewModalProps) {
  if (!isOpen || !url) return null;

  const urlLower = url.toLowerCase();
  const isPdf = urlLower.includes("application/pdf") || urlLower.endsWith(".pdf");
  const isWordDoc =
    urlLower.includes("msword") ||
    urlLower.includes("wordprocessing") ||
    urlLower.endsWith(".doc") ||
    urlLower.endsWith(".docx");
  const isGenericDoc = isPdf || isWordDoc;

  const getDocTypeBadge = () => {
    if (isPdf) return "PDF Document";
    if (isWordDoc) return "Word Document";
    return "Image Preview";
  };

  const getDownloadFilename = () => {
    if (isWordDoc) return urlLower.endsWith(".docx") ? "document.docx" : "document.doc";
    if (isPdf) return "document.pdf";
    return "document.jpg";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E7E5E0] flex items-center justify-between bg-[#FAFAF8]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-[#171717]">{title}</span>
            <span className="text-xs text-[#8B8B86] bg-[#F0EFEA] px-2 py-0.5 rounded">
              {getDocTypeBadge()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#6B6B67] hover:text-[#171717] hover:bg-[#E7E5E0] transition-colors cursor-pointer"
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-[#F4F4F2] min-h-[350px]">
          {isGenericDoc ? (
            <div className="w-full h-[60vh] flex flex-col items-center justify-center bg-white rounded-xl p-6 border border-[#E7E5E0] text-center">
              <FileText size={48} className="text-[#0B5D45] mb-3" />
              <p className="font-semibold text-sm text-[#171717] mb-1">{title}</p>
              <p className="text-xs text-[#6B6B67] mb-4">
                {isWordDoc ? "Document attached and secured (up to 15MB)." : "PDF document attached and secured (up to 15MB)."}
              </p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                download={getDownloadFilename()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B5D45] text-white text-xs font-semibold hover:bg-[#084936] transition-colors"
              >
                <Download size={14} />
                <span>Open or Download Document</span>
              </a>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={title}
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-md border border-[#E7E5E0]"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E7E5E0] bg-white flex items-center justify-between text-xs text-[#6B6B67]">
          <span>Document is securely stored and visible only to verification compliance officers.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[#E7E5E0] text-[#171717] hover:bg-[#FAFAF8] font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
