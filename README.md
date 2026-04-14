# AI Assistant With MCP Servers

An intelligent AI assistant built with FastAPI, LangChain, and Model Context Protocol (MCP) servers.

## Features

- **Multi-Model Support**: Supports both fast and strong AI models
- **Fallback System**: Automatic fallback to alternative models when needed
- **FastAPI Backend**: High-performance REST API
- **MCP Integration**: Uses Model Context Protocol servers for extended functionality
- **LangChain Powered**: Leverages LangChain for advanced LLM interactions

## Requirements

- Python 3.8+
- FastAPI
- Uvicorn
- LangChain
- OpenAI API credentials

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd AI-Assistant-With-MCP-Servers
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
Create a `.env` file in the root directory with your API keys:
```
OPENAI_API_KEY=your_api_key_here
```

## Usage

Start the FastAPI server:
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## Project Structure

- `main.py` - Main application logic and LLM factory
- `api.py` - FastAPI endpoints
- `ui.py` - User interface components
- `requirements.txt` - Project dependencies
- `result/` - Generated results

## License

MIT
