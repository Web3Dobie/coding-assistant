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

// Enhanced code highlighting with VS Code theme
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

// Check if content should create an artifact
const shouldCreateArtifact = (content) => {
    console.log("🔍 DEBUG: Checking content for artifact:", content.substring(0, 100) + "...");

    // Check for complete files with more flexible patterns
    const fileHeaderPatterns = [
        /Here's a draft for the ([\w-]+\.[\w]+)/i,
        /Below is a draft.*?for the ([\w-]+\.[\w]+)/i,
        /Here's a detailed.*?([\w-]+\.[\w]+)/i,
        /Here's the.*?([\w-]+\.[\w]+)/i,
        /Here's your.*?([\w-]+\.[\w]+)/i,
        /draft.*?for the ([\w-]+\.[\w]+)/i,
        /README\.md.*?file/i,
        /for the.*?([\w-]+\.[\w]+).*?project/i,
        /draft.*?README\.md/i
    ];

    for (const pattern of fileHeaderPatterns) {
        const fileMatch = content.match(pattern);
        if (fileMatch) {
            console.log("🔍 DEBUG: File pattern matched:", pattern, fileMatch[1] || "README.md");
            const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
            if (codeBlockMatch || content.length > 500) {
                console.log("🔍 DEBUG: Should create artifact - code block or long content");
                return true;
            }
        }
    }

    // Check for substantial code blocks (>20 lines)
    const codeBlocks = content.match(/```(\w+)?\n([\s\S]*?)```/g);
    if (codeBlocks) {
        for (let i = 0; i < codeBlocks.length; i++) {
            const block = codeBlocks[i];
            const match = block.match(/```(\w+)?\n([\s\S]*?)```/);
            if (match && match[2].split('\n').length > 20) {
                console.log("🔍 DEBUG: Large code block found:", match[2].split('\n').length, "lines");
                return true;
            }
        }
    }

    // Check for long content that would benefit from artifact view
    if (content.length > 800 && (content.includes('```') || content.includes('#') || content.includes('##'))) {
        console.log("🔍 DEBUG: Long content with markdown detected:", content.length, "chars");
        return true;
    }

    console.log("🔍 DEBUG: No artifact criteria met");
    return false;
};

// Process message content and completely remove artifact code blocks
const processMessageContent = (content, hasArtifact = false) => {
    if (hasArtifact) {
        // Remove ALL code blocks from artifact messages - don't show them in conversation
        let processedContent = content;

        // Remove code blocks completely
        processedContent = processedContent.replace(/```[\w]*\n[\s\S]*?```/g, '');

        // Clean up extra newlines
        processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
        processedContent = processedContent.trim();

        return [{
            type: 'text',
            content: processedContent
        }, {
            type: 'artifact_reference',
            content: ''  // Just show the card, no text
        }];
    }

    // For non-artifact messages, process normally but only show small code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        const lineCount = match[2].split('\n').length;

        // Add text before code block
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: content.slice(lastIndex, match.index)
            });
        }

        // Only include small code blocks (<=10 lines)
        if (lineCount <= 10) {
            parts.push({
                type: 'code',
                language: match[1] || 'text',
                content: match[2].trim()
            });
        }

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

// Small code block component for inline display
const CodeBlock = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const highlightedCode = highlightCode(code, language);

    return (
        <div className="my-3 rounded-md overflow-hidden bg-gray-50">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-100 text-xs">
                <span className="font-medium text-gray-600">{language || 'code'}</span>
                <button
                    onClick={copyToClipboard}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                    {copied ? '✓' : 'Copy'}
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

// Artifact reference card component
const ArtifactCard = ({ onViewArtifact }) => {
    return (
        <div className="my-4 p-3 bg-blue-50 border border-blue-200 rounded-md cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={onViewArtifact}>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center text-white text-sm">
                    📄
                </div>
                <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900">Generated Content</div>
                    <div className="text-xs text-blue-600">View in side panel →</div>
                </div>
            </div>
        </div>
    );
};

// Format regular text with minimal styling
const formatText = (text) => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
        .replace(/`([^`]+\.(js|jsx|ts|tsx|py|css|html|json|md|txt|yml|yaml|env|gitignore|dockerfile))`/gi, '<code class="bg-red-100 text-red-800 px-1 rounded text-sm font-mono">$1</code>')
        .replace(/`(\/[a-zA-Z-]+(?:\s+[^`]*)?)`/g, '<code class="bg-blue-100 text-blue-800 px-1 rounded text-sm font-mono">$1</code>')
        .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-1 rounded text-sm font-mono">$1</code>')
        .replace(/\n/g, '<br>');
};

export default function Message({ role, content, timestamp, onArtifactCreate }) {
    const [createdArtifact, setCreatedArtifact] = useState(null);

    // Check if this message should create an artifact
    const hasArtifact = shouldCreateArtifact(content);
    const parts = processMessageContent(content, hasArtifact);

    // Create artifact when needed
    useEffect(() => {
        console.log("🔍 DEBUG: useEffect - role:", role, "hasArtifact:", hasArtifact, "content length:", content.length);

        if (role === 'assistant' && onArtifactCreate && hasArtifact) {
            console.log("🔍 DEBUG: Creating artifact...");

            // Check for file references with flexible patterns
            const filePatterns = [
                /Here's a draft for the ([\w-]+\.[\w]+)/i,
                /Below is a draft.*?for the ([\w-]+\.[\w]+)/i,
                /Here's a detailed.*?([\w-]+\.[\w]+)/i,
                /Here's the.*?([\w-]+\.[\w]+)/i,
                /Here's your.*?([\w-]+\.[\w]+)/i,
                /draft.*?for the ([\w-]+\.[\w]+)/i,
                /README\.md.*?file/i,
                /for the.*?([\w-]+\.[\w]+).*?project/i,
                /draft.*?README\.md/i
            ];

            let fileMatch = null;
            let filename = null;

            for (const pattern of filePatterns) {
                fileMatch = content.match(pattern);
                if (fileMatch) {
                    filename = fileMatch[1] || 'README.md';
                    console.log("🔍 DEBUG: Found filename:", filename);
                    break;
                }
            }

            if (fileMatch && filename) {
                const extension = filename.split('.').pop() || 'txt';

                // For README or long content, create artifact even without code blocks
                const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
                const artifactContent = codeBlockMatch ? codeBlockMatch[1].trim() : content;

                const artifact = {
                    id: `artifact-${Date.now()}`,
                    type: 'file',
                    title: filename,
                    language: getLanguageFromExtension(extension),
                    content: artifactContent
                };
                console.log("🔍 DEBUG: Creating file artifact:", artifact.title, "content length:", artifact.content.length);
                setCreatedArtifact(artifact);
                onArtifactCreate(artifact);
                return;
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
                        console.log("🔍 DEBUG: Creating code artifact:", artifact.title);
                        setCreatedArtifact(artifact);
                        onArtifactCreate(artifact);
                        return;
                    }
                }
            }

            // Long content without code blocks
            if (content.length > 800) {
                const artifact = {
                    id: `artifact-${Date.now()}`,
                    type: 'document',
                    title: 'Generated Content',
                    language: 'markdown',
                    content: content
                };
                console.log("🔍 DEBUG: Creating document artifact for long content");
                setCreatedArtifact(artifact);
                onArtifactCreate(artifact);
            }
        }
    }, [content, role, onArtifactCreate, hasArtifact]);

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

    const handleViewArtifact = () => {
        if (createdArtifact && onArtifactCreate) {
            onArtifactCreate(createdArtifact);
        }
    };

    if (role === 'user') {
        return (
            <div className="mb-6">
                <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                        U
                    </div>
                    <div className="flex-1 pt-1 min-w-0">
                        <div className="text-gray-900 leading-relaxed break-words">
                            {content}
                        </div>
                        {timestamp && (
                            <div className="text-xs text-gray-400 mt-2">{timestamp}</div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (role === 'system') {
        return (
            <div className="mb-4">
                <div className="text-sm bg-blue-50 px-4 py-3 rounded-md border-l-4 border-blue-400">
                    <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800 overflow-x-auto">
                        {content}
                    </pre>
                </div>
            </div>
        );
    }

    // AI messages - clean style
    return (
        <div className="mb-6">
            <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    AI
                </div>
                <div className="flex-1 pt-1 min-w-0">
                    {parts.map((part, index) => (
                        <div key={index}>
                            {part.type === 'code' ? (
                                <CodeBlock
                                    code={part.content}
                                    language={part.language}
                                />
                            ) : part.type === 'artifact_reference' ? (
                                <ArtifactCard onViewArtifact={handleViewArtifact} />
                            ) : part.content ? (
                                <div
                                    className="text-gray-900 leading-relaxed break-words"
                                    dangerouslySetInnerHTML={{
                                        __html: formatText(part.content)
                                    }}
                                />
                            ) : null}
                        </div>
                    ))}
                    {timestamp && (
                        <div className="text-xs text-gray-400 mt-3">{timestamp}</div>
                    )}
                </div>
            </div>
        </div>
    );
}