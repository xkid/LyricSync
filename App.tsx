import React, { useState, useEffect, useRef } from 'react';
import { fetchLyricsWithGemini } from './geminiService.ts';
import { SongData, PlayerState } from './types.ts';
import LyricLineView from './components/LyricLineView.tsx';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

const App: React.FC = () => {
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=SRSEb_atKcM');
  const [songData, setSongData] = useState<SongData | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>(PlayerState.IDLE);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  
  // API Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');

  const playerRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setShowKeyModal(true);
    }

    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      setIsApiReady(true);
    };

    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.head.appendChild(tag);
    }
  }, []);

  const saveApiKey = () => {
    if (tempKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY', tempKey.trim());
      setApiKey(tempKey.trim());
      setShowKeyModal(false);
      setError(null);
    }
  };

  const extractVideoId = (url: string) => {
    try {
      const match = url.match(/[?&]v=([^&]+)/);
      if (match) return match[1];
      if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split(/[?#]/)[0];
      const parts = url.split('/');
      return parts[parts.length - 1]?.split(/[?#]/)[0];
    } catch (e) {
      return null;
    }
  };

  const startTracking = () => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 100);
  };

  const stopTracking = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url) return;
    
    if (!apiKey) {
      setShowKeyModal(true);
      return;
    }

    if (!isApiReady || !window.YT || !window.YT.Player) {
      setError("YouTube Player is still initializing...");
      return;
    }

    setPlayerState(PlayerState.LOADING);
    setError(null);
    setSongData(null);
    setCurrentTime(0);
    setActiveLineIndex(-1);

    try {
      const videoId = extractVideoId(url);
      if (!videoId) throw new Error("Invalid YouTube URL");

      const data = await fetchLyricsWithGemini(url, apiKey);
      setSongData(data);

      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        playerRef.current.loadVideoById(videoId);
      } else {
        playerRef.current = new window.YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: { autoplay: 1, modestbranding: 1, rel: 0, origin: window.location.origin },
          events: {
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.PLAYING) startTracking();
              else stopTracking();
            },
            onError: () => {
              setError("Video load failed. It might be restricted.");
              setPlayerState(PlayerState.ERROR);
            }
          }
        });
      }
      setPlayerState(PlayerState.PLAYING);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error processing request.');
      setPlayerState(PlayerState.ERROR);
    }
  };

  useEffect(() => {
    if (!songData) return;
    const index = songData.lyrics.findIndex((line, i) => {
      const nextLine = songData.lyrics[i + 1];
      return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
    });
    if (index !== activeLineIndex) setActiveLineIndex(index);
  }, [currentTime, songData, activeLineIndex]);

  useEffect(() => {
    if (activeLineIndex !== -1 && lyricsContainerRef.current) {
      const activeElement = lyricsContainerRef.current.children[activeLineIndex] as HTMLElement;
      if (activeElement) {
        const container = lyricsContainerRef.current;
        container.scrollTo({
          top: activeElement.offsetTop - (container.clientHeight / 2) + (activeElement.clientHeight / 2),
          behavior: 'smooth'
        });
      }
    }
  }, [activeLineIndex]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      {showKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-2">Gemini API Key Required</h2>
            <p className="text-slate-400 mb-6 text-sm">To generate lyrics and translations, please enter your Google Gemini API key. It is saved locally in your browser.</p>
            <input 
              type="password"
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="Enter your API Key"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={saveApiKey}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Save Key & Start
            </button>
            <p className="mt-4 text-[10px] text-center text-slate-500 uppercase tracking-widest">
              Get your key at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-400 hover:underline">ai.google.dev</a>
            </p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 p-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              LyricsSync AI
            </h1>
            <button 
              onClick={() => { setTempKey(apiKey); setShowKeyModal(true); }}
              className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
              title="Change API Key"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex-1 w-full flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube Link"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
            />
            <button
              type="submit"
              disabled={playerState === PlayerState.LOADING || !isApiReady}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {playerState === PlayerState.LOADING ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              {isApiReady ? 'Search & Play' : 'Loading...'}
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-6 p-6">
        <div className="w-full lg:w-[45%] flex flex-col gap-4">
          <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 relative">
            <div id="youtube-player" className="w-full h-full"></div>
            {playerState === PlayerState.IDLE && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-900">
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Paste a YouTube link above to begin.</p>
              </div>
            )}
          </div>

          {songData && (
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800/50">
              <h2 className="text-xl font-bold text-white mb-1">{songData.title}</h2>
              <p className="text-indigo-400 font-medium">{songData.artist}</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-400 text-sm">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {playerState === PlayerState.LOADING && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="text-slate-400 text-center max-w-xs">
                <p className="font-medium text-white mb-1">Gemini is analyzing...</p>
                <p className="text-sm">Identifying lyrics, phonetics, and translations.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 h-[calc(100vh-200px)] min-h-[400px] flex flex-col">
          <div 
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto pr-2 scroll-smooth"
          >
            {songData ? (
              songData.lyrics.map((line, idx) => (
                <LyricLineView 
                  key={`${line.time}-${idx}`} 
                  line={line} 
                  isActive={idx === activeLineIndex}
                />
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 italic">
                {playerState === PlayerState.LOADING ? 'Generating synchronized lyrics...' : 'Lyrics will appear here.'}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="p-4 border-t border-slate-800 text-center text-slate-500 text-xs">
        Powered by Gemini & YouTube API • Built for Music Lovers
      </footer>
    </div>
  );
};

export default App;