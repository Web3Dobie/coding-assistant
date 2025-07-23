// frontend/src/App.jsx
import React, { useState } from 'react';

function App() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const sendMessage = async () => {
        if (!input.trim()) return;
        const userMsg = { role: "user", content: input };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);
        setInput("");

        try {
            const res = await fetch("http://localhost:8000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: input })
            });
            const data = await res.json();
            const botMsg = { role: "assistant", content: data.response };
            setMessages((prev) => [...prev, botMsg]);
        } catch (err) {
            setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error getting response." }]);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-3xl mx-auto bg-white shadow rounded-lg p-6">
                <h1 className="text-xl font-bold mb-4">💬 Code Chat Assistant</h1>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {messages.map((msg, i) => (
                        <div key={i} className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-100 self-end' : 'bg-gray-200'}`}>
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                        </div>
                    ))}
                    {loading && <div className="text-sm text-gray-400">GPT is thinking...</div>}
                </div>
                <div className="mt-4 flex gap-2">
                    <input
                        type="text"
                        className="flex-1 border border-gray-300 rounded px-3 py-2"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Ask about your code..."
                    />
                    <button
                        onClick={sendMessage}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}

export default App;
