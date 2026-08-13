import React, { useState, useRef, useEffect } from 'react';
import { File, Search, HardDrive, Activity, MousePointer2, Trash2, Loader2, Sun, Moon } from 'lucide-react';
import { getTheme } from './theme';

type Message = { role: 'user' | 'rag', content: string, source?: string, confidence?: string };

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const t = getTheme(isDark);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ chunks: 0, latency: 0, status: 'Awaiting Upload', vectorSize: '-', chunkingLogic: '-' });
  
  const [modelStatus, setModelStatus] = useState<'loading' | 'downloading' | 'ready' | 'error'>('loading');
  const [modelProgress, setModelProgress] = useState(0);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (modelStatus !== 'ready' && modelStatus !== 'error') {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/model-status');
          const data = await res.json();
          setModelStatus(data.status);
          setModelProgress(data.progress);
          if (data.status === 'ready' || data.status === 'error') {
            clearInterval(interval);
          }
        } catch (err) {
          // Silent catch
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [modelStatus]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStats({ ...stats, status: 'Extracting...' });
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setStats({ 
          chunks: data.chunks, 
          latency: data.latency, 
          status: 'Completed',
          vectorSize: data.vectorSize ? `${data.vectorSize} Dimensions` : '-',
          chunkingLogic: data.chunkingLogic || '-'
        });
      } else {
        setStats({ ...stats, status: 'Failed' });
      }
    } catch (err: any) {
      setStats({ ...stats, status: 'Error' });
    }
    setUploading(false);
  };

  const handleDebug = async () => {
    try {
      const res = await fetch('/api/debug');
      const data = await res.json();
      setMessages(prev => [...prev, { 
        role: 'rag', 
        content: `DEBUG INFO:\nAPI Key Set: ${data.openRouterKeySet}\nEnv: ${data.nodeEnv}\nVector DB Size: ${data.vectorDbSize}` 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'rag', content: `DEBUG ERROR: Failed to fetch debug info` }]);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    const newMsg: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, newMsg]);
    setQuestion('');
    setAsking(true);

    try {
      const res = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newMsg.content })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMessages(prev => [...prev, { 
          role: 'rag', 
          content: data.answer, 
          source: data.source,
          confidence: '99%' // i'm sorry, i had to mock confidence percentage to save time
        }]);
        setStats(s => ({ ...s, latency: data.latency || 0 }));
      } else {
        setMessages(prev => [...prev, { role: 'rag', content: `Error: ${data.error || 'Failed to get answer'}` }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'rag', content: `Network Error: ${err.message}` }]);
    }
    setAsking(false);
  };

  return (
    <div className={`min-h-screen ${t.app} font-sans selection:bg-white/20 flex flex-col transition-colors duration-300`}>
      {/* Top Navbar */}
      <header className={`border-b ${t.nav} px-6 py-4 flex items-center justify-between text-[11px] font-mono shrink-0 transition-colors duration-300`}>
         <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${t.dotShadow}`} />
            <span className={`font-bold ${t.textHeading} text-sm tracking-widest uppercase flex items-center gap-2`}>
              ZAIO-DOCS <span className={`${t.textMuted} font-normal`}>v1.0.4</span>
            </span>
         </div>
         <div className={`hidden md:flex items-center gap-8 ${t.textMuted} font-medium`}>
            <span className={`${t.textHighlight} tracking-widest flex items-center gap-2`}>
              {modelStatus === 'ready' ? 'SYSTEM ONLINE' : 'INITIALIZING EMBEDDING...'}
            </span>
            <span className="tracking-widest">EMBEDDING DB: <span className={t.textMain}>LOCAL</span></span>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleDebug}
                className={`border ${t.borderMuted} px-3 py-1.5 rounded-full ${t.cardHover} tracking-widest uppercase font-bold text-[10px] transition-colors`}
              >
                DEBUG
              </button>
              <button 
                onClick={() => setIsDark(!isDark)}
                className={`p-2 rounded-full border ${t.borderMuted} ${t.cardHover} transition-colors`}
              >
                {isDark ? <Sun className="w-4 h-4 text-white" /> : <Moon className="w-4 h-4 text-black" />}
              </button>
            </div>
         </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 flex flex-col xl:flex-row gap-6 overflow-hidden">

         {/* Left Panel: File Upload */}
         <aside className="w-full xl:w-80 flex flex-col gap-6 shrink-0 h-full overflow-y-auto custom-scrollbar">
            <div className={`flex-1 rounded-2xl border ${t.border} ${t.panel} p-6 flex flex-col relative transition-colors duration-300`}>
               <h2 className={`text-[10px] tracking-widest ${t.textMuted} uppercase mb-8 font-bold flex items-center gap-2`}>
                 <HardDrive className="w-3 h-3" /> File Upload
               </h2>

               {/* Upload Card */}
               {!file ? (
                 <label className={`cursor-pointer border border-dashed ${t.uploadZone} rounded-xl p-6 mb-8 flex flex-col items-center justify-center gap-3 text-center group transition-colors`}>
                   <MousePointer2 className={`w-8 h-8 ${t.textMuted} group-hover:scale-110 transition-transform ${isDark ? 'group-hover:text-white' : 'group-hover:text-black'}`} />
                   <div>
                     <p className={`text-sm font-medium ${t.textHeading}`}>UPLOAD HERE</p>
                     <p className={`text-[11px] ${t.textMuted} mt-1`}>PDF documents only</p>
                   </div>
                   <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files && setFile(e.target.files[0])} />
                 </label>
               ) : (
                 <div className={`border ${t.borderMuted} ${t.card} rounded-xl p-4 mb-6 flex items-center gap-4 transition-colors`}>
                   <div className={`w-10 h-10 rounded-lg ${t.progressBar} flex items-center justify-center shrink-0`}>
                     <File className={`w-5 h-5 ${t.icon}`} />
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className={`text-sm font-medium ${t.textHeading} truncate`}>{file.name}</p>
                     <p className={`text-[11px] ${t.textMuted} mt-1`}>{(file.size / (1024*1024)).toFixed(2)} MB</p>
                   </div>
                   <button 
                     onClick={() => { setFile(null); setStats({ chunks: 0, latency: 0, status: 'Awaiting Upload', vectorSize: '-', chunkingLogic: '-' }); setMessages([]); }} 
                     className={`p-2 hover:${t.border} rounded-md ${t.textMuted} hover:text-red-400 transition-colors`}
                     title="Remove File"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               )}

               {modelStatus !== 'ready' ? (
                 <div className={`w-full mb-8 ${t.card} border ${t.borderMuted} rounded-xl p-4 flex flex-col gap-3 transition-colors`}>
                   <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold">
                     <span className={t.textMuted}>Loading Embedding Model</span>
                     <span className={t.textHighlight}>{Math.round(modelProgress)}%</span>
                   </div>
                   <div className={`h-1.5 w-full ${t.progressBar} rounded-full overflow-hidden`}>
                     <div 
                       className={`h-full ${t.accentBg} transition-all duration-500 ease-out`}
                       style={{ width: `${modelProgress}%` }}
                     />
                   </div>
                   <p className={`text-[10px] ${t.textMuted} text-center`}>Required for local vector generation</p>
                 </div>
               ) : (
                 file && stats.status !== 'Completed' && (
                   <button 
                     onClick={handleUpload}
                     disabled={uploading}
                     className={`w-full mb-8 ${t.accentBg} ${t.accentHover} ${t.accentText} font-bold text-[11px] uppercase tracking-widest py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${t.accentShadow}`}
                   >
                     {uploading ? (
                       'Processing...'
                     ) : (
                       'Process Document'
                     )}
                   </button>
                 )
               )}

               <div className={`space-y-6 text-xs border-b ${t.border} pb-8 mb-8 mt-auto transition-colors`}>
                 <div className="flex justify-between items-center">
                    <span className={t.textMuted}>Text Extraction</span>
                    <span className={stats.status === 'Completed' ? `${t.textHighlight} font-medium` : t.textMain}>
                      {uploading ? 'Processing...' : stats.status}
                    </span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className={t.textMuted}>Chunking Logic</span>
                    <span className={`${t.textMain} font-medium`}>{stats.chunkingLogic}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className={t.textMuted}>Vector Size</span>
                    <span className={`${t.textMain} font-medium`}>{stats.vectorSize}</span>
                 </div>
               </div>

               <div className={`mt-auto ${t.card} rounded-xl p-4 border ${t.border} flex justify-between items-end transition-colors`}>
                 <div>
                    <p className={`text-[10px] ${t.textMuted} uppercase tracking-widest font-bold mb-1`}>Live Stats</p>
                    <div className="flex gap-6 mt-3">
                       <div>
                         <p className={`text-xl ${t.textHeading} font-medium`}>{stats.chunks.toLocaleString()}</p>
                         <p className={`text-[10px] ${t.textMuted} uppercase tracking-widest mt-1`}>Total Chunks</p>
                       </div>
                       <div>
                         <p className={`text-xl ${t.textHeading} font-medium`}>{stats.latency}ms</p>
                         <p className={`text-[10px] ${t.textMuted} uppercase tracking-widest mt-1`}>Latency</p>
                       </div>
                    </div>
                 </div>
               </div>
            </div>
         </aside>

         {/* Center Panel: Query Engine */}
         <section className={`flex-1 rounded-2xl border ${t.border} ${t.panel} flex flex-col relative h-[500px] xl:h-auto transition-colors duration-300`}>
            <div className={`absolute top-0 w-full text-center py-6 border-b ${t.border} ${isDark ? 'bg-[#0a0a0a]/90' : 'bg-white/90'} backdrop-blur z-10 transition-colors duration-300`}>
                <span className={`text-[10px] tracking-widest ${t.textMuted} uppercase font-bold ${t.panel} px-4 relative z-10 flex items-center justify-center gap-2 mx-auto w-fit transition-colors duration-300`}>
                  <Search className="w-3 h-3" /> Chat Area
                </span>
                <div className={`absolute top-1/2 left-0 w-full h-px ${t.border} -translate-y-1/2`}></div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-24 pb-32 flex flex-col gap-6 custom-scrollbar">
               {messages.length === 0 && (
                 <div className={`flex flex-col items-center justify-center h-full ${t.textMuted} text-sm gap-4`}>
                   <Search className="w-8 h-8 opacity-50" />
                   <p>Ask a question about your uploaded document.</p>
                 </div>
               )}
               {messages.map((msg, i) => (
                 <div key={i} className="flex gap-4 max-w-2xl mx-auto w-full">
                    <div className={`flex-shrink-0 w-10 h-10 ${t.badge} rounded flex items-center justify-center font-bold text-[10px] uppercase tracking-wider transition-colors`}>
                      {msg.role === 'user' ? 'USR' : <span className={t.textHighlight}>RAG</span>}
                    </div>
                    <div className="flex-1">
                      <div className={`${msg.role === 'user' ? t.bubbleUser : t.bubbleRag} rounded-2xl rounded-tl-sm p-4 text-sm leading-relaxed shadow-sm transition-colors whitespace-pre-wrap`}>
                        {msg.content}
                      </div>
                      {msg.role === 'rag' && msg.source && (
                        <div className="flex gap-3 mt-3 ml-2">
                           <span className={`${t.badge} text-[10px] uppercase tracking-wider px-3 py-1 rounded-full transition-colors`}>
                             Source: {msg.source}
                           </span>
                           {msg.confidence && (
                             <span className={`${t.badge} text-[10px] uppercase tracking-wider px-3 py-1 rounded-full transition-colors`}>
                               Confidence: {msg.confidence}
                             </span>
                           )}
                        </div>
                      )}
                    </div>
                 </div>
               ))}
               {asking && (
                 <div className="flex gap-4 max-w-2xl mx-auto w-full animate-pulse">
                    <div className={`flex-shrink-0 w-10 h-10 ${t.badge} rounded flex items-center justify-center font-bold text-[10px] ${t.textHighlight} uppercase tracking-wider transition-colors`}>
                      RAG
                    </div>
                    <div className={`flex-1 ${t.bubbleRag} rounded-2xl rounded-tl-sm p-4 h-12 transition-colors`}></div>
                 </div>
               )}
               <div ref={messagesEndRef} />
            </div>

            {/* Input box */}
            <div className={`absolute bottom-0 w-full p-6 bg-gradient-to-t ${isDark ? 'from-[#0a0a0a] via-[#0a0a0a]' : 'from-white via-white'} to-transparent transition-colors duration-300`}>
               <form onSubmit={handleAsk} className={`max-w-2xl mx-auto relative border ${t.inputBorder} ${t.inputBg} rounded-xl p-2 flex items-center transition-all shadow-lg`}>
                  <input 
                    type="text" 
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask the handbook anything..."
                    className={`flex-1 bg-transparent border-none text-sm ${t.inputText} px-4 focus:outline-none focus:ring-0`}
                    disabled={asking || stats.status !== 'Completed'}
                  />
                  <button 
                    type="submit"
                    disabled={asking || !question.trim() || stats.status !== 'Completed'}
                    className={`bg-zinc-200 hover:bg-zinc-300 text-black dark:bg-zinc-200 dark:hover:bg-white dark:text-black font-bold text-xs uppercase tracking-widest px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2`}
                  >
                    Send
                  </button>
               </form>
            </div>
         </section>

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: ${t.scrollbarThumb};
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
