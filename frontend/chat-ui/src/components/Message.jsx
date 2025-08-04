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

// Detect if content should create artifacts and where
const analyzeContentForArtifacts = (content) => {
    const artifacts = [];
    const parts = [];
    let currentIndex = 0;

    // Look for code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        const language = match[1] || 'text';
        const code = match[2].trim();
        const lineCount = code.split('\n').length;

        // Add text before this code block
        if (match.index > currentIndex) {
            parts.push({
                type: 'text',
                content: content.slice(currentIndex, match.index)
            });
        }

        // Determine if this should be an artifact (>10 lines or specific file patterns)
        const isLargeBlock = lineCount > 10;
        const isFileContent = /Here's.*?(?:file|updated|complete|full)/i.test(content.slice(Math.max(0, match.index - 100), match.index + 100));

        if (isLargeBlock || isFileContent) {
            // Create artifact
            const artifactId = `artifact-${Date.now()}-${artifacts.length}`;
            const artifact = {
                id: artifactId,
                type: 'code',
                title: detectArtifactTitle(content, match.index, language, lineCount),
                language: language,
                content: code,
                version: 1,
                createdAt: new Date().toISOString()
            };

            artifacts.push(artifact);

            // Add artifact card in place of code block
            parts.push({
                type: 'artifact_card',
                artifactId: artifactId,
                artifact: artifact
            });
        } else {
            // Keep small code block inline
            parts.push({
                type: 'code',
                language: language,
                content: code
            });
        }

        currentIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (currentIndex < content.length) {
        parts.push({
            type: 'text',
            content: content.slice(currentIndex)
        });
    }

    // If no code blocks found, check for file patterns
    if (artifacts.length === 0) {
        const filePatterns = [
            /Here's.*?(?:updated|complete|full|new).*?(?:file|implementation|solution)/i,
            /I've (?:created|updated|modified).*?(?:file|code|implementation)/i,
            /(?:Updated|Modified|Created).*?file/i
        ];

        for (const pattern of filePatterns) {
            if (pattern.test(content) && content.length > 800) {
                const artifactId = `artifact-${Date.now()}`;
                const artifact = {
                    id: artifactId,
                    type: 'document',
                    title: 'Generated Content',
                    language: 'markdown',
                    content: content,
                    version: 1,
                    createdAt: new Date().toISOString()
                };

                artifacts.push(artifact);

                // Replace content with summary + artifact card
                return {
                    artifacts,
                    parts: [
                        { type: 'text', content: content.split('\n')[0] + '...' },
                        { type: 'artifact_card', artifactId: artifactId, artifact: artifact }
                    ]
                };
            }
        }
    }

    return { artifacts, parts: parts.length > 0 ? parts : [{ type: 'text', content }] };
};

// Detect appropriate title for artifact
const detectArtifactTitle = (fullContent, codeIndex, language, lineCount) => {
    // Look for file references near the code block
    const contextBefore = fullContent.slice(Math.max(0, codeIndex - 200), codeIndex);
    const contextAfter = fullContent.slice(codeIndex, codeIndex + 200);

    // Check for file names
    const filePattern = /(?:file|named|called)\s+["`']?([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)["`']?/i;
    const fileMatch = (contextBefore + contextAfter).match(filePattern);
    if (fileMatch) {
        return fileMatch[1];
    }

    // Check for component names
    const componentPattern = /(?:component|class|function)\s+([A-Z][a-zA-Z0-9]+)/i;
    const componentMatch = (contextBefore + contextAfter).match(componentPattern);
    if (componentMatch) {
        return `${componentMatch[1]} Component`;
    }

    // Check for descriptive context
    const descriptionPatterns = [
        /(?:updated|modified|created|here's)\s+(?:the\s+)?([^.]+?)(?:\s+(?:file|code|implementation))?[:.]/i,
        /Here's\s+([^:]+):/i
    ];

    for (const pattern of descriptionPatterns) {
        const match = (contextBefore + contextAfter).match(pattern);
        if (match && match[1].length < 50) {
            return match[1].trim();
        }
    }

    // Default titles based on language and size
    if (lineCount > 50) {
        return `Large ${language} implementation`;
    } else if (lineCount > 20) {
        return `${language} code block`;
    } else {
        return `${language} snippet`;
    }
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
        <div className="my-3 rounded-lg overflow-hidden border border-gray-200">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-medium text-gray-600 uppercase">{language || 'code'}</span>
                <button
                    onClick={copyToClipboard}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
                >
                    {copied ? (
                        <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Copied
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

// Claude-style artifact card component
const ArtifactCard = ({ artifact, onViewArtifact, onUpdateArtifact }) => {
    const getArtifactIcon = () => {
        switch (artifact.language) {
            case 'javascript':
            case 'js':
            case 'jsx':
                return '🟨';
            case 'python':
            case 'py':
                return '🐍';
            case 'html':
                return '🌐';
            case 'css':
                return '🎨';
            case 'json':
                return '📋';
            case 'markdown':
            case 'md':
                return '📝';
            case 'bash':
            case 'shell':
                return '⚡';
            default:
                return '📄';
        }
    };

    const getLineCount = () => {
        return artifact.content.split('\n').length;
    };

    return (
        <div className="my-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-xl">{getArtifactIcon()}</div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                            {artifact.title}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{artifact.language}</span>
                            <span>•</span>
                            <span>{getLineCount()} lines</span>
                            {artifact.version > 1 && (
                                <>
                                    <span>•</span>
                                    <span>v{artifact.version}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onViewArtifact(artifact)}
                        className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors border border-blue-200"
                    >
                        View code
                    </button>
                    {onUpdateArtifact && (
                        <button
                            onClick={() => onUpdateArtifact(artifact)}
                            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors border border-gray-200"
                        >
                            Edit
                        </button>
                    )}
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

export default function Message({
    role,
    content,
    timestamp,
    messageIndex,
    artifactStore,
    onArtifactCreate,
    onArtifactView,
    onArtifactUpdate
}) {
    const [processedContent, setProcessedContent] = useState(null);

    // Process content when message loads or updates
    useEffect(() => {
        if (role === 'assistant') {
            const analysis = analyzeContentForArtifacts(content);

            // Store any new artifacts with intelligent versioning
            if (analysis.artifacts.length > 0 && onArtifactCreate) {
                analysis.artifacts.forEach(artifact => {
                    // Check for similar existing artifacts to determine if this should be a new version
                    const similarArtifact = artifactStore?.findSimilarArtifact(
                        artifact.content,
                        artifact.language,
                        0.6
                    );

                    if (similarArtifact && shouldCreateNewVersion(similarArtifact, artifact)) {
                        // Create new version of existing artifact
                        const newVersion = onArtifactCreate(artifact, messageIndex, similarArtifact.baseId);

                        // Update the artifact reference in parts
                        analysis.parts.forEach(part => {
                            if (part.type === 'artifact_card' && part.artifactId === artifact.id) {
                                part.artifact = newVersion;
                                part.artifactId = newVersion.id;
                            }
                        });
                    } else {
                        // Create new artifact
                        onArtifactCreate(artifact, messageIndex);
                    }
                });
            }

            setProcessedContent(analysis.parts);
        } else {
            setProcessedContent([{ type: 'text', content }]);
        }
    }, [content, role, messageIndex, onArtifactCreate, artifactStore]);

    // Determine if we should create a new version vs new artifact
    const shouldCreateNewVersion = (existingArtifact, newArtifact) => {
        // Create new version if:
        // 1. Same or similar language
        // 2. Similar title/filename
        // 3. Content has meaningful overlap but differences
        // 4. Same type (file vs code vs document)

        const languageMatch = existingArtifact.language === newArtifact.language;
        const titleSimilarity = calculateTitleSimilarity(existingArtifact.title, newArtifact.title);
        const typeMatch = existingArtifact.type === newArtifact.type;
        const contentSimilarity = artifactStore?.calculateSimilarity(
            existingArtifact.content,
            newArtifact.content
        ) || 0;

        return languageMatch &&
            titleSimilarity > 0.5 &&
            typeMatch &&
            contentSimilarity > 0.3 &&
            contentSimilarity < 0.95; // Not identical, but similar
    };

    // Calculate title similarity
    const calculateTitleSimilarity = (title1, title2) => {
        const words1 = title1.toLowerCase().split(/\s+/);
        const words2 = title2.toLowerCase().split(/\s+/);
        const intersection = words1.filter(word => words2.includes(word));
        const union = [...new Set([...words1, ...words2])];
        return intersection.length / union.length;
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

    // AI messages with Claude-style artifact handling
    return (
        <div className="mb-6">
            <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    AI
                </div>
                <div className="flex-1 pt-1 min-w-0">
                    {processedContent?.map((part, index) => (
                        <div key={index}>
                            {part.type === 'code' ? (
                                <CodeBlock
                                    code={part.content}
                                    language={part.language}
                                />
                            ) : part.type === 'artifact_card' ? (
                                <ArtifactCard
                                    artifact={part.artifact}
                                    onViewArtifact={onArtifactView}
                                    onUpdateArtifact={onArtifactUpdate}
                                />
                            ) : part.content ? (
                                <div
                                    className="text-gray-900 leading-relaxed break-words mb-2"
                                    dangerouslySetInnerHTML={{
                                        __html: formatText(part.content.trim())
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