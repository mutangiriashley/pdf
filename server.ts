import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { pipeline, env } from '@xenova/transformers';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';

// Disable local models to force downloading from HF on first run, suppresses some warnings
env.allowLocalModels = false;

// We will use process.env.OPENROUTER_API_KEY instead of hardcoding it

type Chunk = { id: string; text: string; source: string; embedding: number[] };
let vectorDB: Chunk[] = [];

// Model loading state
let globalModelStatus: 'loading' | 'downloading' | 'ready' | 'error' = 'loading';
let globalModelProgress = 0;

const upload = multer({ storage: multer.memoryStorage() });

// Local Embedder Singleton
class Embedder {
    static task = 'feature-extraction' as const;
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance: any = null;

    static async getInstance() {
        if (this.instance === null) {
            console.log("Loading embedding model (this may take a few seconds on first run)...");
            globalModelStatus = 'loading';
            const downloadTracker = new Map<string, { loaded: number, total: number }>();
            
            try {
                this.instance = await pipeline(this.task, this.model, {
                    progress_callback: (data: any) => {
                        if (data.status === 'progress' && data.total) {
                            globalModelStatus = 'downloading';
                            downloadTracker.set(data.file, { loaded: data.loaded, total: data.total });
                            let totalLoaded = 0;
                            let totalSize = 0;
                            downloadTracker.forEach(file => {
                                totalLoaded += file.loaded;
                                totalSize += file.total;
                            });
                            globalModelProgress = totalSize > 0 ? (totalLoaded / totalSize) * 100 : 0;
                        } else if (data.status === 'ready') {
                            globalModelStatus = 'downloading';
                        }
                    }
                });
                globalModelStatus = 'ready';
                globalModelProgress = 100;
                console.log("Embedding model loaded successfully.");
            } catch (err) {
                globalModelStatus = 'error';
                console.error("Model load error:", err);
            }
        }
        return this.instance;
    }
}

async function generateEmbedding(text: string) {
  const extractor = await Embedder.getInstance();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function render_page(pageData: any) {
  const render_options = {
    normalizeWhitespace: false,
    disableCombineTextItems: false
  };
  return pageData.getTextContent(render_options).then(function(textContent: any) {
    let lastY, text = '';
    for (let item of textContent.items) {
      if (lastY == item.transform[5] || !lastY) {
        text += item.str;
      } else {
        text += '\n' + item.str;
      }
      lastY = item.transform[5];
    }
    return `\n[PAGE ${pageData.pageIndex + 1}]\n` + text;
  });
}

async function answerWithOpenRouter(question: string, context: string) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY in environment variables. Please add it to your Railway variables.");
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "PDF ANALYZER"
    },
    body: JSON.stringify({
      model: "google/gemma-2-9b-it:free", // Reliable fast model on OpenRouter
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant answering questions based strictly on the provided handbook context. If the answer is not in the context, say 'I don't know based on the provided handbook.'"
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${question}`
        }
      ]
    })
  });
  
  if (!response.ok) {
    console.error("OpenRouter API Error:", await response.text());
    throw new Error("Failed to fetch response from OpenRouter");
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // Trigger model load eagerly
  Embedder.getInstance().catch(console.error);

  // Endpoint to check model status
  app.get('/api/model-status', (req, res) => {
    res.json({
      status: globalModelStatus,
      progress: globalModelProgress
    });
  });

  app.get('/api/debug', (req, res) => {
    res.json({
      openRouterKeySet: !!process.env.OPENROUTER_API_KEY,
      nodeEnv: process.env.NODE_ENV || 'development',
      vectorDbSize: vectorDB.length
    });
  });

  // Part 1: API Endpoint to upload the handbook, extract text, chunk and embed.
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const startTime = Date.now();
      vectorDB = []; // Clear DB on new upload

      // Extract text from PDF, rendering page markers
      const options = { pagerender: render_page };
      const pdfData = await pdfParse(req.file.buffer, options);

      // Split text by page markers
      const pageTexts = pdfData.text.split(/\[PAGE (\d+)\]/).filter(Boolean);
      
      let rawChunks = [];
      for (let i = 0; i < pageTexts.length; i += 2) {
        const pageNum = pageTexts[i];
        const text = pageTexts[i + 1];
        if (text && text.trim().length > 0) {
          rawChunks.push({
            id: `page_${pageNum}`,
            text: text.trim(),
            source: `Page ${pageNum}`
          });
        }
      }

      // Further split long pages into ~512 character chunks with 100 char overlap
      let finalChunks: { id: string, text: string, source: string }[] = [];
      for (const chunk of rawChunks) {
        const charLimit = 512;
        if (chunk.text.length > charLimit) {
          let start = 0;
          let part = 1;
          while (start < chunk.text.length) {
            finalChunks.push({
              id: `${chunk.id}_part${part}`,
              text: chunk.text.slice(start, start + charLimit),
              source: chunk.source
            });
            start += charLimit - 100; 
            part++;
          }
        } else {
          finalChunks.push(chunk);
        }
      }

      // Generate embeddings and store in vector DB
      for (let i = 0; i < finalChunks.length; i++) {
        const embedding = await generateEmbedding(finalChunks[i].text);
        vectorDB.push({
          ...finalChunks[i],
          embedding
        });
      }

      const latency = Date.now() - startTime;
      res.json({ 
        message: `Extraction complete.`,
        chunks: vectorDB.length,
        latency: latency,
        vectorSize: 384,
        chunkingLogic: '512 chars / 100 overlap'
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Part 2, 3, 5: The API Endpoint to answer questions using JSON and OpenRouter

  // n8n Integration Ready Endpoint
  // Requires standard Bearer Auth (optional in local dev, but strictly supported for prod)
  app.post('/api/n8n/query', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const expectedToken = process.env.N8N_API_KEY || 'development-token';
      
      if (process.env.N8N_API_KEY && authHeader !== `Bearer ${expectedToken}`) {
        return res.status(401).json({ error: "Unauthorized. Invalid Bearer Token." });
      }

      const startTime = Date.now();
      const question = req.body.question || req.body.query;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: "Invalid request. 'question' or 'query' field is required." });
      }

      if (vectorDB.length === 0) {
        return res.status(400).json({ error: "Vector database is empty. Please upload the handbook first." });
      }

      const embedder = await Embedder.getInstance();
      const queryResult = await embedder(question, { pooling: 'mean', normalize: true });
      const queryVector = Array.from(queryResult.data as Float32Array);

      const results = vectorDB.map(chunk => ({
        ...chunk,
        similarity: cosineSimilarity(queryVector, chunk.embedding)
      })).sort((a, b) => b.similarity - a.similarity);

      const topChunks = results.slice(0, 3);
      const contextText = topChunks.map(c => `Source: ${c.source}\n${c.text}`).join("\n\n");

      let answer = "Simulated local answer based on context. (Remove mock for real integration)";
      let source = topChunks.length > 0 ? topChunks[0].source : "Unknown";

      if (process.env.OPENROUTER_API_KEY) {
        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "google/gemma-2-9b-it:free",
            messages: [
              { role: "system", content: "You are a helpful assistant. Answer the user's question based ONLY on the provided context. If you don't know, say 'I don't know'." },
              { role: "user", content: `Context:\n${contextText}\n\nQuestion:\n${question}` }
            ]
          })
        });
        
        if (orRes.ok) {
          const orData = await orRes.json();
          if (orData.choices && orData.choices.length > 0) {
            answer = orData.choices[0].message.content;
          }
        }
      }

      const latency = Date.now() - startTime;

      res.json({
        answer,
        source,
        confidence: `${(topChunks[0].similarity * 100).toFixed(1)}%`,
        latency,
        chunks_analyzed: topChunks.length
      });
    } catch (error: any) {
      console.error("/api/n8n/query error:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

  app.post('/ask', async (req, res) => {
    try {
      const startTime = Date.now();
      const { question } = req.body;
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: "Invalid request. 'question' field is required and must be a string." });
      }

      if (vectorDB.length === 0) {
        return res.status(400).json({ error: "Vector database is empty. Please upload the handbook first via /api/upload." });
      }

      // Step 1: Generate embedding for the question
      const qEmbed = await generateEmbedding(question);

      // Step 2: Search the vector database
      const scored = vectorDB.map(c => ({
        ...c,
        score: cosineSimilarity(qEmbed, c.embedding)
      }));
      
      // Step 3: Retrieve most relevant chunks
      scored.sort((a, b) => b.score - a.score);
      const topChunks = scored.slice(0, 3);
      const context = topChunks.map(c => c.text).join("\n\n---\n\n");
      const source = topChunks.length > 0 ? topChunks[0].source : "Unknown";

      // Step 4: Generate answer using OpenRouter
      const answer = await answerWithOpenRouter(question, context);

      const latency = Date.now() - startTime;
      res.json({ answer, source, latency });
    } catch (error: any) {
      console.error("/ask error:", error);
      res.status(500).json({ error: error.message || "Internal server error." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
