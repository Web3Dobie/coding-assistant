console.log("API Base URL:", import.meta.env.VITE_API_BASE_URL);
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function sendMessage(project, messages) {
    const response = await fetch(`/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, messages }),
    });

    const data = await response.json();
    return data.response;
}

