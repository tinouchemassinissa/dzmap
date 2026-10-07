import React, { useState, useEffect, useRef } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps';
import { geoCentroid, geoMercator } from 'd3-geo';
import confetti from 'canvas-confetti';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { playCorrectSound, playIncorrectSound, playComboSound, playWinSound } from './audio';
import { ALGERIA_ADMIN_META, WILAYA_DATA } from './data';
import { calculatePoints, generateMultipleChoice, isAnswerCorrect, sanitizePlayerName } from './gameLogic';
import { TRANSLATIONS } from './translations';
import './index.css';

const geoUrl = "/algeria.json";
const WILAYA_NAMES = Object.keys(WILAYA_DATA);

const REGION_VIEWS = {
  "West": { center: [0, 34], zoom: 2 },
  "East": { center: [7, 34], zoom: 2 },
  "North": { center: [3, 36], zoom: 3 },
  "South": { center: [3, 26], zoom: 1.5 },
  "Central": { center: [3, 32], zoom: 2 }
};
const DEFAULT_VIEW = { center: [2.5, 28], zoom: 1.2 };

const GAME_MODES = {
  CLASSIC: { id: 'CLASSIC', title: 'Classic', desc: 'Find the wilaya on the map.' },
  TIME_ATTACK: { id: 'TIME_ATTACK', title: 'Time Attack', desc: '60 seconds. Go fast!' },
  REVERSE: { id: 'REVERSE', title: 'Reverse', desc: 'Map highlights a wilaya. Pick its name.' },
  TRIVIA: { id: 'TRIVIA', title: 'Trivia', desc: 'Wilaya is highlighted. Answer a fact!' },
  STUDY: { id: 'STUDY', title: 'Study Guide', desc: 'Relax, click around, and learn! 📚' },
  REGIONS: { id: 'REGIONS', title: 'Region Explorer', desc: 'Click to learn about Algeria regions! 🧭' }
};

const BADGES = [
  { id: 'classic', icon: '🗺️', label: 'Classic Explorer (Score 200+)' },
  { id: 'speedster', icon: '⏱️', label: 'Speedster (Time Attack 200+)' },
  { id: 'geographer', icon: '📍', label: 'Geographer (Reverse 200+)' },
  { id: 'brainiac', icon: '🧠', label: 'Brainiac (Trivia 200+)' }
];

function App() {
  const [playerName, setPlayerName] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [shake, setShake] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('dzMapTheme');
    if (saved) return saved !== 'light';
    return !window.matchMedia('(prefers-color-scheme: light)').matches;
  });
  const [showLabels, setShowLabels] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [mode, setMode] = useState(GAME_MODES.CLASSIC.id);
  const [lang, setLang] = useState('en');
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  
  const [targetWilaya, setTargetWilaya] = useState("");
  const [options, setOptions] = useState([]);
  const [triviaQuestion, setTriviaQuestion] = useState("");
  const [triviaCorrectAnswer, setTriviaCorrectAnswer] = useState(null);
  
  const [guessedWilayas, setGuessedWilayas] = useState({});
  const [gameOver, setGameOver] = useState(false);
  
  const [currentFact, setCurrentFact] = useState(null);
  
  const [floatingTexts, setFloatingTexts] = useState([]); // Array of floating text objects

  const [unlockedBadges, setUnlockedBadges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [studyData, setStudyData] = useState(null); // Advanced Study Guide Data
  const [mapView, setMapView] = useState(DEFAULT_VIEW);

  const timerRef = useRef(null);
  const scoreRef = useRef(0);

  const fetchLeaderboard = async () => {
    if (!db) {
      setLeaderboard([]);
      return;
    }
    try {
      const q = query(collection(db, "algeria-map-leaderboard"), orderBy("score", "desc"), limit(5));
      const querySnapshot = await getDocs(q);
      const scores = [];
      querySnapshot.forEach((doc) => {
        scores.push({ id: doc.id, ...doc.data() });
      });
      setLeaderboard(scores);
    } catch (e) {
      console.log("Firebase not configured yet");
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('dzMapTheme', 'dark');
    } else {
      document.body.setAttribute('data-theme', 'light');
      localStorage.setItem('dzMapTheme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    // If the event fired before React loaded, it's saved here
    if (window.globalInstallPrompt) {
      setInstallPrompt(window.globalInstallPrompt);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.globalInstallPrompt = e;
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const savedHighScore = localStorage.getItem("algeriaMapHighScore");
    if (savedHighScore) setHighScore(parseInt(savedHighScore, 10));
    
    const savedBadges = JSON.parse(localStorage.getItem("algeriaMapBadges") || "[]");
    setUnlockedBadges(savedBadges);

    fetchLeaderboard();

    const bgMusic = document.getElementById('bg-music');
    const anthemMusic = document.getElementById('anthem-audio');

    if (bgMusic) bgMusic.volume = 0.05;
    if (anthemMusic) {
      anthemMusic.volume = 0.08;
      anthemMusic.onended = () => {
        if (musicPlaying && bgMusic) {
          bgMusic.play().catch(e => console.log(e));
        }
      };
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem("algeriaMapHighScore", score);
    }
    checkBadges(score, mode);
  }, [score, highScore, mode]);

  useEffect(() => {
    if (gameStarted && !gameOver && !currentFact && mode === 'TIME_ATTACK') {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            triggerGameOver(scoreRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [gameStarted, gameOver, currentFact, mode]);

  const checkBadges = (currentScore, currentMode) => {
    if (currentScore >= 200) {
      let badgeId = '';
      if (currentMode === 'CLASSIC') badgeId = 'classic';
      if (currentMode === 'TIME_ATTACK') badgeId = 'speedster';
      if (currentMode === 'REVERSE') badgeId = 'geographer';
      if (currentMode === 'TRIVIA') badgeId = 'brainiac';
      
      if (badgeId && !unlockedBadges.includes(badgeId)) {
        const newBadges = [...unlockedBadges, badgeId];
        setUnlockedBadges(newBadges);
        localStorage.setItem("algeriaMapBadges", JSON.stringify(newBadges));
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.3 }, colors: ['#facc15'] });
        }
      }
    }
  };

  const toggleMusic = () => {
    const bgMusic = document.getElementById('bg-music');
    const anthemMusic = document.getElementById('anthem-audio');
    
    if (musicPlaying) {
      if (bgMusic) bgMusic.pause();
      if (anthemMusic) anthemMusic.pause();
    } else {
      if (anthemMusic && anthemMusic.currentTime > 0 && !anthemMusic.ended) {
        anthemMusic.play().catch(e => console.log(e));
      } else if (bgMusic) {
        bgMusic.play().catch(e => console.log(e));
      }
    }
    setMusicPlaying(!musicPlaying);
  };

  const startGame = () => {
    const finalName = sanitizePlayerName(playerName);
    setPlayerName(finalName);
    setGameStarted(true);
    setScore(0);
    scoreRef.current = 0;
    setStreak(0);
    setLives(3);
    setTimeLeft(60);
    setGuessedWilayas({});
    setGameOver(false);
    setStudyData(null);
    setMapView(DEFAULT_VIEW);
    pickNewTarget({});
    
    // Start the local background music after the user gesture
    const bgMusic = document.getElementById('bg-music');
    if (bgMusic) {
      bgMusic.currentTime = 0;
      bgMusic.play().then(() => setMusicPlaying(true)).catch(e => console.log("Audio block:", e));
    }
  };

  const saveToLeaderboard = async (finalScore) => {
    const cleanName = sanitizePlayerName(playerName);
    const safeScore = Math.max(0, Math.min(50000, Math.round(Number(finalScore) || 0)));
    if (safeScore > 0 && cleanName && db) {
      try {
        await addDoc(collection(db, "algeria-map-leaderboard"), {
          name: cleanName,
          score: safeScore,
          mode: mode,
          date: new Date().toISOString()
        });
        fetchLeaderboard();
      } catch (e) {
        console.log("Firebase error:", e);
      }
    }
  };

  const triggerGameOver = (finalScore) => {
    setGameOver(true);
    saveToLeaderboard(finalScore);
  };

  const pickNewTarget = (currentGuessed) => {
    if (mode === 'STUDY') {
      setTargetWilaya("Click any wilaya to learn! 📚");
      return;
    }

    if (mode === 'REGIONS') {
      setTargetWilaya("Click a wilaya to explore its Region! 🧭");
      return;
    }

    const remaining = WILAYA_NAMES.filter(s => currentGuessed[s] !== "correct");
    if (remaining.length === 0) {
      setTargetWilaya("You Win!");
      playWinSound();
      
      const anthemMusic = document.getElementById('anthem-audio');
      const bgMusic = document.getElementById('bg-music');
      if (bgMusic) bgMusic.pause();
      if (anthemMusic) {
        anthemMusic.currentTime = 0;
        anthemMusic.play().catch(e => console.log(e));
      }
      
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = reducedMotion ? 250 : 3500;
      if (!reducedMotion) {
        const animationEnd = Date.now() + duration;
        const interval = setInterval(function() {
          const remainingMs = animationEnd - Date.now();
          if (remainingMs <= 0) return clearInterval(interval);
          confetti({
            startVelocity: 24,
            spread: 360,
            ticks: 50,
            zIndex: 100,
            particleCount: Math.max(8, Math.round(24 * (remainingMs / duration))),
            origin: { x: Math.random(), y: Math.random() * 0.35 }
          });
        }, 260);
      }

      setTimeout(() => {
        triggerGameOver(scoreRef.current);
      }, duration);
      return;
    }
    const randomState = remaining[Math.floor(Math.random() * remaining.length)];
    setTargetWilaya(randomState);

    if (mode === 'REVERSE') {
      setOptions(generateMultipleChoice(randomState, 'name', WILAYA_DATA, WILAYA_NAMES));
    } else if (mode === 'TRIVIA') {
      const types = ['capital', 'region'];
      const questionType = types[Math.floor(Math.random() * types.length)];
      const correctValue = WILAYA_DATA[randomState][questionType];
      setTriviaQuestion(questionType);
      setTriviaCorrectAnswer(correctValue);
      setOptions(generateMultipleChoice(correctValue, questionType, WILAYA_DATA, WILAYA_NAMES));
    }
  };

  const handleGuess = (guess) => {
    if (gameOver || currentFact || !gameStarted) return;
    const correct = isAnswerCorrect({
      mode,
      guess,
      targetWilaya,
      triviaCorrectAnswer,
    });
    processAnswer(correct, targetWilaya, null);
  };

  const handleGuessMap = (guess, evt) => {
    if (gameOver || currentFact || !gameStarted) return;
    processAnswer(guess === targetWilaya, guess, evt);
  };

  const handleMapClickFinal = (geo, evt) => {
    if (gameOver || currentFact || !gameStarted) return;
    const stateName = geo.properties.name;

    if (mode === 'STUDY') {
      if (WILAYA_NAMES.includes(stateName)) {
        setTargetWilaya(stateName);
        
        const usesOfficialReformSource = WILAYA_DATA[stateName]?.created === 2026;
        const wikiLang = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en';
        setStudyData({
           stateName,
           extract: lang === 'ar' && WILAYA_DATA[stateName]?.fact_ar ? WILAYA_DATA[stateName].fact_ar : lang === 'fr' && WILAYA_DATA[stateName]?.fact_fr ? WILAYA_DATA[stateName].fact_fr : WILAYA_DATA[stateName].fact,
           thumbnail: null,
           sourceType: usesOfficialReformSource ? 'official' : 'wikipedia',
           factStatus: WILAYA_DATA[stateName]?.fact_status,
           url: usesOfficialReformSource
             ? ALGERIA_ADMIN_META.naming_source
             : `https://${wikiLang}.wikipedia.org/wiki/${stateName.replace(/ /g, '_')}_Province`
        });
      }
      return;
    }

    if (mode === 'REGIONS') {
      if (WILAYA_NAMES.includes(stateName)) {
        const region = WILAYA_DATA[stateName].region;
        // Highlight all states in this region
        const newGuessed = {};
        const regionStates = [];
        Object.entries(WILAYA_DATA).forEach(([name, data]) => {
          if (data.region === region) {
            newGuessed[name] = 'correct';
            regionStates.push(name);
          }
        });
        setGuessedWilayas(newGuessed);
        if (REGION_VIEWS[region]) {
          setMapView(REGION_VIEWS[region]);
        }
        
        const regionLabelAr = "الولايات في هذه المجموعة:";
        const regionLabelFr = "Wilayas dans ce groupe :";
        const regionLabelEn = "Wilayas in this group:";
        const disclaimer = lang === 'ar'
          ? "هذه مجموعة تعليمية عامة داخل التطبيق وليست تقسيماً إدارياً رسمياً للجزائر."
          : lang === 'fr'
            ? "Il s'agit d'un regroupement pédagogique de l'application, et non d'une division administrative officielle de l'Algérie."
            : "This is a broad learning group used by the app, not an official Algerian administrative division.";
        const memberNames = regionStates.map((wilaya) => getWilayaDisplayName(wilaya));
        const extractText = lang === 'ar'
          ? `${regionLabelAr} ${memberNames.join('، ')}`
          : lang === 'fr'
            ? `${regionLabelFr} ${memberNames.join(', ')}`
            : `${regionLabelEn} ${memberNames.join(', ')}`;
        const regionTitle = t.regions[region] || region;
        
        setStudyData({
          stateName: `${regionTitle} — ${lang === 'ar' ? 'مجموعة تعليمية' : lang === 'fr' ? 'groupe pédagogique' : 'Learning Region'}`,
          extract: `${extractText} — ${disclaimer}`,
          thumbnail: null,
          sourceType: 'learning-region',
          factStatus: 'learning-group',
          url: ALGERIA_ADMIN_META.ministry_source
        });
      }
      return;
    }

    if (mode === 'REVERSE' || mode === 'TRIVIA') return;
    
    if (guessedWilayas[stateName] === "correct" || !WILAYA_NAMES.includes(stateName)) return;

    handleGuessMap(stateName, evt);
  };

  const processAnswer = (isCorrect, stateName, evt) => {
    if (isCorrect) {
      playCorrectSound();
      const newGuessed = { ...guessedWilayas, [stateName]: "correct" };
      setGuessedWilayas(newGuessed);
      
      const newStreak = streak + 1;
      setStreak(newStreak);
      
      const points = calculatePoints(newStreak);
      const newScore = scoreRef.current + points;
      scoreRef.current = newScore;
      setScore(newScore);
      if (mode === 'TIME_ATTACK') setTimeLeft(prev => prev + 2 + Math.floor(newStreak / 3));
      
      if (newStreak >= 3) {
        setShake(true);
        playComboSound(newStreak);
        setTimeout(() => setShake(false), 400);
      }
      
      // Floating Combo Text
      if (evt && evt.clientX) {
        const id = Date.now();
        const x = evt.clientX;
        const y = evt.clientY - 20;
        setFloatingTexts(prev => [...prev, { id, text: `+${points}`, combo: newStreak >= 3 ? newStreak : null, x, y }]);
        setTimeout(() => setFloatingTexts(prev => prev.filter(f => f.id !== id)), 1500);
      }
      
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        confetti({
          particleCount: Math.min(100, 36 + (newStreak * 6)),
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#22c55e', '#ffffff', '#3b82f6', '#facc15']
        });
      }

      if (mode === 'TIME_ATTACK') {
        setCurrentFact(null);
        setTimeout(() => pickNewTarget(newGuessed), 120);
      } else {
        setCurrentFact({
          state: stateName,
          text: lang === 'ar' && WILAYA_DATA[stateName]?.fact_ar ? WILAYA_DATA[stateName].fact_ar : lang === 'fr' && WILAYA_DATA[stateName]?.fact_fr ? WILAYA_DATA[stateName].fact_fr : WILAYA_DATA[stateName].fact,
          pointsEarned: points
        });
      }

    } else {
      playIncorrectSound();
      setStreak(0);
      if (mode !== 'REVERSE' && mode !== 'TRIVIA') {
        setGuessedWilayas(prev => ({ ...prev, [stateName]: "incorrect" }));
      }
      
      if (mode === 'TIME_ATTACK') {
        setTimeLeft(prev => Math.max(0, prev - 5));
      } else {
        setLives(prev => {
          const newLives = prev - 1;
          if (newLives <= 0) triggerGameOver(scoreRef.current);
          return newLives;
        });
      }

      if (mode !== 'REVERSE' && mode !== 'TRIVIA') {
        setTimeout(() => {
          setGuessedWilayas(prev => {
            const updated = { ...prev };
            if (updated[stateName] === "incorrect") delete updated[stateName];
            return updated;
          });
        }, 800);
      }
    }
  };

  const closeFactAndNext = () => {
    setCurrentFact(null);
    pickNewTarget(guessedWilayas);
  };

  const handleInstallClick = async () => {
    if (!installPrompt) {
      setShowInstallGuide(true);
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const getWilayaDisplayName = (wilayaName) => {
    if (!wilayaName || !WILAYA_DATA[wilayaName]) return wilayaName;
    if (lang === 'ar' && WILAYA_DATA[wilayaName].name_ar) return WILAYA_DATA[wilayaName].name_ar;
    if (lang === 'fr' && WILAYA_DATA[wilayaName].name_fr) return WILAYA_DATA[wilayaName].name_fr;
    return wilayaName;
  };

  return (
    <div className={`game-wrapper ${shake ? 'combo-shake' : ''} ${lang === 'ar' ? 'rtl-layout' : ''}`}>
      {/* Removed Audio Elements from here since they exist in index.html */}
      {!gameStarted ? (
        <div className="game-container home-screen">
          <button className="icon-btn about-btn" onClick={() => setShowAbout(true)} title="About Algeria Wilaya Explorer" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 100 }}>
            ℹ️
          </button>
          <button className="icon-btn" onClick={() => setIsDarkMode(!isDarkMode)} title="Toggle Theme" style={{ position: 'absolute', top: '20px', left: '70px', zIndex: 100 }}>
            {isDarkMode ? "☀️" : "🌙"}
          </button>
          <button className="icon-btn music-toggle" onClick={toggleMusic} title="Toggle Music">
            {musicPlaying ? "🔊" : "🔇"}
          </button>
          <div className="language-switcher">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
            <button className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLang('fr')}>FR</button>
            <button className={`lang-btn ${lang === 'ar' ? 'active' : ''}`} onClick={() => setLang('ar')}>AR</button>
          </div>

          {showAbout && (
            <div className="overlay" style={{ zIndex: 2000 }}>
              <div className="glass-panel modal" style={{ maxWidth: '500px' }}>
                <h2 className="title" style={{ fontSize: '2rem', marginBottom: '1rem' }}>About</h2>
                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '1.1rem', lineHeight: '1.5' }}>
                  <div><strong>Author:</strong> Massinissa TINOUCHE</div>
                  <div><strong>Address:</strong> Algeria</div>
                  <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: '4px solid var(--accent-blue)' }}>
                    <strong>Algeria Wilaya Explorer</strong> is an interactive educational PWA designed to help students learn about Algeria's {ALGERIA_ADMIN_META.official_wilaya_count} current wilayas, their capitals, and broad learning regions. The current legal structure contains {ALGERIA_ADMIN_META.official_wilaya_count} wilayas and {ALGERIA_ADMIN_META.official_commune_count} communes; the 2026 transition of responsibilities continues through 31 December 2026. Play offline, earn badges, and compete on the global leaderboard!
                  </div>
                </div>
                <button className="btn-primary" onClick={() => setShowAbout(false)} style={{ marginTop: '2rem' }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {showInstallGuide && (
            <div className="overlay" style={{ zIndex: 2000 }}>
              <div className="glass-panel modal" style={{ maxWidth: '400px', textAlign: 'left' }}>
                <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>How to Install</h2>
                <p style={{ marginBottom: '1rem', lineHeight: '1.5' }}>
                  Your browser doesn't support automatic installation. To install this app:
                </p>
                <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem', lineHeight: '1.5' }}>
                  <li><strong>iPhone / iPad (Safari):</strong> Tap the <strong>Share</strong> button at the bottom of the screen, then tap <strong>Add to Home Screen</strong>.</li>
                  <li><strong>Android (Firefox):</strong> Tap the three dots menu, then tap <strong>Install</strong>.</li>
                  <li><strong>Desktop:</strong> Look for the install icon 💻 in your URL bar!</li>
                </ul>
                <button className="btn-primary" onClick={() => setShowInstallGuide(false)}>Got it!</button>
              </div>
            </div>
          )}

        <main className="glass-panel home-panel">
          <div className="mascot"><img src="/pwa-512x512.png" alt="Icon" width="48" height="48" style={{ borderRadius: '50%' }} /></div>
          <h1 className="title">{t.title}</h1>
          
          <input 
            type="text" 
            className="player-input" 
            placeholder="Enter your name..." 
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          <h3 style={{ marginTop: '0.5rem' }}>{t.selectGameMode}</h3>
          <div className="mode-grid">
            {Object.values(GAME_MODES).map(m => (
              <button
                type="button"
                key={m.id}
                className={`mode-card ${mode === m.id ? 'active' : ''}`}
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
              >
                <div className="mode-title">{t.modes[m.id]}</div>
                <div className="mode-desc">{t.modeDescriptions[m.id]}</div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-primary" onClick={startGame}>
              {t.letsPlay}
            </button>
            
            <button className="btn-primary" style={{ background: '#10b981' }} onClick={handleInstallClick}>
              {t.installApp}
            </button>
          </div>
          <div className="admin-update-note">
            <strong>2026 administrative update:</strong> {ALGERIA_ADMIN_META.official_wilaya_count} wilayas and {ALGERIA_ADMIN_META.official_commune_count} communes under Law 26-06. New-wilaya responsibilities transition through 31 Dec 2026.
          </div>

          <div className="badges-container">
            {BADGES.map(b => (
              <div key={b.id} className={`badge ${unlockedBadges.includes(b.id) ? 'unlocked' : ''}`} title={b.label}>
                {b.icon}
              </div>
            ))}
          </div>

          {leaderboard.length > 0 && (
            <div style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', width: '100%' }}>
              <h3 style={{ color: '#facc15', marginBottom: '0.5rem' }}>{t.globalLeaderboard}</h3>
              {leaderboard.map((entry, i) => (
                <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '0.2rem 0' }}>
                  <span>{i + 1}. {entry.name} <span style={{opacity:0.5}}>({entry.mode})</span></span>
                  <span style={{ fontWeight: 'bold' }}>{entry.score} {t.pts}</span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      ) : (
      <div className={`game-container ${lang === 'ar' ? 'rtl-layout' : ''}`}>
        <button className="icon-btn home-btn" onClick={() => setGameStarted(false)} title={t.backToMenu} aria-label={t.backToMenu}>
          🏠
        </button>
        <button
          className="icon-btn theme-toggle"
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? "Light theme" : "Dark theme"}
          aria-label={isDarkMode ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDarkMode ? "☀️" : "🌙"}
        </button>
        <button className="icon-btn music-toggle" onClick={toggleMusic} title="Toggle Music" aria-pressed={musicPlaying}>
          {musicPlaying ? "🔊" : "🔇"}
        </button>
        {mode === 'STUDY' && (
          <button className="icon-btn labels-toggle" onClick={() => setShowLabels(!showLabels)} title="Toggle Labels" aria-pressed={showLabels}>
            🏷️
          </button>
        )}
        <div className="language-switcher">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
            <button className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLang('fr')}>FR</button>
            <button className={`lang-btn ${lang === 'ar' ? 'active' : ''}`} onClick={() => setLang('ar')}>AR</button>
        </div>
      <div className="header">
        <div className="title-container">
          <span className="mascot"><img src="/pwa-512x512.png" alt="Icon" width="40" height="40" style={{ borderRadius: '50%' }} /></span>
          <h1 className="title" style={{ fontSize: '2.5rem' }}>
            {playerName === 'Explorer' ? t.explorersChallenge : `${playerName}'s Challenge!`}
          </h1>
        </div>
        
        <div className="glass-panel" style={{ padding: '0.5rem', gap: '1rem' }}>
          <div className="stat-box">
            <span className="stat-label">{t.score}</span>
            <span className="stat-value">⭐ {score}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">{t.streak}</span>
            <span className={`stat-value ${streak >= 3 ? 'streak-text' : ''}`}>🔥 x{streak}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">{mode === 'TIME_ATTACK' ? 'Time' : t.lives}</span>
            <span className={`stat-value ${mode === 'TIME_ATTACK' && timeLeft <= 10 ? 'streak-text' : ''}`} style={mode==='TIME_ATTACK' && timeLeft<=10 ? {color:'#ef4444'}:{}}>
              {mode === 'TIME_ATTACK' ? `${timeLeft}s ⏳` : "❤️".repeat(Math.max(0, lives))}
            </span>
          </div>
        </div>

        {!gameOver && !currentFact && (
          <div className="target-state-display">
            <span className="target-label">
              {mode === 'REVERSE' ? t.prompts.reverse :
               mode === 'TRIVIA' ? (triviaQuestion === 'capital' ? t.prompts.triviaCapital : t.prompts.triviaRegion) :
               mode === 'STUDY' ? t.prompts.study :
               t.prompts.default}
            </span>
            <div className="target-name" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* No flags for wilayas */}
              <span className={targetWilaya === "Game Over" ? "game-over-text" : targetWilaya === "You Win!" ? "win-text" : "target-wilaya"}>
                {mode === 'REVERSE' || mode === 'TRIVIA' ? "???" : 
                 targetWilaya === "Game Over" || targetWilaya === "You Win!" ? targetWilaya : getWilayaDisplayName(targetWilaya)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="map-container">
        <ComposableMap projection={geoMercator().scale(1200).center([2.5, 28]).translate([400, 300])} className="main-map-svg" width={800} height={600}>
          <defs>
            <pattern id="algeria-flag" patternUnits="userSpaceOnUse" width="800" height="600">
              <image href="https://upload.wikimedia.org/wikipedia/commons/7/77/Flag_of_Algeria.svg" width="800" height="600" preserveAspectRatio="xMidYMid slice" />
            </pattern>
          </defs>
          <ZoomableGroup className="rsm-zoomable-group" zoom={mapView.zoom} center={mapView.center} filterZoomEvent={() => false}>
            <Geographies geography={geoUrl}>
              {({ geographies }) => (
                <g className={shake ? "map-glow" : ""}>
                  {geographies.map((geo) => {
                    const stateName = geo.properties.name;
                    const status = guessedWilayas[stateName];
                    let className = "state-path";
                    
                    if (status === "correct" && mode !== 'REGIONS') className += " correct";
                    if (status === "incorrect") className += " incorrect";
                    
                    if (WILAYA_DATA[stateName]) {
                      const region = WILAYA_DATA[stateName].region;
                      if (!status || mode === 'REGIONS') {
                         className += ` region-${region}`;
                      }
                      
                      if (mode === 'REGIONS') {
                        // Highlight effect when a region is actively selected
                        const isAnySelected = Object.keys(guessedWilayas).length > 0;
                        if (status === "correct") {
                          className += " active-region";
                        } else if (isAnySelected) {
                          className += " region-faded";
                        }
                      }
                    }
                    
                    if ((mode === 'REVERSE' || mode === 'TRIVIA') && stateName === targetWilaya && !currentFact) {
                      className += " target-highlight";
                    }

                    if (targetWilaya === "You Win!") {
                      className = "state-path win-animation";
                    }

                    if (Object.keys(guessedWilayas).filter(k => guessedWilayas[k] === "correct").length === WILAYA_NAMES.length) {
                      className += " win-flag";
                    }

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        className={className}
                        onClick={(evt) => handleMapClickFinal(geo, evt)}
                        onKeyDown={(evt) => {
                          if (evt.key === 'Enter' || evt.key === ' ') {
                            evt.preventDefault();
                            handleMapClickFinal(geo, evt);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${getWilayaDisplayName(stateName)} wilaya`}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none" },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })}
                  {geographies.map((geo) => {
                    const centroid = geoCentroid(geo);
                    const stateName = geo.properties.name;
                    // Render labels for highlighted states in REGIONS mode, or in STUDY mode if toggled
                    const shouldShowLabel = (mode === 'REGIONS' && guessedWilayas[stateName] === "correct") || (mode === 'STUDY' && showLabels);
                    
                    if (shouldShowLabel) {
                      return (
                        <Marker key={`${geo.rsmKey}-marker`} coordinates={centroid} style={{ pointerEvents: "none" }}>
                          <text y="2" fontSize={4} textAnchor="middle" fill="#fff" style={{ fontWeight: 'bold', textShadow: '0.5px 0.5px 1px #000, -0.5px -0.5px 1px #000' }}>
                            {getWilayaDisplayName(stateName)}
                          </text>
                        </Marker>
                      );
                    }
                    return null;
                  })}
                </g>
              )}
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {floatingTexts.map(ft => (
          <div key={ft.id} className="floating-text" style={{ left: ft.x, top: ft.y }}>
            {ft.text}
            {ft.combo && <span className="floating-combo">Combo x{ft.combo}! 🔥</span>}
          </div>
        ))}
      </div>

      {!gameOver && !currentFact && (mode === 'REVERSE' || mode === 'TRIVIA') && (
        <div className="options-grid">
          {options.map((opt, i) => (
            <button key={i} className="option-btn" onClick={() => handleGuess(opt)}>
              {mode === 'REVERSE'
                ? getWilayaDisplayName(opt)
                : triviaQuestion === 'region'
                  ? (t.regions[opt] || opt)
                  : opt}
            </button>
          ))}
        </div>
      )}

      {currentFact && (
        <div className="overlay">
          <div className="glass-panel modal">
            <h2 className="title" style={{ fontSize: '2.5rem' }}>{t.awesome}</h2>
            <div style={{ color: '#22c55e', fontSize: '1.2rem', fontWeight: 'bold' }}>
              {currentFact.pointsEarned > 0 ? `+${currentFact.pointsEarned} ${t.points}` : t.factUnlocked}
            </div>
            <div className="fact-box">
              <div className="fact-title">
                {t.didYouKnow} {getWilayaDisplayName(currentFact.state)}?
              </div>
              <div className="fact-text">
                {lang === 'ar' && WILAYA_DATA[currentFact.state]?.fact_ar ? WILAYA_DATA[currentFact.state].fact_ar : lang === 'fr' && WILAYA_DATA[currentFact.state]?.fact_fr ? WILAYA_DATA[currentFact.state].fact_fr : currentFact.text}
              </div>
            </div>
            <button className="btn-primary" onClick={closeFactAndNext}>
              {t.nextWilaya}
            </button>
          </div>
        </div>
      )}

      {studyData && (
        <div className={mode === 'REGIONS' ? 'transparent-overlay' : 'overlay'} style={mode === 'REGIONS' ? { pointerEvents: 'none' } : { alignItems: 'flex-start', paddingTop: '5vh' }}>
          <div className="glass-panel modal" style={mode === 'REGIONS' ? { position: 'absolute', bottom: '2rem', right: '2rem', width: '380px', maxWidth: '90vw', animation: 'floatUp 0.3s ease-out', pointerEvents: 'auto', padding: '1.5rem' } : { maxWidth: '700px', animation: 'floatUp 0.3s ease-out', pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="title" style={{ fontSize: mode === 'REGIONS' ? '1.8rem' : '2.5rem', margin: 0 }}>
                {getWilayaDisplayName(studyData.stateName)}
              </h2>
              <button onClick={() => {
                setStudyData(null);
                if (mode === 'REGIONS') {
                  setGuessedWilayas({});
                  setMapView(DEFAULT_VIEW);
                }
              }} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '2rem', cursor: 'pointer' }}>✖</button>
            </div>
            
            {studyData.loading ? (
              <div style={{ padding: '3rem', color: '#94a3b8' }}>Loading learning information... 📚</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  {studyData.thumbnail && (
                    <img src={studyData.thumbnail} alt={studyData.stateName} style={{ width: '150px', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.2)' }} />
                  )}
                  {WILAYA_DATA[studyData.stateName] && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div className="stat-label">{t.capital} <span className="stat-value" style={{ fontSize: '1.2rem' }}>{lang === 'ar' ? WILAYA_DATA[studyData.stateName].name_ar : WILAYA_DATA[studyData.stateName].capital}</span></div>
                      <div className="stat-label">{t.region} <span className="stat-value" style={{ fontSize: '1.2rem' }}>{t.regions[WILAYA_DATA[studyData.stateName].region] || WILAYA_DATA[studyData.stateName].region}</span></div>
                    </div>
                  )}
                </div>
                
                <div className="fact-box" style={{ fontSize: mode === 'REGIONS' ? '0.9rem' : '1.1rem', lineHeight: mode === 'REGIONS' ? '1.4' : '1.6', maxHeight: '30vh', overflowY: 'auto' }}>
                  {mode !== 'REGIONS' && WILAYA_DATA[studyData.stateName] ? (lang === 'ar' && WILAYA_DATA[studyData.stateName]?.fact_ar ? WILAYA_DATA[studyData.stateName].fact_ar : lang === 'fr' && WILAYA_DATA[studyData.stateName]?.fact_fr ? WILAYA_DATA[studyData.stateName].fact_fr : studyData.extract) : studyData.extract}
                </div>
                {studyData.factStatus === 'legacy-local-fact' && (
                  <div className="fact-source-status">
                    {lang === 'ar'
                      ? 'معلومة تعليمية قديمة داخل التطبيق؛ مراجعة المصدر التفصيلية ما زالت مطلوبة.'
                      : lang === 'fr'
                        ? 'Fait pédagogique hérité : une vérification source par source reste à faire.'
                        : 'Legacy learning fact: source-by-source verification is still pending.'}
                  </div>
                )}
                
                {studyData.url && (
                  <a href={studyData.url} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center', background: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>📖</span> {studyData.sourceType === 'official' || studyData.sourceType === 'learning-region' ? t.officialSource : t.readMoreWiki}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {gameOver && (
        <div className="overlay">
          <div className="glass-panel modal">
            <div className="mascot">{(mode === 'TIME_ATTACK' ? timeLeft <= 0 : lives <= 0) ? "😢" : "🏆"}</div>
            <h2 className="title" style={{ fontSize: '3.5rem' }}>
              {(mode === 'TIME_ATTACK' ? timeLeft <= 0 : lives <= 0) ? t.gameOver : t.youWin}
            </h2>
            <div className="stat-box" style={{ margin: '1rem 0' }}>
              <span className="stat-label">{t.finalScore}</span>
              <span className="stat-value" style={{ fontSize: '3rem' }}>⭐ {score}</span>
            </div>
            
            {leaderboard.length > 0 && (
              <div style={{ margin: '1rem 0', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', width: '100%' }}>
                <h3 style={{ color: '#facc15', marginBottom: '0.5rem' }}>🌍 {t.topPlayers}</h3>
                {leaderboard.slice(0,3).map((entry, i) => (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '0.2rem 0' }}>
                    <span>{i + 1}. {entry.name}</span>
                    <span style={{ fontWeight: 'bold' }}>{entry.score} {t.pts}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-primary" onClick={() => setGameStarted(false)}>
              {t.backToMenu} ↩️
            </button>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
}

export default App;
