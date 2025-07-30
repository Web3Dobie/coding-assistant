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

// Code highlighting with VS Code theme
const highlightCode = (code, language) => {
    // Simple syntax highlighting - you could integrate with a library like Prism.js for more accuracy
    let highlighted = code;

    if (language === 'javascript' || language === 'js' || language === 'jsx') {
        highlighted = highlighted
            .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await)\b/g, '<span style="color: #569cd6">$1</span>')
            .replace(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span style="color: #ce9178">$1$2$1</span>')
            .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color: #b5cea8">$1</span>')
            .replace(/\/\/.*$/gm, '<span style="color: #6a9955">$&</span>')
            .replace(/\/\*[\s\S]*?\*\//g, '<span style="color: #6a9955">$&</span>');
    } else if (language === 'python' || language === 'py') {
        highlighted = highlighted
            .replace(/\b(def|class|import|from|return|if|elif|else|for|while|try|except|with|as|async|await|True|False|None)\b/g, '<span style="color: #569cd6">$1</span>')
            .replace(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span style="color: #ce9178">$1$2$1</span>')
            .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color: #b5cea8">$1</span>')
            .replace(/#.*$/gm, '<span style="color: #6a9955">$&</span>');
    } else if (language === 'css') {
        highlighted = highlighted
            .replace(/([.#]?[a-zA-Z-]+)(\s*{)/g, '<span style="color: #92c5f7">$1</span>$2')
            .replace(/([a-zA-Z-]+)(\s*:)/g, '<span style="color: #9cdcfe">$1</span>$2')
            .replace(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span style="color: #ce9178">$1$2$1</span>');
    }

    return highlighted;
};

// Enhanced code block component
const CodeBlock = ({ code, language, title }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const highlightedCode = highlightCode(code, language);

    return (
        <div className="my-4 rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
            {/* Code block header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                        {title || `${language || 'code'}`}
                    </span>
                </div>
                <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                >
                    {copied ? (
                        <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Copied!
                        </>
                    ) : (
                        <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                        </>
                    )}
                </button>
            </div>

            {/* Code content with VS Code styling */}
            <div
                className="p-4 text-sm font-mono overflow-x-auto"
                style={{
                    backgroundColor: vsCodeTheme.background,
                    color: vsCodeTheme.foreground,
                }}
            >
                <pre
                    className="whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
            </div>
        </div>
    );
};

// Process message content to detect and enhance code blocks
const processMessageContent = (content) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        // Add text before code block
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: content.slice(lastIndex, match.index)
            });
        }

        // Add code block
        parts.push({
            type: 'code',
            language: match[1] || 'text',
            content: match[2].trim()
        });

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
        parts.push({
            type: 'text',
            content: content.slice(lastIndex)
        });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
};

// Format regular text with markdown-like styling
const formatText = (text) => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
        .replace(/\n/g, '<br>');
};

export default function Message({ role, content, timestamp }) {
    const parts = processMessageContent(content);

    return (
        <div className={`flex gap-4 ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {/* Avatar */}
            {role !== 'user' && (
                <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white text-sm font-semibold">
                        AI
                    </div>
                </div>
            )}

            {/* Message content */}
            <div className={`max-w-[80%] ${role === 'user' ? 'order-last' : ''}`}>
                <div
                    className={`rounded-lg px-4 py-3 ${role === 'user'
                            ? 'bg-blue-600 text-white ml-auto'
                            : role === 'system'
                                ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                                : 'bg-gray-50 border border-gray-200 text-gray-900'
                        }`}
                >
                    {parts.map((part, index) => (
                        <div key={index}>
                            {part.type === 'code' ? (
                                <CodeBlock
                                    code={part.content}
                                    language={part.language}
                                    title={`${part.language} code`}
                                />
                            ) : (
                                <div
                                    className={`${role === 'user' ? 'text-white' : ''} leading-relaxed`}
                                    dangerouslySetInnerHTML={{
                                        __html: formatText(part.content)
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Timestamp */}
                {timestamp && (
                    <div className={`text-xs text-gray-500 mt-1 ${role === 'user' ? 'text-right' : 'text-left'}`}>
                        {timestamp}
                    </div>
                )}
            </div>

            {/* User avatar */}
            {role === 'user' && (
                <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-sm font-semibold">
                        U
                    </div>
                </div>
            )}
        </div>
    );
}