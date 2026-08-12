import fs from 'fs';

let server = fs.readFileSync('server.ts', 'utf8');

const n8nEndpoint = `
  // n8n Integration Ready Endpoint
  // Requires standard Bearer Auth (optional in local dev, but strictly supported for prod)
  app.post('/api/n8n/query', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const expectedToken = process.env.N8N_API_KEY || 'development-token';
      
      if (process.env.N8N_API_KEY && authHeader !== \`Bearer \${expectedToken}\`) {
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
      const contextText = topChunks.map(c => \`Source: \${c.source}\\n\${c.text}\`).join("\\n\\n");

      let answer = "Simulated local answer based on context. (Remove mock for real integration)";
      let source = topChunks.length > 0 ? topChunks[0].source : "Unknown";

      if (process.env.OPENROUTER_API_KEY) {
        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": \`Bearer \${process.env.OPENROUTER_API_KEY}\`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a helpful assistant. Answer the user's question based ONLY on the provided context. If you don't know, say 'I don't know'." },
              { role: "user", content: \`Context:\\n\${contextText}\\n\\nQuestion:\\n\${question}\` }
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
        confidence: \`\${(topChunks[0].similarity * 100).toFixed(1)}%\`,
        latency,
        chunks_analyzed: topChunks.length
      });
    } catch (error: any) {
      console.error("/api/n8n/query error:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });

`;

server = server.replace("  app.post('/ask', async (req, res) => {", n8nEndpoint + "  app.post('/ask', async (req, res) => {");

fs.writeFileSync('server.ts', server);
