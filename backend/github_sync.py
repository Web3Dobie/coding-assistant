# backend/github_sync.py
import os
import git
from typing import List

REPO_BASE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "repo_clones"))

def sync_repos(repo_list: List[dict]):
    """
    repo_list = [
        {"name": "X-Agent", "url": "https://github.com/Web3Dobie/X-AI-Agent.git"},
        {"name": "DutchBrat-Website", "url": "https://github.com/Web3Dobie/dutchbrat.com.git"},
        {"name": "Hedgefund-Agent", "url": "https://github.com/Web3Dobie/HedgeFundAgent.git"}
    ]
    """
    os.makedirs(REPO_BASE_PATH, exist_ok=True)

    for repo in repo_list:
        local_path = os.path.join(REPO_BASE_PATH, repo["name"])
        if os.path.exists(local_path):
            print(f"Updating {repo['name']}...")
            repo_obj = git.Repo(local_path)
            origin = repo_obj.remotes.origin
            origin.pull()
        else:
            print(f"Cloning {repo['name']}...")
            git.Repo.clone_from(repo["url"], local_path)

        print(f"✅ Synced: {repo['name']}")


if __name__ == "__main__":
    # Example usage (customize for your GitHub repos)
    repositories = [
        {"name": "X-Agent", "url": "https://github.com/Web3Dobie/X-AI-Agent.git"},
        {"name": "DutchBrat-Website", "url": "https://github.com/Web3Dobie/dutchbrat.com.git"},
        {"name": "Hedgefund-Agent", "url": "https://github.com/Web3Dobie/HedgeFundAgent.git"}
    ]
    sync_repos(repositories)
