import React, { useState, useEffect, useRef, useCallback } from "react";

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

// Simple code display without syntax highlighting to avoid HTML entity issues
const highlightCode = (code) => {
    // Just return the plain code - no highlighting to avoid HTML issues
    return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
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

    // If no code blocks found, return simple text
    return { artifacts, parts: parts.length > 0 ? parts : [{ type: 'text', content }] };
};

// Detect appropriate title for artifact - SIMPLIFIED
const detectArtifactTitle = (fullContent, codeIndex, language, lineCount) => {
    // Look for context around the code block
    const contextStart = Math.max(0, codeIndex - 200);
    const contextEnd = Math.min(fullContent.length, codeIndex + 200);
    const context = fullContent.slice(contextStart, contextEnd);

    // Simple filename detection
    const simpleFilePattern = /\b([a-zA-Z0-9_.-]+\.(py|js|jsx|ts|tsx|html|css|json|md|txt|yml|yaml))\b/i;
    const fileMatch = context.match(simpleFilePattern);
    if (fileMatch) {
        return fileMatch[1];
    }

    // Look for "main.py" or similar
    if (context.includes('main.py')) return 'main.py';
    if (context.includes('app.py')) return 'app.py';
    if (context.includes('index.js')) return 'index.js';
    if (context.includes('App.jsx')) return 'App.jsx';

    // Look for function names
    const functionPattern = /\b(def|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i;
    const funcMatch = context.match(functionPattern);
    if (funcMatch) {
        return `${funcMatch[2]} function`;
    }

    // Default titles
    if (lineCount > 50) {
        return `${language} implementation`;
    } else if (lineCount > 20) {
        return `${language} code`;
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

    const highlightedCode = highlightCode(code);

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

// Claude-style artifact card component - IMPROVED LAYOUT
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

    // Better title display - prioritize filenames
    const getDisplayTitle = () => {
        const title = artifact.title;

        // If title looks like a filename, make it prominent
        if (title.includes('.')) {
            return title;
        }

        // Otherwise return as-is
        return title;
    };

    const isFilename = artifact.title.includes('.');

    return (
        <div className="my-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-xl">{getArtifactIcon()}</div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                            {isFilename ? (
                                <code className="bg-gray-100 text-gray-900 px-2 py-1 rounded font-mono text-sm">
                                    {getDisplayTitle()}
                                </code>
                            ) : (
                                getDisplayTitle()
                            )}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                            <span className="font-medium">{artifact.language}</span>
                            <span>•</span>
                            <span>{getLineCount()} lines</span>
                            {artifact.version > 1 && (
                                <>
                                    <span>•</span>
                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                        v{artifact.version}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onViewArtifact(artifact)}
                        className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors border border-blue-200 font-medium"
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

// Simple text formatting without complex regex
const formatText = (text) => {
    try {
        if (!text || typeof text !== 'string') {
            return '';
        }

        // Simple and safe text formatting
        return text
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-1 rounded text-sm font-mono">$1</code>')
            .replace(/\n/g, '<br>');
    } catch (error) {
        console.warn('Error formatting text:', error);
        return text.replace(/\n/g, '<br>');
    }
};

export default function Message({
    role,
    content,
    timestamp,
    messageIndex,
    artifactStore,
    onArtifactCreate,
    onArtifactView,
    onArtifactUpdate,
    artifacts // New prop for artifact_list messages
}) {
    const [processedContent, setProcessedContent] = useState(null);
    const hasProcessedRef = useRef(false);

    // Simple similarity calculation
    const calculateTitleSimilarity = useCallback((title1, title2) => {
        const words1 = title1.toLowerCase().split(/\s+/);
        const words2 = title2.toLowerCase().split(/\s+/);
        const intersection = words1.filter(word => words2.includes(word));
        const union = [...new Set([...words1, ...words2])];
        return intersection.length / union.length;
    }, []);

    // Determine if we should create a new version vs new artifact
    const shouldCreateNewVersion = useCallback((existingArtifact, newArtifact) => {
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
            contentSimilarity < 0.95;
    }, [artifactStore, calculateTitleSimilarity]);

    // Process content when message loads - FIXED: Only runs once per message
    useEffect(() => {
        try {
            // Only process assistant messages and only if not already processed
            if (role === 'assistant' && !hasProcessedRef.current) {
                hasProcessedRef.current = true;

                const analysis = analyzeContentForArtifacts(content);

                // Store any new artifacts with intelligent versioning
                if (analysis.artifacts.length > 0 && onArtifactCreate) {
                    analysis.artifacts.forEach(artifact => {
                        try {
                            // Check for similar existing artifacts
                            const similarArtifact = artifactStore?.findSimilarArtifact(
                                artifact.content,
                                artifact.language,
                                0.6
                            );

                            if (similarArtifact && shouldCreateNewVersion(similarArtifact, artifact)) {
                                // Create new version of existing artifact
                                const newVersion = onArtifactCreate(artifact, messageIndex, similarArtifact.baseId);

                                // Update the artifact reference in parts
                                if (newVersion) {
                                    analysis.parts.forEach(part => {
                                        if (part.type === 'artifact_card' && part.artifactId === artifact.id) {
                                            part.artifact = newVersion;
                                            part.artifactId = newVersion.id;
                                        }
                                    });
                                }
                            } else {
                                // Create new artifact
                                onArtifactCreate(artifact, messageIndex);
                            }
                        } catch (artifactError) {
                            console.warn('Error processing artifact:', artifactError);
                        }
                    });
                }

                setProcessedContent(analysis.parts);
            } else if (role !== 'assistant') {
                // For user and system messages, just set text content
                setProcessedContent([{ type: 'text', content }]);
            }
        } catch (error) {
            console.error('Error processing message content:', error);
            // Fallback to simple text display
            setProcessedContent([{ type: 'text', content }]);
        }
    }, [content, role, messageIndex]); // FIXED: Removed callback dependencies that cause infinite loops

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

    // NEW: Handle artifact_list role with clickable artifact cards
    if (role === 'artifact_list') {
        return (
            <div className="mb-6">
                <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                        AI
                    </div>
                    <div className="flex-1 pt-1 min-w-0">
                        <div className="text-sm bg-blue-50 px-4 py-3 rounded-md border-l-4 border-blue-400 mb-4">
                            <div
                                className="font-medium text-blue-900"
                                dangerouslySetInnerHTML={{ __html: formatText(content) }}
                            />
                        </div>

                        {/* Render clickable artifact cards */}
                        <div className="space-y-3">
                            {(artifacts || []).map((artifact) => (
                                <ArtifactCard
                                    key={artifact.id}
                                    artifact={artifact}
                                    onViewArtifact={onArtifactView}
                                    onUpdateArtifact={onArtifactUpdate}
                                />
                            ))}
                        </div>

                        {timestamp && (
                            <div className="text-xs text-gray-400 mt-3">{timestamp}</div>
                        )}
                    </div>
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
                    {processedContent && processedContent.length > 0 ? (
                        processedContent.map((part, index) => (
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
                        ))
                    ) : (
                        // Fallback display if processedContent is null/empty
                        <div
                            className="text-gray-900 leading-relaxed break-words mb-2"
                            dangerouslySetInnerHTML={{
                                __html: formatText(content)
                            }}
                        />
                    )}
                    {timestamp && (
                        <div className="text-xs text-gray-400 mt-3">{timestamp}</div>
                    )}
                </div>
            </div>
        </div>
    );
}