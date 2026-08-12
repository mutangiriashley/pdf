export type Theme = {
  isDark: boolean;
  app: string;
  nav: string;
  panel: string;
  card: string;
  cardHover: string;
  border: string;
  borderMuted: string;
  textMain: string;
  textHeading: string;
  textMuted: string;
  textHighlight: string;
  accentBg: string;
  accentText: string;
  accentHover: string;
  accentShadow: string;
  dotShadow: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  bubbleUser: string;
  bubbleRag: string;
  badge: string;
  uploadZone: string;
  progressBar: string;
  scrollbarThumb: string;
};

export const getTheme = (isDark: boolean): Theme => ({
  isDark,
  app: isDark ? 'bg-[#050505] text-zinc-300' : 'bg-zinc-50 text-zinc-700',
  nav: isDark ? 'bg-[#0a0a0a] border-zinc-800/50' : 'bg-white border-zinc-200',
  panel: isDark ? 'bg-[#0a0a0a] border-zinc-800/50' : 'bg-white border-zinc-200',
  card: isDark ? 'bg-[#111] border-zinc-700' : 'bg-zinc-50 border-zinc-200',
  cardHover: isDark ? 'hover:border-zinc-500' : 'hover:border-zinc-400',
  border: isDark ? 'border-zinc-800/50' : 'border-zinc-200',
  borderMuted: isDark ? 'border-zinc-800' : 'border-zinc-200',
  textMain: isDark ? 'text-zinc-300' : 'text-zinc-700',
  textHeading: isDark ? 'text-zinc-100' : 'text-zinc-900',
  textMuted: isDark ? 'text-zinc-500' : 'text-zinc-500',
  textHighlight: isDark ? 'text-white' : 'text-black',
  accentBg: isDark ? 'bg-white' : 'bg-black',
  accentText: isDark ? 'text-black' : 'text-white',
  accentHover: isDark ? 'hover:bg-zinc-200' : 'hover:bg-zinc-800',
  accentShadow: isDark ? 'shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'shadow-[0_0_15px_rgba(0,0,0,0.1)] hover:shadow-[0_0_20px_rgba(0,0,0,0.2)]',
  dotShadow: isDark ? 'shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'shadow-[0_0_8px_rgba(0,0,0,0.8)]',
  inputBg: isDark ? 'bg-[#111]' : 'bg-white',
  inputBorder: isDark ? 'border-zinc-700 focus-within:border-white/50 focus-within:ring-white/20' : 'border-zinc-300 focus-within:border-black/50 focus-within:ring-black/20',
  inputText: isDark ? 'text-zinc-200 placeholder:text-zinc-600' : 'text-zinc-800 placeholder:text-zinc-400',
  bubbleUser: isDark ? 'bg-zinc-800/50 border-zinc-700/30' : 'bg-zinc-200 border-zinc-300',
  bubbleRag: isDark ? 'bg-[#111] border-zinc-800/50 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-800',
  badge: isDark ? 'bg-[#111] border-zinc-800 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-600',
  uploadZone: isDark ? 'bg-[#111] border-zinc-700 hover:border-zinc-500' : 'bg-zinc-50 border-zinc-300 hover:border-zinc-400',
  progressBar: isDark ? 'bg-zinc-800' : 'bg-zinc-200',
  scrollbarThumb: isDark ? '#27272a' : '#d4d4d8'
});
