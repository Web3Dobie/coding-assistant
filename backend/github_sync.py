import subprocess
import os
from typing import List, Dict

# Directory where repositories are cloned
REPO_CLONES_DIR = os.getenv("REPO_CLONES_DIR", "data/repo_clones")

def get_authenticated_repo_url(repo_url: str, token: str) -> str:
    """Modify the repository URL to include authentication."""
    if repo_url.startswith("https://"):
        return repo_url.replace("https://", f"https://{token}@")
    else:
        raise ValueError("Unsupported repository URL format. Only HTTPS is supported for authentication.")

def sync_repos(repositories: List[Dict[str, str]], token: str = None):
    """Sync repositories by cloning or pulling updates."""
    for repo in repositories:
        repo_name = repo["name"]
        repo_url = repo["url"]
        repo_path = os.path.join(REPO_CLONES_DIR, repo_name)

        print(f"[Sync Repos] Processing repository: {repo_name}")

        if repo.get("private") and token:
            repo_url = get_authenticated_repo_url(repo_url, token)

        if os.path.exists(repo_path):
            try:
                subprocess.run(["git", "-C", repo_path, "pull"], check=True)
                print(f"[Sync Repos] Pulled updates for {repo_name}")
            except subprocess.CalledProcessError as e:
                print(f"[Sync Repos] Failed to pull updates for {repo_name}: {e}")
        else:
            try:
                subprocess.run(["git", "clone", repo_url, repo_path], check=True)
                print(f"[Sync Repos] Cloned repository: {repo_name}")
            except subprocess.CalledProcessError as e:
                print(f"[Sync Repos] Failed to clone {repo_name}: {e}")

def check_repo_status(repo_name: str):
    """Check the status of a repository."""
    repo_path = os.path.join(REPO_CLONES_DIR, repo_name)
    if not os.path.exists(repo_path):
        raise FileNotFoundError(f"Repository {repo_name} does not exist at {repo_path}")

    try:
        result = subprocess.run(["git", "-C", repo_path, "status"], check=True, capture_output=True, text=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"[Check Repo Status] Failed to check status for {repo_name}: {e}")
        return None