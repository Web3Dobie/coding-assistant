import React, { useState } from "react";

// VS Code Dark Theme Colors
const vsCodeTheme = {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    comment: '#6a9955',
    keyword: '#569cd6',
    string: '#ce9178',
    number: '#b5cea8',
    function: '#dcdcaa',
    variable: '#9cdcfe',
    operator: '#d4d4d4',
    punctuation: '#cccccc',
    className: '#4ec9b0',
    tag: '#92c5f7',
    attribute: '#9cdcfe',
    border: '#3c3c3c'
};

// Enhanced code highlighting for artifact viewer
const highlightCode = (code, language) => {
    let highlighted = code;

    if (language === 'bash' || language === 'shell' || language === 'sh') {
        highlighted = highlighted
            .replace(/^(\$\s*)/gm, '<span style="color: #569cd6; font-weight: bold;">$1</span>')
            .replace(/\b(cd|ls|mkdir|rm|cp|mv|git|npm|docker|curl|wget|chmod|sudo|echo|cat|grep|find|ps|kill|top)\b/g, '<span style="color: #569cd6; font-weight: bold;">$1</span>')
            .replace(/(--?[a-zA-Z-]+)/g, '<span style="color: #9cdcfe;">$1</span>')
            .replace(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span style="color: #ce9178;">$1$2$1</span>')
            .replace(/#.*$/gm, '<span style="color: #6a9955; font-style: italic;">$&</span>')
            .replace(/\b(\d+)\b/g, '<span style="color: #b5cea8;">$1</span>');
    } else if (language === 'javascript' || language === 'js' || language === 'jsx') {
        highlighted = highlighted
            .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|try|catch|finally)\b/g, '<span style="color: #569cd6; font-weight: bold;">$1</span>')
            .replace(/\b(true|false|null|undefined)\b/g, '<span style="color: #569cd6;">$1</span>')
            .replace(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span style="color: #ce9178;">$1$2$1</span>')
            .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color: #b5cea8;">$1</span>')
            .replace(/\/\/.*$/gm, '<span style="color: #6a9955; font-style: italic;">$&</span>')
            .replace(/\/\*[\s\S]*?\*\//g, '<span style="color: #6a9955; font-style: italic;">$&</span>')
            .replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, '<span style="color: #4ec9b0;">$1</span>');
    } else if (language === 'python' || language === 'py') {
        highlighted = highlighted
            .replace(/\b(def|class|import|from|return|if|elif|else|for|while|try|except|with|as|async|await|lambda|yield|global|nonlocal)\b/g, '<span style="color: #569cd6; font-weight: bold;">$1</span>')
            .replace(/\b(True|False|None)\b/g, '<span style="color: #569cd6;">$1</span>')
            .replace(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span style="color: #ce9178;">$1$2$1</span>')
            .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color: #b5cea8;">$1</span>')
            .replace(/#.*$/gm, '<span style="color: #6a9955; font-style: italic;">$&</span>')
            .replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, '<span style="color: #4ec9b0;">$1</span>');
    } else if (language === 'css') {
        highlighted = highlighted
            .replace(/([.#]?[a-zA-Z-]+)(\s*{)/g, '<span style="color: #92c5f7;">$1</span>$2')
            .replace(/([a-zA-Z-]+)(\s*:)/g, '<span style="color: #9cdcfe;">$1</span><span style="color: #cccccc;">$2</span>')
            .replace(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span style="color: #ce9178;">$1$2$1</span>')
            .replace(/\b(\d+(?:px|em|rem|%|vh|vw)?)\b/g, '<span style="color: #b5cea8;">$1</span>');
    } else if (language === 'markdown' || language === 'md') {
        highlighted = highlighted
            .replace(/^(#{1,6})\s+(.*)$/gm, '<span style="color: #569cd6; font-weight: bold;">$1</span> <span style="color: #dcdcaa; font-weight: bold;">$2</span>')
            .replace(/\*\*(.*?)\*\*/g, '<span style="color: #dcdcaa; font-weight: bold;">**$1**</span>')
            .replace(/\*(.*?)\*/g, '<span style="color: #dcdcaa; font-style: italic;">*$1*</span>')
            .replace(/`([^`]+)`/g, '<span style="color: #ce9178; background-color: #2d2d30; padding: 2px 4px; border-radius: 3px;">$1</span>')
            .replace(/^\s*[-*+]\s+/gm, '<span style="color: #569cd6;">$&</span>')
            .replace(/^\s*\d+\.\s+/gm, '<span style="color: #569cd6;">$&</span>');
    } else if (language === 'json') {
        highlighted = highlighted
            .replace(/"([^"]+)"(\s*:)/g, '<span style="color: #9cdcfe;">"$1"</span>$2')
            .replace(/:\s*"([^"]+)"/g, ': <span style="color: #ce9178;">"$1"</span>')
            .replace(/:\s*(true|false|null)/g, ': <span style="color: #569cd6;">$1</span>')
            .replace(/:\s*(\d+(?:\.\d+)?)/g, ': <span style="color: #b5cea8;">$1</span>');
    }

    return highlighted;
};

export default function ArtifactViewer({ artifact, onClose }) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(artifact.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getArtifactIcon = () => {
        switch (artifact.type) {
            case 'file':
                return '📄';
            case 'code':
                return '⚡';
            case 'document':
                return '📝';
            default:
                return '📄';
        }
    };

    const highlightedContent = highlightCode(artifact.content, artifact.language);

    return (
        <div className="h-full flex flex-col">
            {/* Artifact header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{getArtifactIcon()}</span>
                            <span className="text-sm font-medium text-gray-900 truncate">
                                {artifact.title}
                            </span>
                        </div>
                        <div className="text-xs text-gray-500">
                            {artifact.language} • {artifact.content.split('\n').length} lines
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={copyToClipboard}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                    >
                        {copied ? (
                            <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                            </>
                        )}
                    </button>

                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Close artifact"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Artifact content */}
            <div className="flex-1 overflow-hidden">
                <div
                    className="h-full p-4 text-sm font-mono overflow-auto"
                    style={{
                        backgroundColor: vsCodeTheme.background,
                        color: vsCodeTheme.foreground,
                    }}
                >
                    <pre
                        className="whitespace-pre-wrap leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: highlightedContent }}
                    />
                </div>
            </div>

            {/* Artifact footer with metadata */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                <div className="flex items-center justify-between">
                    <span>Type: {artifact.type}</span>
                    <span>Language: {artifact.language}</span>
                    <span>{artifact.content.length} characters</span>
                </div>
            </div>
        </div>
    );
}