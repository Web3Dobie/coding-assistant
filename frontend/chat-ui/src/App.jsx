import React, { useState, useRef, useEffect } from "react";
import Message from "./components/Message";
import { sendMessage } from "./api/chat";

export default function App() {
  const [project, setProject] = useState("");
  const [repositories, setRepositories] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(true);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  // Load repositories on component mount
  useEffect(() => {
    const loadRepositories = async () => {
      try {
        setLoadingRepos(true);
        const response = await fetch(`${API_BASE_URL}/repositories`);

        if (response.ok) {
          const data = await response.json();
          setRepositories(data.repositories);

          // Set first repository as default if none selected
          if (data.repositories.length > 0 && !project) {
            setProject(data.repositories[0]);
          }
        } else {
          console.error("Failed to load repositories");
          // Fallback to hardcoded list
          const fallbackRepos = ["X-Agent", "DutchBrat-Website", "Coding-Assistant", "Hedgefund-Agent"];
          setRepositories(fallbackRepos);
          setProject(fallbackRepos[0]);
        }
      } catch (error) {
        console.error("Error loading repositories:", error);
        // Fallback to hardcoded list
        const fallbackRepos = ["X-Agent", "DutchBrat-Website", "Coding-Assistant", "Hedgefund-Agent"];
        setRepositories(fallbackRepos);
        setProject(fallbackRepos[0]);
      } finally {
        setLoadingRepos(false);
      }
    };

    loadRepositories();
  }, []);

  const getTimestamp = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Function to check reindex status (add this before the onCommand function)
  const checkReindexStatus = async (repoName, initialMessages, scanMessage, processMessage) => {
    // Poll every 3 seconds to check if reindexing is complete
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`${API_BASE_URL}/reindex-status?repo_name=${repoName}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.complete) {
            clearInterval(pollInterval);
            setMessages([...initialMessages,
              scanMessage,
              processMessage,
            { role: "system", content: `✅ Reindexing completed for ${repoName}! 🚀 Repository is now ready for queries.` }
            ]);
          }
          // If still processing, we keep polling
        }
      } catch (error) {
        // If status endpoint doesn't exist, just stop polling
        clearInterval(pollInterval);
      }
    }, 3000);

    // Stop polling after 2 minutes to avoid infinite polling
    setTimeout(() => clearInterval(pollInterval), 120000);
  };

  const onCommand = async (command) => {
    try {
      if (command.startsWith("/get-file")) {
        const [, filePath] = command.split(" ");
        const response = await fetch(`${API_BASE_URL}/get-file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: `/app/data/${filePath}` }),
        });

        if (!response.ok) {
          const error = await response.json();
          setMessages([...messages, { role: "system", content: `Error: ${error.detail}` }]);
        } else if (command === "/reindex-all") {
          // Command to reindex all repositories
          const initialMessages = [...messages, { role: "system", content: `🔄 Starting reindex for ALL repositories...` }];
          setMessages(initialMessages);

          setTimeout(() => {
            setMessages([...initialMessages, { role: "system", content: `📂 Scanning all repositories...` }]);

            setTimeout(async () => {
              setMessages([...initialMessages,
              { role: "system", content: `📂 Scanning all repositories...` },
              { role: "system", content: `⚡ Processing files and generating embeddings for all repositories...` }
              ]);

              try {
                const response = await fetch(`${API_BASE_URL}/reindex-all`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                });

                if (response.ok) {
                  const data = await response.json();
                  // Check if this is a background operation start vs completion
                  if (data.message && (data.message.includes('started') || data.message.includes('background'))) {
                    setMessages([...initialMessages,
                    { role: "system", content: `📂 Scanning all repositories...` },
                    { role: "system", content: `⚡ Processing files and generating embeddings for all repositories...` },
                    { role: "system", content: `🚀 Reindex started for all repositories! Check logs for completion status.` }
                    ]);
                  } else {
                    setMessages([...initialMessages,
                    { role: "system", content: `📂 Scanning all repositories...` },
                    { role: "system", content: `⚡ Processing files and generating embeddings for all repositories...` },
                    { role: "system", content: `✅ Successfully reindexed all repositories! ${data.message || '🚀 All repositories are now ready for queries.'}` }
                    ]);
                  }
                } else {
                  const error = await response.json();
                  setMessages([...initialMessages,
                  { role: "system", content: `📂 Scanning all repositories...` },
                  { role: "system", content: `⚡ Processing files and generating embeddings for all repositories...` },
                  { role: "system", content: `❌ Failed to reindex all repositories: ${error.detail || 'Unknown error occurred during indexing.'}` }
                  ]);
                }
              } catch (error) {
                setMessages([...initialMessages,
                { role: "system", content: `📂 Scanning all repositories...` },
                { role: "system", content: `⚡ Processing files and generating embeddings for all repositories...` },
                { role: "system", content: `❌ Network error while reindexing all repositories: ${error.message}` }
                ]);
              }
            }, 800);
          }, 500);
          const fileContent = await response.text();

          const openAIResponse = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              project: "Your Project Name",
              messages: [
                { role: "system", content: `You are a coding assistant. Use the following file content for context:\n\n${fileContent}` },
                { role: "user", content: "Please analyze this file." },
              ],
            }),
          });

          const openAIResult = await openAIResponse.json();
          setMessages([...messages, { role: "assistant", content: openAIResult.response }]);
        }
      } else if (command.startsWith("/list-files")) {
        const [, repoName] = command.split(" ");
        const response = await fetch(`${API_BASE_URL}/list-files?repo_name=${repoName}`);

        if (!response.ok) {
          const error = await response.json();
          setMessages([...messages, { role: "system", content: `Error: ${error.detail}` }]);
        } else {
          const data = await response.json();
          const fileList = data.files.join("\n");
          setMessages([...messages, { role: "system", content: `Files in ${repoName}:\n${fileList}` }]);
        }
      } else if (command === "/refresh-repos") {
        // Command to refresh repository list
        setLoadingRepos(true);
        const response = await fetch(`${API_BASE_URL}/repositories`);
        if (response.ok) {
          const data = await response.json();
          setRepositories(data.repositories);
          setMessages([...messages, { role: "system", content: `✅ Refreshed repository list. Found ${data.repositories.length} repositories.` }]);
        } else {
          setMessages([...messages, { role: "system", content: `❌ Failed to refresh repository list.` }]);
        }
        setLoadingRepos(false);
      } else if (command.startsWith("/reindex")) {
        // Command to reindex repositories with verbose feedback
        const parts = command.split(" ");
        const repoName = parts.slice(1).join(" "); // Handle repos with spaces in names

        if (!repoName) {
          // Use current project if no repo specified
          if (!project) {
            setMessages([...messages, { role: "system", content: `❌ No repository specified and no current project selected. Please select a project or use: /reindex [repo_name]` }]);
            return;
          }
          // Use current project
          const currentMessages = [...messages, { role: "system", content: `🔄 No repository specified, using current project: ${project}` }];
          setMessages(currentMessages);

          // Start reindexing current project
          setTimeout(async () => {
            setMessages([...currentMessages, { role: "system", content: `📂 Scanning repository: ${project}` }]);

            setTimeout(async () => {
              setMessages([...currentMessages,
              { role: "system", content: `📂 Scanning repository: ${project}` },
              { role: "system", content: `⚡ Processing files and generating embeddings...` }
              ]);

              try {
                console.log("🐛 DEBUG: Sending reindex request for current project:", project);
                const requestBody = { repo_name: project };
                console.log("🐛 DEBUG: Request body:", JSON.stringify(requestBody));

                const response = await fetch(`${API_BASE_URL}/reindex`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(requestBody),
                });

                if (response.ok) {
                  const data = await response.json();
                  setMessages([...currentMessages,
                  { role: "system", content: `📂 Scanning repository: ${project}` },
                  { role: "system", content: `⚡ Processing files and generating embeddings...` },
                  { role: "system", content: `✅ Successfully reindexed ${project}! ${data.message || '🚀 Repository is now ready for queries.'}` }
                  ]);
                } else {
                  const error = await response.json();
                  setMessages([...currentMessages,
                  { role: "system", content: `📂 Scanning repository: ${project}` },
                  { role: "system", content: `⚡ Processing files and generating embeddings...` },
                  { role: "system", content: `❌ Failed to reindex ${project}: ${error.detail || 'Unknown error occurred during indexing.'}` }
                  ]);
                }
              } catch (error) {
                setMessages([...currentMessages,
                { role: "system", content: `📂 Scanning repository: ${project}` },
                { role: "system", content: `⚡ Processing files and generating embeddings...` },
                { role: "system", content: `❌ Network error while reindexing ${project}: ${error.message}` }
                ]);
              }
            }, 800);
          }, 500);

          return;
        }

        // Reindex specified repository with verbose feedback
        const initialMessages = [...messages, { role: "system", content: `🔄 Starting reindex for repository: ${repoName}` }];
        setMessages(initialMessages);

        setTimeout(() => {
          setMessages([...initialMessages, { role: "system", content: `📂 Scanning repository: ${repoName}` }]);

          setTimeout(async () => {
            setMessages([...initialMessages,
            { role: "system", content: `📂 Scanning repository: ${repoName}` },
            { role: "system", content: `⚡ Processing files and generating embeddings...` }
            ]);

            try {
              const response = await fetch(`${API_BASE_URL}/reindex`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repo_name: repoName }),
              });

              if (response.ok) {
                const data = await response.json();
                // Check if this is a background operation start vs completion
                if (data.message && (data.message.includes('started') || data.message.includes('background'))) {
                  setMessages([...initialMessages,
                  { role: "system", content: `📂 Scanning repository: ${repoName}` },
                  { role: "system", content: `⚡ Processing files and generating embeddings...` },
                  { role: "system", content: `🚀 Reindex started for ${repoName}! Check logs for completion status.` }
                  ]);
                } else {
                  setMessages([...initialMessages,
                  { role: "system", content: `📂 Scanning repository: ${repoName}` },
                  { role: "system", content: `⚡ Processing files and generating embeddings...` },
                  { role: "system", content: `✅ Successfully reindexed ${repoName}! ${data.message || '🚀 Repository is now ready for queries.'}` }
                  ]);
                }
              } else {
                const error = await response.json();
                setMessages([...initialMessages,
                { role: "system", content: `📂 Scanning repository: ${repoName}` },
                { role: "system", content: `⚡ Processing files and generating embeddings...` },
                { role: "system", content: `❌ Failed to reindex ${repoName}: ${error.detail || 'Unknown error occurred during indexing.'}` }
                ]);
              }
            } catch (error) {
              setMessages([...initialMessages,
              { role: "system", content: `📂 Scanning repository: ${repoName}` },
              { role: "system", content: `⚡ Processing files and generating embeddings...` },
              { role: "system", content: `❌ Network error while reindexing ${repoName}: ${error.message}` }
              ]);
            }
          }, 800);
        }, 500);
      } else {
        setMessages([...messages, { role: "system", content: `Unknown command: ${command}` }]);
      }
    } catch (error) {
      setMessages([...messages, { role: "system", content: `Error executing command: ${error.message}` }]);
    }
    setInput("");
  };

  // Auto-resize textarea up to 10 lines (240px assuming 24px line height)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const maxHeight = 10 * 24;
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

    if (input.startsWith("/")) {
      await onCommand(input.trim());
    } else {
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
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-2xl h-[90vh] flex flex-col border rounded-xl shadow bg-white overflow-hidden">
        {/* Header with Project Selector */}
        <header className="p-4 border-b text-center bg-gray-100 flex items-center justify-between">
          <h1 className="text-lg font-semibold">💬 Chat Coding Assistant</h1>
          <div className="flex items-center gap-2">
            {loadingRepos ? (
              <div className="text-sm text-gray-500">Loading repositories...</div>
            ) : (
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                disabled={repositories.length === 0}
              >
                {repositories.length === 0 ? (
                  <option value="">No repositories found</option>
                ) : (
                  repositories.map((repo) => (
                    <option key={repo} value={repo}>
                      {repo}
                    </option>
                  ))
                )}
              </select>
            )}
            <button
              onClick={() => onCommand("/refresh-repos")}
              className="text-xs bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded text-blue-700"
              disabled={loadingRepos}
              title="Refresh repository list"
            >
              🔄
            </button>
          </div>
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
              placeholder={`Type your message... (Project: ${project || 'Loading...'})`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ lineHeight: "24px" }}
              disabled={!project}
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              disabled={!project}
            >
              Send
            </button>
          </form>
          <div className="text-xs text-gray-500 mt-1">
            Commands: /refresh-repos, /list-files [repo], /get-file [path]
          </div>
        </footer>
      </div>
    </div>
  );
}