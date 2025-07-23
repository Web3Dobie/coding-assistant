import React, { useState, useRef, useEffect } from "react";
import Message from "./components/Message";
import { sendMessage } from "./api/chat";

export default function App() {
  const [project, setProject] = useState("X-Agent");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  const getTimestamp = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Auto-resize textarea up to 10 lines (240px assuming 24px line height)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // reset height
      const maxHeight = 10 * 24; // 10 lines * 24px line height
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        maxHeight
      )}px`;
      textareaRef.current.style.overflowY =
        textareaRef.current.scrollHeight > maxHeight ? "auto" : "hidden";
    }
  }, [input]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = {
      role: "user",
      content: input.trim(),
      timestamp: getTimestamp(),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");

    try {
      const assistantReply = await sendMessage(project, newMessages);
      const assistantMessage = {
        role: "assistant",
        content: assistantReply,
        timestamp: getTimestamp(),
      };
      setMessages([...newMessages, assistantMessage]);
    } catch (error) {
      setMessages([
        ...newMessages,
        {
          role: "system",
          content: "⚠️ Error: Unable to reach backend.",
          timestamp: getTimestamp(),
        },
      ]);
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-2xl h-[90vh] flex flex-col border rounded-xl shadow bg-white overflow-hidden">
        {/* Header */}
        <header className="p-4 border-b text-center text-lg font-semibold bg-gray-100">
          💬 Chat Coding Assistant
        </header>

        {/* Message List */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <Message
              key={idx}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          ))}
          <div ref={messagesEndRef} />
        </main>

        {/* Input Form */}
        <footer className="p-4 border-t bg-white">
          <form onSubmit={handleSubmit} className="flex gap-2 w-full">
            <textarea
              ref={textareaRef}
              rows={1}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md resize-none"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ lineHeight: "24px" }}
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Send
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
