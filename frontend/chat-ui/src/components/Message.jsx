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
            if (content.length > 800) {
                return true;
            }
        }
    }

    // Check for large code blocks only (>8 lines)
    const codeBlocks = content.match(/```(\w+)?\n([\s\S]*?)```/g);
    if (codeBlocks) {
        for (let i = 0; i < codeBlocks.length; i++) {
            const block = codeBlocks[i];
            const match = block.match(/```(\w+)?\n([\s\S]*?)```/);
            if (match && match[2].split('\n').length > 8) {
                return true;
            }
        }
    }

    return false;
};

// Process message content and keep small code blocks in conversation
const processMessageContent = (content, hasArtifact = false) => {
    if (hasArtifact) {
        // For README and other file artifacts, show only a brief intro
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

        // Check if this is a file artifact
        let isFileArtifact = false;
        for (const pattern of filePatterns) {
            if (content.match(pattern)) {
                isFileArtifact = true;
                break;
            }
        }

        if (isFileArtifact) {
            // Extract just the intro text (first paragraph or sentence)
            const introMatch = content.match(/^(.*?(?:\n\n|$))/);
            const introText = introMatch ? introMatch[1].trim() : "Generated content";

            return [{
                type: 'text',
                content: introText
            }, {
                type: 'artifact_reference',
                content: ''
            }];
        }

        // For code artifacts, keep explanatory text and small code blocks
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        const parts = [];
        let lastIndex = 0;
        let match;
        let hasLargeCodeBlock = false;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            const lineCount = match[2].split('\n').length;

            // Add text before code block
            if (match.index > lastIndex) {
                parts.push({
                    type: 'text',
                    content: content.slice(lastIndex, match.index)
                });
            }

            // Keep small code blocks (<=10 lines) in conversation
            if (lineCount <= 10) {
                parts.push({
                    type: 'code',
                    language: match[1] || 'text',
                    content: match[2].trim()
                });
            } else {
                hasLargeCodeBlock = true;
                // Replace large code blocks with reference
                parts.push({
                    type: 'text',
                    content: `\n*[Large ${match[1] || 'code'} block moved to artifact panel]*\n`
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

        // Add artifact reference if we had large code blocks
        if (hasLargeCodeBlock) {
            parts.push({
                type: 'artifact_reference',
                content: ''
            });
        }

        return parts.length > 0 ? parts : [{ type: 'text', content }];
    }

    // For non-artifact messages, process normally
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

        // Include all code blocks for non-artifact messages
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

// Small code block component for inline display
const CodeBlock = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        // Copy the clean code without HTML tags
        const cleanCode = code.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        navigator.clipboard.writeText(cleanCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Clean the code first, then apply highlighting
    const cleanCode = code
        .replace(/#[a-fA-F0-9]{6};">/g, '') // Remove color hex codes
        .replace(/<span[^>]*color:[^>]*>/g, '') // Remove color spans
        .replace(/<\/span>/g, '') // Remove closing spans
        .replace(/;\s*color:\s*#[a-fA-F0-9]{6};\s*font-weight:\s*bold;?/g, ''); // Remove CSS

    const highlightedCode = highlightCode(cleanCode, language);

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
                    lineHeight: '1.4'
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
const ArtifactCard = ({ onViewArtifact, artifact }) => {
    return (
        <div className="my-4 p-3 bg-blue-50 border border-blue-200 rounded-md cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={onViewArtifact}>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center text-white text-sm">
                    {artifact?.type === 'file' ? '📄' : '⚡'}
                </div>
                <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900">
                        {artifact?.title || 'Generated Content'}
                    </div>
                    <div className="text-xs text-blue-600">View in side panel →</div>
                </div>
            </div>
        </div>
    );
};

// Format regular text with minimal styling - clean up broken HTML
const formatText = (text) => {
    // First, clean up any broken HTML color codes that appear in plain text
    let cleanText = text
        .replace(/#[a-fA-F0-9]{6};">/g, '') // Remove color hex codes with ;">
        .replace(/<span[^>]*color:[^>]*>/g, '') // Remove opening color spans
        .replace(/<\/span>/g, '') // Remove closing spans
        .replace(/`#[a-fA-F0-9]{6};">```/g, '```') // Fix broken code block markers
        .replace(/`#[a-fA-F0-9]{6};">`/g, '`') // Fix broken inline code markers
        .replace(/#[a-fA-F0-9]{6};">/g, '') // Remove any remaining color codes
        .replace(/;\s*color:\s*#[a-fA-F0-9]{6};\s*font-weight:\s*bold;?/g, '') // Remove CSS properties
        .replace(/color:\s*#[a-fA-F0-9]{6};\s*font-weight:\s*bold;?\s*">/g, '') // Remove more CSS
        .replace(/color:\s*#[a-fA-F0-9]{6};\s*">/g, '') // Remove color CSS
        .replace(/font-weight:\s*bold;\s*">/g, '') // Remove font-weight CSS
        .replace(/"/g, '"') // Fix smart quotes
        .replace(/"/g, '"') // Fix smart quotes
        .replace(/\*\[Large.*?block moved to artifact panel\]\*/g, ''); // Remove placeholder text

    return cleanText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
        .replace(/`([^`]+\.(js|jsx|ts|tsx|py|css|html|json|md|txt|yml|yaml|env|gitignore|dockerfile))`/gi, '<code class="bg-red-100 text-red-800 px-1 rounded text-sm font-mono">$1</code>')
        .replace(/`(\/[a-zA-Z-]+(?:\s+[^`]*)?)`/g, '<code class="bg-blue-100 text-blue-800 px-1 rounded text-sm font-mono">$1</code>')
        .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-1 rounded text-sm font-mono">$1</code>')
        .replace(/\n/g, '<br>');
};

export default function Message({ role, content, timestamp, onArtifactCreate, onArtifactView }) {
    const [createdArtifact, setCreatedArtifact] = useState(null);

    // Check if this message should create an artifact
    const hasArtifact = role === 'assistant' ? shouldCreateArtifact(content) : false;
    const parts = processMessageContent(content, hasArtifact);

    // Create artifact when needed
    useEffect(() => {
        if (role === 'assistant' && onArtifactCreate && hasArtifact) {
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
                    break;
                }
            }

            if (fileMatch && filename) {
                const extension = filename.split('.').pop() || 'txt';

                // For README files, extract the actual file content
                let artifactContent = content;

                // Try to extract content between --- markers or after ":" 
                const contentAfterColon = content.match(/.*?:\s*\n\n([\s\S]*?)(?:\n\n(?:Let me know|Feel free|If you|Would you like|Please let me know).*|$)/i);
                if (contentAfterColon) {
                    artifactContent = contentAfterColon[1].trim();
                } else {
                    // Try to extract content after the intro paragraph
                    const contentAfterIntro = content.match(/.*?(?:context|structure):\s*\n\n([\s\S]*?)(?:\n\n(?:Let me know|Feel free|If you|Would you like|Please let me know).*|$)/i);
                    if (contentAfterIntro) {
                        artifactContent = contentAfterIntro[1].trim();
                    } else {
                        // Try to extract content between --- markers
                        const contentBetweenDashes = content.match(/---\s*\n\n([\s\S]*?)(?:\n\n(?:Let me know|Feel free|If you|Would you like|Please let me know).*|$)/i);
                        if (contentBetweenDashes) {
                            artifactContent = contentBetweenDashes[1].trim();
                        } else {
                            // Fallback: look for markdown content starting with #
                            const markdownMatch = content.match(/(^|\n)(# .+[\s\S]*?)(?:\n\n(?:Let me know|Feel free|If you|Would you like|Please let me know).*|$)/i);
                            if (markdownMatch) {
                                artifactContent = markdownMatch[2].trim();
                            } else {
                                // Last resort: remove ending manually
                                artifactContent = content.replace(/\n\n(?:Let me know|Feel free|If you|Would you like|Please let me know).*$/i, '').trim();
                            }
                        }
                    }
                }

                const artifact = {
                    id: `artifact-${Date.now()}`,
                    type: 'file',
                    title: filename,
                    language: getLanguageFromExtension(extension),
                    content: artifactContent
                };
                setCreatedArtifact(artifact);
                onArtifactCreate(artifact);
                return;
            }

            // Check for substantial code blocks or multiple blocks
            const codeBlocks = content.match(/```(\w+)?\n([\s\S]*?)```/g);
            if (codeBlocks) {
                // Only include LARGE blocks (>8 lines) in artifacts
                let largeBlocks = [];

                for (let i = 0; i < codeBlocks.length; i++) {
                    const block = codeBlocks[i];
                    const match = block.match(/```(\w+)?\n([\s\S]*?)```/);
                    if (match) {
                        const lineCount = match[2].split('\n').length;
                        const language = match[1] || 'text';

                        // Only include blocks with >8 lines in artifact
                        if (lineCount > 8) {
                            largeBlocks.push({
                                language: language,
                                content: match[2].trim(),
                                lines: lineCount
                            });
                        }
                    }
                }

                if (largeBlocks.length > 0) {
                    // Create artifact with only large code blocks
                    let combinedContent;
                    let title;
                    let language;

                    if (largeBlocks.length === 1) {
                        // Single large block
                        combinedContent = largeBlocks[0].content;
                        title = `${largeBlocks[0].language} code (${largeBlocks[0].lines} lines)`;
                        language = largeBlocks[0].language;
                    } else {
                        // Multiple large blocks - combine them with separators
                        combinedContent = largeBlocks.map((block, idx) => {
                            const separator = idx === 0 ? '' : `\n\n# ===== ${block.language.toUpperCase()} BLOCK ${idx + 1} =====\n\n`;
                            return separator + block.content;
                        }).join('');

                        title = `Multiple code blocks (${largeBlocks.length} large blocks)`;
                        language = largeBlocks[0].language; // Use first language for syntax highlighting
                    }

                    const artifact = {
                        id: `artifact-${Date.now()}`,
                        type: 'code',
                        title: title,
                        language: language,
                        content: combinedContent
                    };
                    setCreatedArtifact(artifact);
                    onArtifactCreate(artifact);
                    return;
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
        if (createdArtifact) {
            if (onArtifactView) {
                onArtifactView(createdArtifact.id);
            } else if (onArtifactCreate) {
                onArtifactCreate(createdArtifact);
            }
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
                                <ArtifactCard
                                    onViewArtifact={handleViewArtifact}
                                    artifact={createdArtifact}
                                />
                            ) : part.type === 'artifact_reference_inline' ? (
                                <ArtifactCard
                                    onViewArtifact={handleViewArtifact}
                                    artifact={createdArtifact}
                                />
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