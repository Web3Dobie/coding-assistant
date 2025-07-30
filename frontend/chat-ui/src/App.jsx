import React, { useState, useRef, useEffect } from "react";
import Message from "./components/Message";
import { sendMessage } from "./api/chat";

export default function App() {
  const [project, setProject] = useState("");
  const [repositories, setRepositories] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState([]);

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

  const onCommand = async (command) => {
    try {
      if (command.startsWith("/attach-file")) {
        const [, ...filePathParts] = command.split(" ");
        const filePath = filePathParts.join(" ");

        if (!filePath) {
          setMessages([...messages, { role: "system", content: `❌ Please specify a file path. Usage: /attach-file [repo]/[file_path]\nExample: /attach-file Trading-Bot/main.py` }]);
          return;
        }

        // Check if path includes repo name (contains /)
        if (!filePath.includes('/')) {
          setMessages([...messages, { role: "system", content: `❌ File path must include repository name. Usage: /attach-file [repo]/[file_path]\nExample: /attach-file Trading-Bot/main.py` }]);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/get-file?file_path=${encodeURIComponent(filePath)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const error = await response.json();
          setMessages([...messages, { role: "system", content: `Error: ${error.detail || JSON.stringify(error)}` }]);
        } else {
          const data = await response.json();

          // Check if file is already attached
          if (attachedFiles.some(f => f.path === data.file_path)) {
            setMessages([...messages, { role: "system", content: `⚠️ File ${data.file_path} is already attached.` }]);
            return;
          }

          // Add to attached files list
          const newAttachment = {
            path: data.file_path,
            content: data.content,
            attachedAt: new Date().toISOString()
          };

          setAttachedFiles(prev => [...prev, newAttachment]);
          setMessages([...messages, {
            role: "system",
            content: `📎 Attached file: ${data.file_path} (${attachedFiles.length + 1} files attached)`
          }]);
        }
      } else if (command === "/list-attachments") {
        if (attachedFiles.length === 0) {
          setMessages([...messages, { role: "system", content: `📎 No files currently attached.` }]);
        } else {
          const fileList = attachedFiles.map((file, idx) => `${idx + 1}. ${file.path}`).join('\n');
          setMessages([...messages, { role: "system", content: `📎 **Attached Files (${attachedFiles.length}):**\n${fileList}` }]);
        }
      } else if (command === "/clear-attachments") {
        setAttachedFiles([]);
        setMessages([...messages, { role: "system", content: `🗑️ Cleared all attached files.` }]);
      } else if (command.startsWith("/remove-attachment")) {
        const [, indexStr] = command.split(" ");
        const index = parseInt(indexStr) - 1;

        if (isNaN(index) || index < 0 || index >= attachedFiles.length) {
          setMessages([...messages, { role: "system", content: `❌ Invalid attachment number. Use /list-attachments to see available files.` }]);
          return;
        }

        const removedFile = attachedFiles[index];
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
        setMessages([...messages, { role: "system", content: `🗑️ Removed attachment: ${removedFile.path}` }]);
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
      } else if (command === "/reindex-all") {
        // Command to reindex all repositories - CHECK THIS FIRST before /reindex
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
      } else if (command === "/reindex") {
        // Command to reindex current project (no parameters)
        if (!project) {
          setMessages([...messages, { role: "system", content: `❌ No current project selected. Please select a project or use: /reindex [repo_name]` }]);
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
                // Check if this is a background operation start vs completion
                if (data.message && (data.message.includes('started') || data.message.includes('background'))) {
                  setMessages([...currentMessages,
                  { role: "system", content: `📂 Scanning repository: ${project}` },
                  { role: "system", content: `⚡ Processing files and generating embeddings...` },
                  { role: "system", content: `🚀 Reindex started for ${project}! Check logs for completion status.` }
                  ]);
                } else {
                  setMessages([...currentMessages,
                  { role: "system", content: `📂 Scanning repository: ${project}` },
                  { role: "system", content: `⚡ Processing files and generating embeddings...` },
                  { role: "system", content: `✅ Successfully reindexed ${project}! ${data.message || '🚀 Repository is now ready for queries.'}` }
                  ]);
                }
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
      } else if (command.startsWith("/reindex ")) {
        // Command to reindex specific repository (with parameters)
        // Extract everything after "/reindex " as the repository name
        const repoName = command.substring("/reindex ".length).trim();

        if (!repoName) {
          setMessages([...messages, { role: "system", content: `❌ Please specify a repository name. Usage: /reindex [repo_name]` }]);
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
              console.log("🐛 DEBUG: Sending reindex request for:", repoName);

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
      } else if (command === "/help") {
        const helpText = `**Available Commands:**

**File Management:**
• \`/list-files [repo]\` - List all files in a repository
• \`/attach-file [repo]/[file_path]\` - Attach a file for AI analysis
• \`/list-attachments\` - Show currently attached files
• \`/remove-attachment [number]\` - Remove specific attachment
• \`/clear-attachments\` - Remove all attachments

**Repository Management:**
• \`/refresh-repos\` - Refresh repository list
• \`/reindex [repo]\` - Reindex specific repository
• \`/reindex\` - Reindex current project
• \`/reindex-all\` - Reindex all repositories (required on first use)

**General:**
• \`/help\` - Show this help message

**Important:** Run \`/reindex-all\` first after deployment to clone repositories.

**Workflow Example:**
1. \`/reindex-all\` (first time setup)
2. \`/list-files Trading-Bot\`
3. \`/attach-file Trading-Bot/main.py\`
4. \`/attach-file Trading-Bot/src/utils.py\`
5. Ask your question - attached files will be included as context`;

        setMessages([...messages, { role: "system", content: helpText }]);
      } else {
        setMessages([...messages, { role: "system", content: `Unknown command: ${command}. Type /help for available commands.` }]);
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
        // Include attached files in the context
        let enhancedMessages = [...newMessages];

        if (attachedFiles.length > 0) {
          const attachmentContext = attachedFiles.map(file =>
            `**File: ${file.path}**\n\`\`\`\n${file.content}\n\`\`\``
          ).join('\n\n---\n\n');

          enhancedMessages = [
            {
              role: "system",
              content: `The user has attached ${attachedFiles.length} file(s) for context. Please analyze these files in relation to their question:\n\n${attachmentContext}`,
              timestamp: getTimestamp(),
            },
            ...newMessages
          ];
        }

        const assistantReply = await sendMessage(project, enhancedMessages);
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
    <div className="h-screen w-screen bg-gray-100 flex">
      {/* Sidebar for attachments and controls */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <header className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900 mb-3">💬 Coding Assistant</h1>
          <div className="space-y-2">
            {loadingRepos ? (
              <div className="text-sm text-gray-500">Loading repositories...</div>
            ) : (
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md text-gray-700 transition-colors"
              disabled={loadingRepos}
            >
              🔄 Refresh Repositories
            </button>
          </div>
        </header>

        {/* Attached Files Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Attached Files</h3>
              {attachedFiles.length > 0 && (
                <button
                  onClick={() => onCommand("/clear-attachments")}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Clear all
                </button>
              )}
            </div>

            {attachedFiles.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8">
                No files attached
                <div className="text-xs mt-1">Use /attach-file to add files</div>
              </div>
            ) : (
              <div className="space-y-2">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="group flex items-center gap-2 p-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate" title={file.path}>
                        {file.path.split('/').pop()}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {file.path}
                      </div>
                    </div>
                    <button
                      onClick={() => onCommand(`/remove-attachment ${idx + 1}`)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                      title="Remove this file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Commands */}
        <div className="p-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Commands</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setInput('/help')}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
            >
              📖 Help
            </button>
            <button
              onClick={() => setInput('/list-files ' + project)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
              disabled={!project}
            >
              📁 List Files
            </button>
            <button
              onClick={() => setInput('/reindex ' + project)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
              disabled={!project}
            >
              🔄 Reindex
            </button>
            <button
              onClick={() => setInput('/reindex-all')}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
            >
              🔄 Reindex All
            </button>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat messages */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white text-2xl font-semibold">
                  AI
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Welcome to your Coding Assistant
                </h2>
                <p className="text-gray-600 mb-4">
                  Ask questions about your code, attach files for analysis, or use commands to manage your repositories.
                </p>
                <div className="text-sm text-gray-500">
                  Try typing <code className="bg-gray-100 px-1 rounded">/help</code> to see available commands
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <Message
                  key={idx}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.timestamp}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input area */}
        <footer className="border-t border-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            {attachedFiles.length > 0 && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-xs text-blue-700">
                  📎 {attachedFiles.length} file(s) will be included with your message
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-3">
              <textarea
                ref={textareaRef}
                rows={1}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`Ask a question about ${project || 'your code'}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{ lineHeight: "24px" }}
                disabled={!project}
              />
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                disabled={!project || !input.trim()}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
            <div className="text-xs text-gray-500 mt-2 text-center">
              Use <code className="bg-gray-100 px-1 rounded">/attach-file [repo]/[file]</code> to attach files, or <code className="bg-gray-100 px-1 rounded">/help</code> for all commands
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}