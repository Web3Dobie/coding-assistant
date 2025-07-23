import React from "react";

export default function Message({ role, content, timestamp }) {
    const isUser = role === "user";
    const isAssistant = role === "assistant";
    const isSystem = role === "system";

    const bubbleStyle = isUser
        ? "bg-blue-600 text-white"
        : isAssistant
            ? "bg-gray-100 text-black"
            : "bg-yellow-100 text-black";

    const renderContent = (text) => {
        // Format code blocks
        const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let parts = [];
        let lastIndex = 0;
        let match;

        while ((match = codeRegex.exec(text)) !== null) {
            const [fullMatch, lang, code] = match;
            const index = match.index;

            if (index > lastIndex) {
                parts.push(<p key={lastIndex}>{text.slice(lastIndex, index)}</p>);
            }

            parts.push(
                <pre
                    key={index}
                    className="bg-black text-green-300 rounded p-3 overflow-x-auto my-2"
                >
                    <code>{code}</code>
                </pre>
            );

            lastIndex = index + fullMatch.length;
        }

        if (lastIndex < text.length) {
            parts.push(<p key={lastIndex}>{text.slice(lastIndex)}</p>);
        }

        return parts;
    };

    return (
        <div className="mb-2">
            <div className="flex items-start">
                <div
                    className={`rounded-xl px-4 py-2 max-w-3xl text-sm whitespace-pre-wrap ${bubbleStyle}`}
                >
                    <div className="mb-1 text-xs opacity-60">
                        {role.toUpperCase()} — {timestamp}
                    </div>
                    {renderContent(content)}
                </div>
            </div>
        </div>
    );
}
