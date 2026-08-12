# Neural-Docs RAG Application

A sophisticated, dark-themed Retrieval-Augmented Generation (RAG) application that processes PDF documents entirely locally and uses OpenRouter for generation.

## Features

- **100% Local Embeddings:** Uses Xenova/transformers (all-MiniLM-L6-v2) for in-memory, local vector generation. No data is sent to external APIs during embedding.
- **Sophisticated Dark UI:** Designed with a clean, monochrome aesthetic.
- **Live Metrics:** Real-time polling tracks the Hugging Face model download progress directly in the UI. 
- **Railway Compatible:** Configured for stateful deployments via Railway.

## Requirements

Ensure you have Node.js 18+ installed.

## Setup & Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Start in production:
   ```bash
   npm start
   ```
