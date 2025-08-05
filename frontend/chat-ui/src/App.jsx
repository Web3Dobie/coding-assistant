import React, { useState, useRef, useEffect, useCallback } from "react";
import Message from "./components/Message";
import ArtifactViewer from "./components/ArtifactViewer";
import { sendMessage } from "./api/chat";
import { artifactStore, useArtifactStore } from "./utils/artifactStore";

export default function App() {
  const [project, setProject] = useState("");
  const [repositories, setRepositories] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [currentArtifact, setCurrentArtifact] = useState(null);
  const [artifactPanelWidth, setArtifactPanelWidth] = useState(50);
  const [showArtifactHistory, setShowArtifactHistory] = useState(false);

  // New state for repository context
  const [repositoryContext, setRepositoryContext] = useState({
    enabled: false,
    fileMap: null,
    lastIndexed: null
  });

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  // Use artifact store hook
  const {
    artifacts,
    getArtifact,
    getMessageArtifacts,
    getArtifactVersions,
    createArtifact,
    updateArtifact
  } = useArtifactStore();

  // Backend endpoint to get repository structure with metadata
  const getRepositoryContext = async (repoName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/get-repository-context/${repoName}`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Error getting repository context:', error);
    }
    return null;
  };

  // Enable full repository context
  const enableRepositoryContext = async () => {
    if (!project) return;
    
    setMessages(prev => [...prev, { 
      role: "system", 
      content: `🔄 Indexing ${project} repository for full context mode...`,
      timestamp: getTimestamp()
    }]);

    const contextData = await getRepositoryContext(project);
    
    if (contextData) {
      setRepositoryContext({
        enabled: true,
        fileMap: contextData.fileMap,
        lastIndexed: new Date().toISOString()
      });
      
      setMessages(prev => [...prev, 
        { 
          role: "system", 
          content: `✅ Repository context enabled! AI can now see ${contextData.totalFiles} files and will auto-load them as needed.`,
          timestamp: getTimestamp()
        }
      ]);
    } else {
      setMessages(prev => [...prev,
        { 
          role: "system", 
          content: `❌ Failed to enable repository context mode.`,
          timestamp: getTimestamp()
        }
      ]);
    }
  };

  // Disable repository context
  const disableRepositoryContext = () => {
    setRepositoryContext({
      enabled: false,
      fileMap: null,
      lastIndexed: null
    });
    
    setMessages(prev => [...prev, { 
      role: "system", 
      content: `🔄 Repository context mode disabled. AI will only see manually attached files.`,
      timestamp: getTimestamp()
    }]);
  };

  // Extract file requests from AI response
  const extractFileRequests = (aiResponse) => {
    // Look for various patterns of file references
    const patterns = [
      /`([^`]+\.(py|js|jsx|ts|tsx|json|yml|yaml|md|txt|sql|css|html))`/g,
      /\*\*([^*]+\.(py|js|jsx|ts|tsx|json|yml|yaml|md|txt|sql|css|html))\*\*/g,
      /(?:file:|path:|see:|check:|examine:)\s*([^\s]+\.(py|js|jsx|ts|tsx|json|yml|yaml|md|txt|sql|css|html))/gi
    ];
    
    const requestedFiles = new Set();
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(aiResponse)) !== null) {
        requestedFiles.add(match[1]);
      }
    });
    
    return Array.from(requestedFiles);
  };

  // Auto-attach files referenced by AI
  const autoAttachReferencedFiles = async (aiResponse) => {
    if (!repositoryContext.enabled) return;
    
    const requestedFiles = extractFileRequests(aiResponse);
    const filesToAttach = [];
    
    for (const filePath of requestedFiles) {
      // Check if file exists in repository and isn't already attached
      const fileExists = repositoryContext.fileMap?.some(file => 
        file.path.endsWith(filePath) || file.path === filePath
      );
      
      const alreadyAttached = attachedFiles.some(attached => 
        attached.path.includes(filePath)
      );
      
      if (fileExists && !alreadyAttached) {
        filesToAttach.push(filePath);
      }
    }
    
    if (filesToAttach.length > 0) {
      await attachMultipleFiles(filesToAttach);
      
      setMessages(prev => [...prev, {
        role: "system",
        content: `🤖 Auto-attached ${filesToAttach.length} files referenced by AI: ${filesToAttach.join(', ')}`,
        timestamp: getTimestamp()
      }]);
    }
  };

  // Attach multiple files
  const attachMultipleFiles = async (filePaths) => {
    const newAttachments = [];
    
    for (const filePath of filePaths) {
      try {
        // Handle relative paths
        const fullPath = filePath.startsWith(project) ? filePath : `${project}/${filePath}`;
        
        const response = await fetch(`${API_BASE_URL}/get-file?file_path=${encodeURIComponent(fullPath)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          
          // Check if not already attached
          if (!attachedFiles.some(f => f.path === data.file_path)) {
            newAttachments.push({
              path: data.file_path,
              content: data.content,
              attachedAt: new Date().toISOString(),
              autoAttached: true
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to auto-attach ${filePath}:`, error);
      }
    }
    
    if (newAttachments.length > 0) {
      setAttachedFiles(prev => [...prev, ...newAttachments]);
    }
  };

  // Build repository context message for AI
  const buildRepositoryContextMessage = () => {
    if (!repositoryContext.enabled || !repositoryContext.fileMap) {
      return null;
    }
    
    const fileList = repositoryContext.fileMap
      .slice(0, 50) // Limit to prevent token overflow
      .map(file => `- ${file.path} (${file.type}, ${file.lines} lines)`)
      .join('\n');
    
    const totalFiles = repositoryContext.fileMap.length;
    const truncated = totalFiles > 50 ? `\n... and ${totalFiles - 50} more files` : '';
    
    return {
      role: "system",
      content: `🗂️ REPOSITORY CONTEXT - ${project}

You have access to the complete repository structure. Below are the available files:

${fileList}${truncated}

IMPORTANT: You can reference any file by its path (e.g., \`backend/main.py\` or \`src/App.jsx\`). When you reference a file in your response, it will be automatically loaded for context. Reference files when you need to see their actual content to provide better assistance.

Currently attached files: ${attachedFiles.length > 0 ? attachedFiles.map(f => f.path.split('/').pop()).join(', ') : 'None'}`,
      timestamp: getTimestamp()
    };
  };

  // Repository Context Toggle Component
  const RepositoryContextToggle = () => (
    <div className="flex items-center gap-2">
      <button
        onClick={repositoryContext.enabled ? disableRepositoryContext : enableRepositoryContext}
        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          repositoryContext.enabled
            ? 'bg-green-100 text-green-800 hover:bg-green-200'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        disabled={!project}
      >
        {repositoryContext.enabled ? '🗂️ Context: ON' : '🗂️ Context: OFF'}
      </button>
      {repositoryContext.enabled && (
        <span className="text-xs text-gray-500">
          {repositoryContext.fileMap?.length || 0} files indexed
        </span>
      )}
    </div>
  );

  // Handle artifact creation from messages
  const handleArtifactCreate = useCallback((artifact, messageIndex, baseId) => {
    try {
      const similarArtifact = artifactStore.findSimilarArtifact(artifact.content, artifact.language, 0.7);

      let createdArtifact;
      if (similarArtifact && shouldCreateNewVersion(similarArtifact, artifact)) {
        createdArtifact = createArtifact(artifact, messageIndex, similarArtifact.baseId);
      } else {
        createdArtifact = createArtifact(artifact, messageIndex);
      }

      // Add repository context to artifact safely
      if (createdArtifact && project) {
        createdArtifact.repository = project;
        // Only update if updateArtifact method exists
        if (typeof artifactStore.updateArtifact === 'function') {
          artifactStore.updateArtifact(createdArtifact.id, { repository: project });
        }
      }

      if (createdArtifact && (artifact.content.length > 500 || createdArtifact.version > 1)) {
        setCurrentArtifact(createdArtifact);
      }

      return createdArtifact;
    } catch (error) {
      console.error('Error creating artifact:', error);
      return null;
    }
  }, [createArtifact, project]);

  // Determine if we should create a new version vs new artifact
  const shouldCreateNewVersion = (existingArtifact, newArtifact) => {
    return (
      existingArtifact.language === newArtifact.language &&
      (existingArtifact.title.toLowerCase().includes(newArtifact.title.toLowerCase()) ||
        newArtifact.title.toLowerCase().includes(existingArtifact.title.toLowerCase()) ||
        existingArtifact.content.length > 200)
    );
  };

  // Handle artifact viewing with safety checks
  const handleArtifactView = useCallback((artifact) => {
    try {
      // Ensure artifact has valid content
      if (artifact && typeof artifact.content === 'string') {
        setCurrentArtifact(artifact);
      } else {
        console.error('Invalid artifact content:', artifact);
        setMessages(prev => [...prev, {
          role: "system",
          content: `❌ Error: Artifact content is corrupted. Cannot display this artifact.`,
          timestamp: getTimestamp()
        }]);
      }
    } catch (error) {
      console.error('Error viewing artifact:', error);
      setMessages(prev => [...prev, {
        role: "system",
        content: `❌ Error viewing artifact: ${error.message}`,
        timestamp: getTimestamp()
      }]);
    }
  }, []);

  // Handle artifact updates
  const handleArtifactUpdate = useCallback((artifact) => {
    try {
      if (artifact && typeof artifact.content === 'string') {
        setCurrentArtifact(artifact);
      } else {
        console.error('Invalid updated artifact content:', artifact);
      }
    } catch (error) {
      console.error('Error updating artifact:', error);
    }
  }, []);

  // Safe version selection handler
  const handleVersionSelect = useCallback((version) => {
    try {
      if (version && typeof version.content === 'string') {
        setCurrentArtifact(version);
      } else {
        console.error('Invalid version content:', version);
        // Try to fix the version content if possible
        if (version && version.content && typeof version.content === 'object') {
          // If content is an object, try to stringify it
          const fixedVersion = {
            ...version,
            content: JSON.stringify(version.content, null, 2)
          };
          setCurrentArtifact(fixedVersion);
        } else {
          setMessages(prev => [...prev, {
            role: "system",
            content: `❌ Error: Version content is corrupted. Cannot display this version.`,
            timestamp: getTimestamp()
          }]);
        }
      }
    } catch (error) {
      console.error('Error selecting version:', error);
      setMessages(prev => [...prev, {
        role: "system",
        content: `❌ Error switching to version: ${error.message}`,
        timestamp: getTimestamp()
      }]);
    }
  }, []);

  // Handle mouse down for resizing
  const handleMouseDown = (e) => {
    e.preventDefault();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    const containerWidth = window.innerWidth;
    const newWidth = ((containerWidth - e.clientX) / containerWidth) * 100;
    const clampedWidth = Math.min(Math.max(newWidth, 30), 70);
    setArtifactPanelWidth(clampedWidth);
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Load repositories on component mount
  useEffect(() => {
    const loadRepositories = async () => {
      try {
        setLoadingRepos(true);
        const response = await fetch(`${API_BASE_URL}/repositories`);

        if (response.ok) {
          const data = await response.json();
          setRepositories(data.repositories);

          if (data.repositories.length > 0 && !project) {
            setProject(data.repositories[0]);
          }
        } else {
          console.error("Failed to load repositories");
          const fallbackRepos = ["X-Agent", "DutchBrat-Website", "Coding-Assistant", "Hedgefund-Agent"];
          setRepositories(fallbackRepos);
          setProject(fallbackRepos[0]);
        }
      } catch (error) {
        console.error("Error loading repositories:", error);
        const fallbackRepos = ["X-Agent", "DutchBrat-Website", "Coding-Assistant", "Hedgefund-Agent"];
        setRepositories(fallbackRepos);
        setProject(fallbackRepos[0]);
      } finally {
        setLoadingRepos(false);
      }
    };

    loadRepositories();
  }, []);

  // Persist artifact store to localStorage
  useEffect(() => {
    const saveArtifacts = () => {
      try {
        const data = artifactStore.export();
        localStorage.setItem('coding-assistant-artifacts', JSON.stringify(data));
      } catch (error) {
        console.warn('Failed to save artifacts to localStorage:', error);
      }
    };

    // Load artifacts on startup
    try {
      const saved = localStorage.getItem('coding-assistant-artifacts');
      if (saved) {
        const data = JSON.parse(saved);
        artifactStore.import(data);
      }
    } catch (error) {
      console.warn('Failed to load artifacts from localStorage:', error);
    }

    // Save artifacts when they change
    const unsubscribe = artifactStore.subscribe(saveArtifacts);
    return unsubscribe;
  }, []);

  const getTimestamp = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const onCommand = async (command) => {
    try {
      if (command.startsWith("/attach-file")) {
        const [, ...filePathParts] = command.split(" ");
        const filePath = filePathParts.join(" ");

        if (!filePath) {
          setMessages([...messages, { role: "system", content: `❌ Please specify a file path. Usage: /attach-file [repo]/[file_path] or /attach-file [file_path]\nExample: /attach-file Trading-Bot/main.py or /attach-file README.md` }]);
          return;
        }

        let finalFilePath = filePath;
        if (!filePath.includes('/') && project) {
          finalFilePath = `${project}/${filePath}`;
        } else if (!filePath.includes('/')) {
          setMessages([...messages, { role: "system", content: `❌ Please specify a repository name or select a current project. Usage: /attach-file [repo]/[file_path]\nExample: /attach-file Trading-Bot/main.py` }]);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/get-file?file_path=${encodeURIComponent(finalFilePath)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const error = await response.json();
          setMessages([...messages, { role: "system", content: `Error: ${error.detail || JSON.stringify(error)}` }]);
        } else {
          const data = await response.json();

          if (attachedFiles.some(f => f.path === data.file_path)) {
            setMessages([...messages, { role: "system", content: `⚠️ File ${data.file_path} is already attached.` }]);
            return;
          }

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
      } else if (command === "/clear-artifacts") {
        try {
          if (project) {
            // Clear only artifacts for current repository
            const currentRepoArtifacts = Array.isArray(artifacts) ? artifacts.filter(a => a && a.repository === project) : [];
            currentRepoArtifacts.forEach(artifact => {
              if (artifact && artifact.id && typeof artifactStore.deleteArtifact === 'function') {
                artifactStore.deleteArtifact(artifact.id);
              }
            });
            setCurrentArtifact(null);
            setMessages([...messages, { role: "system", content: `🗑️ Cleared ${currentRepoArtifacts.length} artifacts for ${project} repository.` }]);
          } else {
            // Clear all artifacts if no repository selected
            artifactStore.clear();
            setCurrentArtifact(null);
            setMessages([...messages, { role: "system", content: `🗑️ Cleared all artifacts and version history.` }]);
          }
        } catch (error) {
          console.error('Error clearing artifacts:', error);
          setMessages([...messages, { role: "system", content: `❌ Error clearing artifacts. Please try again.` }]);
        }
      } else if (command === "/list-artifacts") {
        try {
          const allArtifacts = Array.isArray(artifacts) ? artifacts : [];
          const filteredArtifacts = project 
            ? allArtifacts.filter(a => a && a.repository === project)
            : allArtifacts;
            
          if (filteredArtifacts.length === 0) {
            const repoText = project ? ` for ${project}` : '';
            setMessages([...messages, {
              role: "system",
              content: `📄 No artifacts created yet${repoText}.`,
              timestamp: getTimestamp()
            }]);
          } else {
            // Create simple text list with view commands
            const repoText = project ? ` for ${project}` : '';
            const sortedArtifacts = filteredArtifacts
              .filter(a => a && a.title)
              .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            
            const artifactList = sortedArtifacts
              .map((artifact, idx) => {
                const title = artifact.title || 'Untitled';
                const language = artifact.language || 'Unknown';
                const created = artifact.createdAt ? new Date(artifact.createdAt).toLocaleDateString() : 'Unknown date';
                return `${idx + 1}. **${title}** (${language}) - ${created}\n   💡 Type \`/view-artifact ${idx + 1}\` to open this artifact`;
              })
              .join('\n\n');
            
            // Store artifacts for /view-artifact command
            window.currentArtifactList = sortedArtifacts;
              
            setMessages([...messages, {
              role: "system",
              content: `📄 **Created Artifacts${repoText} (${sortedArtifacts.length}):**\n\n${artifactList}`,
              timestamp: getTimestamp()
            }]);
          }
        } catch (error) {
          console.error('Error listing artifacts:', error);
          setMessages([...messages, {
            role: "system",
            content: `❌ Error loading artifacts: ${error.message}`,
            timestamp: getTimestamp()
          }]);
        }
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
        const targetRepo = repoName || project;

        if (!targetRepo) {
          setMessages([...messages, { role: "system", content: `❌ Please specify a repository name or select a current project.` }]);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/list-files?repo_name=${targetRepo}&format=tree`);

        if (!response.ok) {
          const error = await response.json();
          setMessages([...messages, { role: "system", content: `Error: ${error.detail}` }]);
        } else {
          const data = await response.json();
          if (data.format === "tree" && data.tree) {
            const formattedTree = `📁 File structure for ${targetRepo}:\n\n${data.tree}`;
            setMessages([...messages, {
              role: "system",
              content: formattedTree
            }]);
          } else if (data.files) {
            const fileList = data.files.join("\n");
            setMessages([...messages, { role: "system", content: `Files in ${targetRepo}:\n${fileList}` }]);
          }
        }
      } else if (command === "/refresh-repos") {
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
        if (!project) {
          setMessages([...messages, { role: "system", content: `❌ No current project selected. Please select a project or use: /reindex [repo_name]` }]);
          return;
        }

        const currentMessages = [...messages, { role: "system", content: `🔄 No repository specified, using current project: ${project}` }];
        setMessages(currentMessages);

        setTimeout(async () => {
          setMessages([...currentMessages, { role: "system", content: `📂 Scanning repository: ${project}` }]);

          setTimeout(async () => {
            setMessages([...currentMessages,
            { role: "system", content: `📂 Scanning repository: ${project}` },
            { role: "system", content: `⚡ Processing files and generating embeddings...` }
            ]);

            try {
              const response = await fetch(`${API_BASE_URL}/reindex`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repo_name: project }),
              });

              if (response.ok) {
                const data = await response.json();
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
        const repoName = command.substring("/reindex ".length).trim();

        if (!repoName) {
          setMessages([...messages, { role: "system", content: `❌ Please specify a repository name. Usage: /reindex [repo_name]` }]);
          return;
        }

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
      } else if (command.startsWith("/view-artifact")) {
        const [, indexStr] = command.split(" ");
        const index = parseInt(indexStr) - 1;
        
        if (window.currentArtifactList && window.currentArtifactList[index]) {
          const artifact = window.currentArtifactList[index];
          
          // Validate artifact before viewing
          if (artifact && typeof artifact.content === 'string') {
            setCurrentArtifact(artifact);
            setMessages([...messages, {
              role: "system",
              content: `📄 Opened artifact: **${artifact.title}** in side panel.`,
              timestamp: getTimestamp()
            }]);
          } else {
            setMessages([...messages, {
              role: "system",
              content: `❌ Error: Artifact content is corrupted. Cannot display artifact "${artifact?.title || 'Unknown'}".`,
              timestamp: getTimestamp()
            }]);
          }
        } else {
          setMessages([...messages, {
            role: "system",
            content: `❌ Invalid artifact number. Use /list-artifacts to see available artifacts.`,
            timestamp: getTimestamp()
          }]);
        }
      } else if (command === "/help") {
        const helpText = `**Available Commands:**

**File Management:**
• \`/list-files [repo]\` - List all files in a repository
• \`/attach-file [repo]/[file_path]\` - Attach a file for AI analysis
• \`/list-attachments\` - Show currently attached files
• \`/remove-attachment [number]\` - Remove specific attachment
• \`/clear-attachments\` - Remove all attachments

**Repository Context:**
• \`🗂️ Context: ON/OFF\` - Enable/disable repository context mode
• When enabled, AI can see all files and auto-load them as needed

**Artifact Management:**
• \`/list-artifacts\` - Show all created artifacts for current repository
• \`/view-artifact [number]\` - Open specific artifact (use numbers from list)
• \`/clear-artifacts\` - Clear all artifacts for current repository

**Repository Management:**
• \`/refresh-repos\` - Refresh repository list
• \`/reindex [repo]\` - Reindex specific repository
• \`/reindex\` - Reindex current project
• \`/reindex-all\` - Reindex all repositories (required on first use)

**General:**
• \`/help\` - Show this help message

**Important:** Run \`/reindex-all\` first after deployment to clone repositories.

**Repository Context Mode:**
- When enabled, AI can see the complete file structure
- Files are automatically loaded when referenced in AI responses
- Provides seamless access to entire codebase

**Artifact System:**
- Small code blocks (≤10 lines) stay in chat
- Large code blocks (>10 lines) become artifacts with versioning
- Click artifact cards to view in side panel
- Artifacts persist across sessions with full version history`;

        setMessages([...messages, { role: "system", content: helpText }]);
      } else {
        setMessages([...messages, { role: "system", content: `Unknown command: ${command}. Type /help for available commands.` }]);
      }
    } catch (error) {
      setMessages([...messages, { role: "system", content: `Error executing command: ${error.message}` }]);
    }
    setInput("");
  };

  // Auto-resize textarea
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

  // Modified handleSubmit to include repository context
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
        let enhancedMessages = [...newMessages];

        // Add repository context if enabled
        const contextMessage = buildRepositoryContextMessage();
        if (contextMessage) {
          enhancedMessages = [contextMessage, ...enhancedMessages];
        }

        // Add attached files context
        if (attachedFiles.length > 0) {
          const attachmentContext = attachedFiles.map(file =>
            `**File: ${file.path}**\n\`\`\`\n${file.content}\n\`\`\``
          ).join('\n\n---\n\n');

          enhancedMessages = [
            {
              role: "system",
              content: `The user has attached ${attachedFiles.length} file(s) for context:\n\n${attachmentContext}`,
              timestamp: getTimestamp(),
            },
            ...enhancedMessages
          ];
        }

        const assistantReply = await sendMessage(project, enhancedMessages);
        
        const assistantMessage = {
          role: "assistant",
          content: assistantReply,
          timestamp: getTimestamp(),
        };
        
        setMessages([...newMessages, assistantMessage]);
        
        // Auto-attach files referenced in AI response
        await autoAttachReferencedFiles(assistantReply);
        
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
    <div className="h-screen bg-white flex flex-col">
      {/* Top Header Bar */}
      <div className="bg-gray-50 border-b border-gray-200 p-6">
        {/* Title Row */}
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">💬 Coding Assistant</h1>
        </div>

        {/* Repository Selection Row */}
        <div className="mb-4 flex items-center gap-4">
          {loadingRepos ? (
            <div className="text-lg text-gray-500">Loading repositories...</div>
          ) : (
            <>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="border border-gray-300 rounded-lg px-6 py-4 text-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-80 bg-white"
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
              <button
                onClick={() => onCommand("/refresh-repos")}
                className="bg-blue-100 hover:bg-blue-200 px-4 py-3 rounded-lg text-blue-800 transition-colors font-medium text-lg"
                disabled={loadingRepos}
              >
                🔄 Refresh
              </button>
              {/* Repository Context Toggle */}
              <RepositoryContextToggle />
            </>
          )}
        </div>

        {/* Quick Commands Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setInput('/help')}
              className="px-5 py-2.5 bg-white hover:bg-gray-50 rounded-lg text-gray-700 transition-colors border border-gray-300 font-medium text-base shadow-sm"
            >
              📖 Help
            </button>
            <button
              onClick={() => setInput('/list-files ' + project)}
              className="px-5 py-2.5 bg-white hover:bg-gray-50 rounded-lg text-gray-700 transition-colors border border-gray-300 font-medium text-base shadow-sm"
              disabled={!project}
            >
              📁 List Files
            </button>
            <button
              onClick={() => setInput('/reindex-all')}
              className="px-5 py-2.5 bg-white hover:bg-gray-50 rounded-lg text-gray-700 transition-colors border border-gray-300 font-medium text-base shadow-sm"
            >
              🔄 Reindex All
            </button>
            <button
              onClick={() => setInput('/list-artifacts')}
              className="px-5 py-2.5 bg-white hover:bg-gray-50 rounded-lg text-gray-700 transition-colors border border-gray-300 font-medium text-base shadow-sm"
            >
              📄 Artifacts ({(() => {
                try {
                  const allArtifacts = Array.isArray(artifacts) ? artifacts : [];
                  return project ? allArtifacts.filter(a => a && a.repository === project).length : allArtifacts.length;
                } catch (error) {
                  console.error('Error counting artifacts:', error);
                  return 0;
                }
              })()})
            </button>
          </div>

          {/* Attached Files Counter */}
          {attachedFiles.length > 0 && (
            <div className="flex items-center gap-4 text-gray-700">
              <span className="font-medium text-base">📎 {attachedFiles.length} file(s) attached</span>
              <button
                onClick={() => onCommand("/clear-attachments")}
                className="text-red-600 hover:text-red-800 font-medium text-base"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Attached Files List (if any) */}
        {attachedFiles.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-300">
            <div className="flex flex-wrap gap-3">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="group flex items-center gap-3 px-4 py-2 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 shadow-sm">
                  <div className="text-base text-gray-900 font-medium">
                    {file.path.split('/').pop()}
                  </div>
                  <div className="text-base text-gray-500">
                    {file.path.split('/').slice(0, -1).join('/')}
                  </div>
                  {file.autoAttached && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      Auto
                    </span>
                  )}
                  <button
                    onClick={() => onCommand(`/remove-attachment ${idx + 1}`)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    title="Remove this file"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation panel */}
        <div
          className={`flex flex-col bg-white ${currentArtifact ? '' : 'flex-1'}`}
          style={{
            width: currentArtifact ? `${100 - artifactPanelWidth}%` : '100%'
          }}
        >
          {/* Chat messages */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-none space-y-6">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white text-2xl font-semibold">
                    AI
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Welcome to your Coding Assistant
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Ask questions about your code, attach files for analysis, or enable repository context mode for full codebase access.
                  </p>
                  <div className="text-sm text-gray-500">
                    Try typing <code className="bg-gray-100 px-1 rounded">/help</code> to see available commands or toggle repository context mode above
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <Message
                    key={idx}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.timestamp}
                    messageIndex={idx}
                    artifactStore={artifactStore}
                    onArtifactCreate={handleArtifactCreate}
                    onArtifactView={handleArtifactView}
                    onArtifactUpdate={handleArtifactUpdate}
                    artifacts={msg.artifacts} // Pass artifacts for artifact_list messages
                    artifactButtons={msg.artifactButtons} // Pass artifact buttons for clickable lists
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Input area */}
          <footer className="border-t border-gray-200 p-4">
            <div className="max-w-none">
              {attachedFiles.length > 0 && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-xs text-blue-700">
                    📎 {attachedFiles.length} file(s) will be included with your message
                    {repositoryContext.enabled && (
                      <span className="ml-2 text-green-700">• Repository context active</span>
                    )}
                  </div>
                </div>
              )}
              {repositoryContext.enabled && attachedFiles.length === 0 && (
                <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
                  <div className="text-xs text-green-700">
                    🗂️ Repository context mode enabled - AI can access all {repositoryContext.fileMap?.length || 0} files
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
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  disabled={!project || !input.trim()}
                >
                  <span>Send</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Resize handle */}
        {currentArtifact && (
          <div
            className="w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize flex-shrink-0"
            onMouseDown={handleMouseDown}
          />
        )}

        {/* Artifact panel */}
        {currentArtifact && (
          <div
            className="bg-gray-50 border-l border-gray-200 flex flex-col"
            style={{ width: `${artifactPanelWidth}%` }}
          >
            <ArtifactViewer
              artifact={currentArtifact}
              onClose={() => setCurrentArtifact(null)}
              onVersionSelect={handleVersionSelect}
              artifactVersions={(() => {
                try {
                  const versions = getArtifactVersions(currentArtifact.baseId);
                  // Filter out versions with invalid content
                  return versions.filter(v => v && typeof v.content === 'string');
                } catch (error) {
                  console.error('Error getting artifact versions:', error);
                  return [];
                }
              })()}
            />
          </div>
        )}
      </div>
    </div>
  );
}