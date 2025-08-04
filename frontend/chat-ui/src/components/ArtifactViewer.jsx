import React, { useState, useEffect } from "react";

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

// Simple code highlighting for artifact viewer - NO HTML ENTITY ISSUES
const highlightCode = (code, language) => {
    // Just escape HTML properly and apply basic highlighting
    let highlighted = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

    // Simple keyword highlighting without complex regex
    if (language === 'python' || language === 'py') {
        highlighted = highlighted
            .replace(/\b(def|class|import|from|return|if|elif|else|for|while|try|except|with|as|async|await|lambda|yield)\b/g, '<span style="color: #569cd6; font-weight: bold;">$1</span>')
            .replace(/\b(True|False|None)\b/g, '<span style="color: #569cd6;">$1</span>')
            .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color: #b5cea8;">$1</span>')
            .replace(/#[^\n]*/g, '<span style="color: #6a9955; font-style: italic;">$&</span>');
    } else if (language === 'javascript' || language === 'js' || language === 'jsx') {
        highlighted = highlighted
            .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|try|catch|finally)\b/g, '<span style="color: #569cd6; font-weight: bold;">$1</span>')
            .replace(/\b(true|false|null|undefined)\b/g, '<span style="color: #569cd6;">$1</span>')
            .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color: #b5cea8;">$1</span>')
            .replace(/\/\/[^\n]*/g, '<span style="color: #6a9955; font-style: italic;">$&</span>');
    } else if (language === 'bash' || language === 'shell' || language === 'sh') {
        highlighted = highlighted
            .replace(/\b(cd|ls|mkdir|rm|cp|mv|git|npm|docker|curl|wget|chmod|sudo|echo|cat|grep|find|ps|kill|top)\b/g, '<span style="color: #569cd6; font-weight: bold;">$1</span>')
            .replace(/\b(\d+)\b/g, '<span style="color: #b5cea8;">$1</span>')
            .replace(/#[^\n]*/g, '<span style="color: #6a9955; font-style: italic;">$&</span>');
    } else if (language === 'css') {
        highlighted = highlighted
            .replace(/([.#]?[a-zA-Z-]+)(\s*\{)/g, '<span style="color: #92c5f7;">$1</span>$2')
            .replace(/([a-zA-Z-]+)(\s*:)/g, '<span style="color: #9cdcfe;">$1</span><span style="color: #cccccc;">$2</span>')
            .replace(/\b(\d+(?:px|em|rem|%|vh|vw)?)\b/g, '<span style="color: #b5cea8;">$1</span>');
    } else if (language === 'json') {
        highlighted = highlighted
            .replace(/&quot;([^&\n]+)&quot;(\s*:)/g, '<span style="color: #9cdcfe;">&quot;$1&quot;</span>$2')
            .replace(/:\s*&quot;([^&\n]+)&quot;/g, ': <span style="color: #ce9178;">&quot;$1&quot;</span>')
            .replace(/:\s*(true|false|null)/g, ': <span style="color: #569cd6;">$1</span>')
            .replace(/:\s*(\d+(?:\.\d+)?)/g, ': <span style="color: #b5cea8;">$1</span>');
    }

    return highlighted;
};

export default function ArtifactViewer({
    artifact,
    onClose,
    onVersionSelect,
    artifactVersions = []
}) {
    const [copied, setCopied] = useState(false);
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(artifact);

    // Update selected version when artifact prop changes
    useEffect(() => {
        setSelectedVersion(artifact);
    }, [artifact]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(selectedVersion.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getArtifactIcon = () => {
        switch (selectedVersion.type) {
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

    const formatRelativeTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const highlightedContent = highlightCode(selectedVersion.content, selectedVersion.language);

    // Sort versions by version number
    const sortedVersions = [...artifactVersions].sort((a, b) => b.version - a.version);

    return (
        <div className="h-full flex flex-col">
            {/* Artifact header */}
            <div className="flex flex-col bg-white border-b border-gray-200">
                {/* Title bar */}
                <div className="flex items-center justify-between px-4 py-3">
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
                                    {selectedVersion.title}
                                </span>
                                {selectedVersion.version > 1 && (
                                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                        v{selectedVersion.version}
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-gray-500">
                                {selectedVersion.language} • {selectedVersion.content.split('\n').length} lines
                                {selectedVersion.createdAt && (
                                    <span> • {formatRelativeTime(selectedVersion.createdAt)}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {artifactVersions.length > 1 && (
                            <button
                                onClick={() => setShowVersionHistory(!showVersionHistory)}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {artifactVersions.length} versions
                            </button>
                        )}

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

                {/* Version history dropdown */}
                {showVersionHistory && artifactVersions.length > 1 && (
                    <div className="px-4 pb-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-2">Version History</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {sortedVersions.map((version) => (
                                <button
                                    key={version.id}
                                    onClick={() => {
                                        setSelectedVersion(version);
                                        if (onVersionSelect) onVersionSelect(version);
                                        setShowVersionHistory(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${selectedVersion.id === version.id
                                        ? 'bg-blue-100 text-blue-900'
                                        : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">v{version.version}</span>
                                        <span className="text-gray-400">
                                            {formatRelativeTime(version.createdAt)}
                                        </span>
                                    </div>
                                    <div className="text-gray-500 truncate mt-1">
                                        {version.content.split('\n')[0].slice(0, 50)}...
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
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
                    <div className="flex items-center gap-4">
                        <span>Type: {selectedVersion.type}</span>
                        <span>Language: {selectedVersion.language}</span>
                        <span>{selectedVersion.content.length} characters</span>
                    </div>
                    {artifactVersions.length > 1 && (
                        <div className="flex items-center gap-2">
                            <span>Version {selectedVersion.version} of {artifactVersions.length}</span>
                            {selectedVersion.version < Math.max(...artifactVersions.map(v => v.version)) && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                                    Older version
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}