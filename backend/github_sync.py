import subprocess
import os
import git  # Missing import - you need this for git.Repo
from typing import List, Dict

# Directory where repositories are cloned
REPO_BASE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "repo_clones"))

def get_authenticated_repo_url(repo_url: str, token: str) -> str:
    """Modify the repository URL to include authentication."""
    if repo_url.startswith("https://"):
        return repo_url.replace("https://", f"https://{token}@")
    else:
        raise ValueError("Unsupported repository URL format. Only HTTPS is supported for authentication.")

def sync_repos(repo_list: List[dict], github_pat: str):
    """
    Sync repositories with GitHub PAT for authentication
    
    Args:
        repo_list: List of repository dictionaries with name and url
        github_pat: GitHub Personal Access Token for authentication
    """
    os.makedirs(REPO_BASE_PATH, exist_ok=True)

    for repo in repo_list:
        local_path = os.path.join(REPO_BASE_PATH, repo["name"])
        
        # Use the helper function (you defined it but didn't use it)
        repo_url = get_authenticated_repo_url(repo["url"], github_pat)
        
        try:
            if os.path.exists(local_path):
                print(f"Updating {repo['name']}...")
                repo_obj = git.Repo(local_path)
                
                # Update remote URL to use PAT
                origin = repo_obj.remotes.origin
                origin.set_url(repo_url)
                origin.pull()
            else:
                print(f"Cloning {repo['name']}...")
                git.Repo.clone_from(repo_url, local_path)

            print(f"✅ Synced: {repo['name']}")
            
        except Exception as e:
            print(f"❌ Error syncing {repo['name']}: {str(e)}")
            continue

def check_repo_status(repo_name: str):
    """Check the status of a repository."""
    # Fixed: Use REPO_BASE_PATH instead of undefined REPO_CLONES_DIR
    repo_path = os.path.join(REPO_BASE_PATH, repo_name)
    if not os.path.exists(repo_path):
        raise FileNotFoundError(f"Repository {repo_name} does not exist at {repo_path}")

    try:
        result = subprocess.run(["git", "-C", repo_path, "status"], check=True, capture_output=True, text=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"[Check Repo Status] Failed to check status for {repo_name}: {e}")
        return None

if __name__ == "__main__":
    # For testing - get PAT from environment
    import json
    github_pat = os.getenv("GITHUB_PAT")
    if not github_pat:
        raise ValueError("GITHUB_PAT environment variable required")
    
    # Load repositories from config
    with open("repositories.json", "r") as f:
        repositories = json.load(f)
    
    sync_repos(repositories, github_pat)