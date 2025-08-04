// utils/artifactStore.js - Claude-style artifact management with versioning
import { useState, useEffect } from 'react';

class ArtifactStore {
    constructor() {
        this.artifacts = new Map(); // artifactId -> artifact object
        this.messageArtifacts = new Map(); // messageIndex -> Set of artifactIds
        this.artifactVersions = new Map(); // baseId -> array of versions
        this.listeners = new Set();
    }

    // Add listener for store changes
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // Notify all listeners of changes
    notify() {
        this.listeners.forEach(listener => listener(this));
    }

    // Create new artifact or new version of existing artifact
    createArtifact(artifact, messageIndex, baseArtifactId = null) {
        let finalArtifact;

        if (baseArtifactId) {
            // This is an update to existing artifact - create new version
            const baseArtifact = this.artifacts.get(baseArtifactId) ||
                Array.from(this.artifacts.values()).find(a => a.baseId === baseArtifactId);

            if (baseArtifact) {
                const baseId = baseArtifact.baseId || baseArtifactId;
                const versions = this.artifactVersions.get(baseId) || [baseArtifact];

                finalArtifact = {
                    ...artifact,
                    id: `${baseId}-v${versions.length + 1}`,
                    baseId: baseId,
                    version: versions.length + 1,
                    previousVersion: baseArtifact.id,
                    createdAt: new Date().toISOString(),
                    messageIndex
                };

                // Update version history
                this.artifactVersions.set(baseId, [...versions, finalArtifact]);
            } else {
                // Fallback to new artifact if base not found
                finalArtifact = this.createNewArtifact(artifact, messageIndex);
            }
        } else {
            // New artifact
            finalArtifact = this.createNewArtifact(artifact, messageIndex);
        }

        // Store artifact
        this.artifacts.set(finalArtifact.id, finalArtifact);

        // Associate with message
        if (!this.messageArtifacts.has(messageIndex)) {
            this.messageArtifacts.set(messageIndex, new Set());
        }
        this.messageArtifacts.get(messageIndex).add(finalArtifact.id);

        this.notify();
        return finalArtifact;
    }

    // Helper to create completely new artifact
    createNewArtifact(artifact, messageIndex) {
        const id = artifact.id || `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const finalArtifact = {
            ...artifact,
            id: id,
            baseId: id,
            version: 1,
            createdAt: new Date().toISOString(),
            messageIndex
        };

        // Initialize version history
        this.artifactVersions.set(finalArtifact.baseId, [finalArtifact]);

        return finalArtifact;
    }

    // Get artifact by ID
    getArtifact(artifactId) {
        return this.artifacts.get(artifactId);
    }

    // Get all artifacts for a message
    getMessageArtifacts(messageIndex) {
        const artifactIds = this.messageArtifacts.get(messageIndex) || new Set();
        return Array.from(artifactIds).map(id => this.artifacts.get(id)).filter(Boolean);
    }

    // Get all versions of an artifact
    getArtifactVersions(baseId) {
        return this.artifactVersions.get(baseId) || [];
    }

    // Get latest version of an artifact
    getLatestVersion(baseId) {
        const versions = this.artifactVersions.get(baseId) || [];
        return versions[versions.length - 1];
    }

    // Update artifact content (creates new version)
    updateArtifact(artifactId, newContent, messageIndex) {
        const currentArtifact = this.artifacts.get(artifactId);
        if (!currentArtifact) return null;

        const updatedArtifact = {
            ...currentArtifact,
            content: newContent,
            updatedAt: new Date().toISOString()
        };

        return this.createArtifact(updatedArtifact, messageIndex, currentArtifact.baseId);
    }

    // Get all artifacts (for debugging/admin)
    getAllArtifacts() {
        return Array.from(this.artifacts.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Get unique artifacts (latest version only)
    getUniqueArtifacts() {
        const baseIds = new Set();
        const uniqueArtifacts = [];

        // Get all base IDs
        for (const artifact of this.artifacts.values()) {
            baseIds.add(artifact.baseId);
        }

        // Get latest version of each
        for (const baseId of baseIds) {
            const latestVersion = this.getLatestVersion(baseId);
            if (latestVersion) {
                uniqueArtifacts.push(latestVersion);
            }
        }

        return uniqueArtifacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Clear all artifacts
    clear() {
        this.artifacts.clear();
        this.messageArtifacts.clear();
        this.artifactVersions.clear();
        this.notify();
    }

    // Export artifacts (for persistence)
    export() {
        return {
            artifacts: Object.fromEntries(this.artifacts),
            messageArtifacts: Object.fromEntries(
                Array.from(this.messageArtifacts).map(([key, value]) => [key, Array.from(value)])
            ),
            artifactVersions: Object.fromEntries(this.artifactVersions)
        };
    }

    // Import artifacts (for persistence)
    import(data) {
        this.artifacts = new Map(Object.entries(data.artifacts || {}));
        this.messageArtifacts = new Map(
            Object.entries(data.messageArtifacts || {}).map(([key, value]) => [parseInt(key), new Set(value)])
        );
        this.artifactVersions = new Map(Object.entries(data.artifactVersions || {}));
        this.notify();
    }

    // Find artifacts by content similarity (for detecting updates)
    findSimilarArtifact(content, language, threshold = 0.7) {
        const allArtifacts = Array.from(this.artifacts.values());

        for (const artifact of allArtifacts) {
            if (artifact.language === language) {
                const similarity = this.calculateSimilarity(content, artifact.content);
                if (similarity > threshold) {
                    return artifact;
                }
            }
        }

        return null;
    }

    // Simple similarity calculation based on common lines/patterns
    calculateSimilarity(text1, text2) {
        const lines1 = text1.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const lines2 = text2.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        if (lines1.length === 0 || lines2.length === 0) return 0;

        const set1 = new Set(lines1);
        const set2 = new Set(lines2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    // Check if content represents an update to existing artifact
    isContentUpdate(newContent, existingArtifact, threshold = 0.3) {
        const similarity = this.calculateSimilarity(newContent, existingArtifact.content);

        // Consider it an update if:
        // 1. There's significant similarity (>30%)
        // 2. The new content is longer (suggesting additions)
        // 3. Same language
        return similarity > threshold &&
            newContent.length >= existingArtifact.content.length * 0.8 &&
            existingArtifact.language;
    }

    // Get artifact statistics
    getStats() {
        const totalArtifacts = this.artifacts.size;
        const uniqueArtifacts = this.getUniqueArtifacts().length;
        const totalVersions = Array.from(this.artifactVersions.values())
            .reduce((sum, versions) => sum + versions.length, 0);

        const languageStats = {};
        for (const artifact of this.artifacts.values()) {
            languageStats[artifact.language] = (languageStats[artifact.language] || 0) + 1;
        }

        return {
            totalArtifacts,
            uniqueArtifacts,
            totalVersions,
            languageStats,
            oldestArtifact: this.getOldestArtifact(),
            newestArtifact: this.getNewestArtifact()
        };
    }

    // Get oldest artifact
    getOldestArtifact() {
        const artifacts = Array.from(this.artifacts.values());
        if (artifacts.length === 0) return null;
        return artifacts.reduce((oldest, current) =>
            new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest
        );
    }

    // Get newest artifact
    getNewestArtifact() {
        const artifacts = Array.from(this.artifacts.values());
        if (artifacts.length === 0) return null;
        return artifacts.reduce((newest, current) =>
            new Date(current.createdAt) > new Date(newest.createdAt) ? current : newest
        );
    }
}

// Export singleton instance
export const artifactStore = new ArtifactStore();

// React hook for using artifact store
export const useArtifactStore = () => {
    const [, setTrigger] = useState({});

    useEffect(() => {
        const unsubscribe = artifactStore.subscribe(() => {
            setTrigger({});
        });
        return unsubscribe;
    }, []);

    return {
        store: artifactStore,
        artifacts: artifactStore.getAllArtifacts(),
        uniqueArtifacts: artifactStore.getUniqueArtifacts(),
        getArtifact: (id) => artifactStore.getArtifact(id),
        getMessageArtifacts: (messageIndex) => artifactStore.getMessageArtifacts(messageIndex),
        getArtifactVersions: (baseId) => artifactStore.getArtifactVersions(baseId),
        getLatestVersion: (baseId) => artifactStore.getLatestVersion(baseId),
        createArtifact: (artifact, messageIndex, baseId) => artifactStore.createArtifact(artifact, messageIndex, baseId),
        updateArtifact: (id, content, messageIndex) => artifactStore.updateArtifact(id, content, messageIndex),
        stats: artifactStore.getStats()
    };
};