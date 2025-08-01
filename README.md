---

# Coding-Assistant

Coding-Assistant is a conversational AI-powered tool designed to assist developers with coding-related tasks, including code analysis, debugging, documentation, and providing actionable advice for improvements. The project consists of a frontend user interface and a backend API for handling chat-based interactions.

---

## Features

- **Conversational AI**: Engage in dynamic conversations to get coding assistance.
- **Code Analysis**: Share code snippets and receive insights on functionality, structure, and improvements.
- **Debugging Support**: Identify issues in your code and receive suggestions for fixes.
- **Documentation Generation**: Automatically generate documentation for your project or code snippets.
- **Customizable Context**: Tailor conversations to specific projects using contextual parameters.

---

## Project Structure

### Frontend
- **Framework**: Built with React and Vite for a modern, fast development experience.
- **Styling**: Utilizes CSS and TailwindCSS for responsive and visually appealing designs.
- **Dependencies**:
  - React (`^19.1.0`)
  - TailwindCSS (`^4.1.11`)
  - Vite (`^7.0.4`)
- **Key Files**:
  - `src/App.css`: Contains styling for the application.
  - `package.json`: Defines dependencies and scripts for development and production.

### Backend
- **API Endpoint**: `/chat` endpoint for handling chat-based interactions.
- **Environment Variables**: Configured using `VITE_API_BASE_URL` for API communication.
- **Capabilities**:
  - Processes incoming requests with `project` and `messages` parameters.
  - Returns structured JSON responses for chat interactions.

---

## Installation

### Prerequisites
- Node.js (version >= 14.6)
- npm or yarn package manager

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/coding-assistant.git
   cd coding-assistant
   ```

2. Install dependencies for the frontend:
   ```bash
   cd frontend/chat-ui
   npm install
   ```

3. Install dependencies for the backend:
   ```bash
   cd backend
   npm install
   ```

---

## Development

### Frontend
To start the development server for the frontend:
```bash
cd frontend/chat-ui
npm run dev
```
Access the application at `http://localhost:5174`.

### Backend
Ensure the backend server is running and accessible via the `VITE_API_BASE_URL` defined in the `.env` file.

---

## Build

To build the frontend for production:
```bash
cd frontend/chat-ui
npm run build
```

---

## Usage

1. Start the frontend and backend servers.
2. Open the frontend application in your browser.
3. Interact with the Coding-Assistant to analyze code, debug issues, and generate documentation.

---

## Contributing

We welcome contributions to improve Coding-Assistant! Please follow these steps:
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a detailed description of your changes.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Acknowledgments

- Built with React, Vite, and TailwindCSS.
- Inspired by the need for efficient coding assistance tools.

---