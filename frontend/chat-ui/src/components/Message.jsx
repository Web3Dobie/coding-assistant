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

// Enhanced code highlighting with VS Code theme - improved bash support
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
            .replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, '<span style="color: #4ec9b0;">$1</span>'); // Classes
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

// Process message content to detect file content vs regular code blocks
const processMessageContent = (content) => {
    // For the conversation view, we don't want to show artifacts as separate blocks
    // The artifact detection happens in the useEffect hook below

    // Regular message processing for code blocks
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

// Regular code block component for inline display
const CodeBlock = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const highlightedCode = highlightCode(code, language);

    return (
        <div className="my-3 rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-medium text-gray-600">{language || 'code'}</span>
                <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                >
                    {copied ? '✓ Copied' : 'Copy'}
                </button>
            </div>
            <div
                className="p-3 text-sm font-mono overflow-x-auto"
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

// Format regular text with proper Claude-style markdown formatting
const formatText = (text) => {
    return text
        // Bold text with ** markers
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
        // Italic text with * markers  
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic text-gray-700">$1</em>')
        // File paths and important code snippets in red background
        .replace(/`([^`]+\.(js|jsx|ts|tsx|py|css|html|json|md|txt|yml|yaml|env|gitignore|dockerfile))`/gi, '<code class="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-sm font-mono border border-red-200">$1</code>')
        // Commands starting with / in blue background
        .replace(/`(\/[a-zA-Z-]+(?:\s+[^`]*)?)`/g, '<code class="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-sm font-mono border border-blue-200">$1</code>')
        // Regular inline code in gray background
        .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
        // Line breaks
        .replace(/\n/g, '<br>');
};

export default function Message({ role, content, timestamp, onArtifactCreate }) {
    const parts = processMessageContent(content);

    // Check if this message should create an artifact
    useEffect(() => {
        if (role === 'assistant' && onArtifactCreate) {
            // Check for complete files
            const fileHeaderRegex = /^(Here's a detailed .*?\.(\w+) file|Here's the .*?\.(\w+) file|Here's your .*?\.(\w+) file)/i;
            const fileMatch = content.match(fileHeaderRegex);

            if (fileMatch) {
                const extension = fileMatch[2] || fileMatch[3] || fileMatch[4] || 'txt';
                const filename = content.match(/([\w-]+\.\w+)/)?.[1] || `file.${extension}`;

                const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
                if (codeBlockMatch) {
                    const artifact = {
                        id: `artifact-${Date.now()}`,
                        type: 'file',
                        title: filename,
                        language: getLanguageFromExtension(extension),
                        content: codeBlockMatch[1].trim()
                    };
                    onArtifactCreate(artifact);
                    return;
                }
            }

            // Check for substantial code blocks (>20 lines)
            const codeBlocks = content.match(/```(\w+)?\n([\s\S]*?)```/g);
            if (codeBlocks) {
                for (let i = 0; i < codeBlocks.length; i++) {
                    const block = codeBlocks[i];
                    const match = block.match(/```(\w+)?\n([\s\S]*?)```/);
                    if (match && match[2].split('\n').length > 20) {
                        const language = match[1] || 'text';
                        const artifact = {
                            id: `artifact-${Date.now()}-${i}`,
                            type: 'code',
                            title: `${language} code`,
                            language: language,
                            content: match[2].trim()
                        };
                        onArtifactCreate(artifact);
                        return;
                    }
                }
            }
        }
    }, [content, role, onArtifactCreate]);

    const getLanguageFromExtension = (ext) => {
        const languageMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'css': 'css',
            'scss': 'scss',
            'html': 'html',
            'md': 'markdown',
            'json': 'json',
            'yaml': 'yaml',
            'yml': 'yaml',
            'sh': 'bash',
            'bash': 'bash'
        };
        return languageMap[ext.toLowerCase()] || ext;
    };

    if (role === 'user') {
        return (
            <div className="mb-8">
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 leading-relaxed">
                    {content}
                </div>
                {timestamp && (
                    <div className="text-xs text-gray-400 mt-2">{timestamp}</div>
                )}
            </div>
        );
    }

    if (role === 'system') {
        return (
            <div className="mb-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                        <span className="text-amber-600">⚠️</span>
                        <span className="text-amber-800 text-sm">{content}</span>
                    </div>
                </div>
            </div>
        );
    }

    // AI messages - Claude style with proper formatting
    return (
        <div className="mb-8">
            <div className="prose prose-gray max-w-none">
                {parts.map((part, index) => (
                    <div key={index}>
                        {part.type === 'code' ? (
                            <CodeBlock
                                code={part.content}
                                language={part.language}
                            />
                        ) : (
                            <div
                                className="text-gray-900 leading-relaxed text-[15px]"
                                dangerouslySetInnerHTML={{
                                    __html: formatText(part.content)
                                }}
                            />
                        )}
                    </div>
                ))}
                {timestamp && (
                    <div className="text-xs text-gray-400 mt-6 pt-3 border-t border-gray-100">{timestamp}</div>
                )}
            </div>
        </div>
    );
}