import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Volleyball court coordinate bounds in Scout CSVs
const COURT_MAX_X = 3.6;
const COURT_MAX_Y = 7.2;

// Maps team name patterns to verified ESPN NCAAteam IDs (all HTTP 200 confirmed)
const TEAM_ESPN_IDS = [
  { match: (n) => n.includes('ucsd') || (n.includes('san diego') && n.includes('california')) || n.includes('triton'), id: 28 },
  { match: (n) => n.includes('hawaii') || n.includes('rainbow'), id: 62 },
  { match: (n) => n.includes('long beach') || n.includes('beach'), id: 299 },
  { match: (n) => n.includes('davis') || n.includes('ucd'), id: 302 },
  { match: (n) => n.includes('irvine') || n.includes('uci'), id: 300 },
  { match: (n) => n.includes('riverside') || n.includes('ucr'), id: 27 },
  { match: (n) => n.includes('polytechnic') || n.includes('cal poly'), id: 13 },
  { match: (n) => n.includes('santa barbara') || n.includes('ucsb'), id: 2540 },
  { match: (n) => n.includes('fullerton'), id: 2239 },
  { match: (n) => n.includes('northridge') || n.includes('csun'), id: 2463 },
  { match: (n) => n.includes('bakersfield'), id: 2934 },
  { match: (n) => n.includes('yale'), id: 43 },
  { match: (n) => n.includes('san diego state') || n.includes('sdsu'), id: 21 },
  { match: (n) => (n.includes('san diego') && n.includes('university')) || n.includes('torero'), id: 301 },
  { match: (n) => n.includes('northwestern'), id: 77 },
  { match: (n) => n.includes('northern arizona'), id: 2464 },
  { match: (n) => n.includes('arizona') && !n.includes('state'), id: 12 },
  { match: (n) => n.includes('texas tech'), id: 2641 },
  { match: (n) => n.includes('southern utah'), id: 253 },
  { match: (n) => n.includes('oregon state'), id: 204 },
  { match: (n) => n.includes('boise'), id: 68 },
  { match: (n) => n.includes('new mexico state'), id: 166 },
  { match: (n) => n.includes('eastern washington'), id: 331 },
];

const renderTeamLogo = (teamName, size = 32) => {
  const name = teamName.toLowerCase();
  const entry = TEAM_ESPN_IDS.find(({ match }) => match(name));

  if (entry) {
    return (
      <img
        src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${entry.id}.png`}
        alt={teamName}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, borderRadius: 4 }}
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r="46" fill="#1b2235" stroke="var(--primary-gold)" strokeWidth="2" />
      <text x="50" y="58" fill="white" fontSize="24" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">VS</text>
    </svg>
  );
};


export default function App() {
  // --- DASHBOARD STATE ---
  const [allMatches, setAllMatches] = useState({});
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [searchGameQuery, setSearchGameQuery] = useState('');
  const [visualMode, setVisualMode] = useState('paths'); // 'paths' or 'density'
  
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [filters, setFilters] = useState({
    skill: 'all',
    quality: 'all',
    player: 'all',
    search: ''
  });

  const [tooltip, setTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    event: null
  });

  // --- COLUMN RESIZING STATE & LOGIC ---
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(370);

  // --- THEME STATE ---
  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // --- RESPONSIVE BREAKPOINT STATE ---
  // Tracks whether we're on a wide-enough viewport to apply JS-driven inline grid styles.
  // When false, CSS media queries take full control of the layout.
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth > 1100);
  
  const handleLeftMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // Constraint: left column between 180px and 450px
      const newWidth = Math.max(180, Math.min(450, startWidth + deltaX));
      setLeftWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      window.dispatchEvent(new Event('resize'));
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleRightMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // Constraint: right column between 280px and 550px
      const newWidth = Math.max(280, Math.min(550, startWidth - deltaX));
      setRightWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      window.dispatchEvent(new Event('resize'));
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const [dashboardHeight, setDashboardHeight] = useState(800);
  
  const handleHeightMouseDown = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = dashboardHeight;
    
    const handleMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      // Constraint: dashboard height cannot become shorter than 800px, but can grow longer
      const newHeight = Math.max(800, Math.min(1400, startHeight + deltaY));
      setDashboardHeight(newHeight);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      window.dispatchEvent(new Event('resize'));
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
  };

  // Sync isDesktop whenever the window is resized across the 1100px breakpoint.
  // Dispatches a synthetic resize so the canvas useEffect redraws at the new size.
  useEffect(() => {
    const handleBreakpoint = () => {
      const desktop = window.innerWidth > 1100;
      setIsDesktop(prev => {
        if (prev !== desktop) {
          // Give React one tick to flush the new inline-style (or lack thereof)
          // before telling the canvas to remeasure itself.
          setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        }
        return desktop;
      });
    };
    window.addEventListener('resize', handleBreakpoint);
    return () => window.removeEventListener('resize', handleBreakpoint);
  }, []);

  // --- REFS ---
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  // --- 1. LOAD DATA ON MOUNT ---
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/data/dashboard_data.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAllMatches(data);
        
        // Auto select first match
        const firstId = Object.keys(data)[0];
        if (firstId) {
          setActiveMatchId(firstId);
        }
      } catch (error) {
        console.error("Failed to load dashboard dataset:", error);
      }
    }
    fetchData();
  }, []);

  // --- HELPER STRINGS & VALUES ---
  const activeMatch = allMatches[activeMatchId] || null;
  const activeEvents = activeMatch ? activeMatch.events : [];

  // Get unique players sorted alphabetically for active match
  const uniquePlayers = [...new Set(activeEvents.map(e => e.player_name))]
    .filter(Boolean)
    .sort();

  // Reset local match filters
  const resetFilters = () => {
    setFilters({
      skill: 'all',
      quality: 'all',
      player: 'all',
      search: ''
    });
    setSelectedEvent(null);
  };

  // Run filters on active events
  const filteredEvents = activeEvents.filter(e => {
    if (filters.skill !== 'all' && e.skill?.toLowerCase() !== filters.skill) return false;
    if (filters.player !== 'all' && e.player_name !== filters.player) return false;
    
    if (filters.quality !== 'all') {
      const code = e.evaluation_code;
      if (filters.quality === 'perf' && code !== '#') return false;
      if (filters.quality === 'pos' && code !== '+') return false;
      if (filters.quality === 'ok' && code !== '!') return false;
      if (filters.quality === 'neg' && code !== '-') return false;
      if (filters.quality === 'err' && code !== '=') return false;
    }

    if (filters.search) {
      const nameMatch = e.player_name?.toLowerCase().includes(filters.search);
      const skillTypeMatch = e.skill_type?.toLowerCase().includes(filters.search);
      const evalMatch = e.evaluation?.toLowerCase().includes(filters.search);
      if (!nameMatch && !skillTypeMatch && !evalMatch) return false;
    }

    return true;
  });

  // --- 2. CANVAS DRAWING LIFECYCLE EFFECT ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Fit canvas aspect ratio of court (1:2)
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;

      // Temporarily clear inline width/height to let CSS calculate the natural responsive height
      container.style.width = '';
      container.style.height = '';

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Height is responsive (calc(100% - 135px)), width is height / 2
      const calculatedHeight = rect.height;
      const calculatedWidth = calculatedHeight / 2;

      // Guard: bail out if the container hasn't been laid out yet (e.g. hidden or animating in)
      if (calculatedHeight < 10 || calculatedWidth < 10) return;

      // Enforce explicit pixel styles on container to prevent Safari cross-axis collapse
      container.style.width = `${calculatedWidth}px`;
      container.style.height = `${calculatedHeight}px`;

      canvas.width = calculatedWidth * dpr;
      canvas.height = calculatedHeight * dpr;
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    drawCourt(ctx, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));

    if (visualMode === 'density') {
      drawThermalHeatmap(ctx, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    } else {
      drawEventPaths(ctx, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    }

    if (hoveredEvent) {
      drawHighlightedEventPoint(ctx, hoveredEvent, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1), '#00f2fe');
    }

    if (selectedEvent) {
      drawHighlightedEventPoint(ctx, selectedEvent, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1), '#ffcd00', true);
    }

  }, [filteredEvents, visualMode, selectedEvent, hoveredEvent, leftWidth, rightWidth, dashboardHeight, isDesktop]);

  // --- COURT DRAWING LOGIC ---
  const drawCourt = (ctx, w, h) => {
    const marginX = 16;
    const marginY = 40;
    const cw = w - marginX * 2;
    const ch = h - marginY * 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2.5;

    // Outer Boundaries
    ctx.strokeRect(marginX, marginY, cw, ch);

    // Center Line / Net
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(marginX, h / 2);
    ctx.lineTo(w - marginX, h / 2);
    ctx.stroke();

    // Attack Lines (3m)
    const halfH = ch / 2;
    const attackLineDist = halfH * (3 / 9);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(marginX, h / 2 + attackLineDist);
    ctx.lineTo(w - marginX, h / 2 + attackLineDist);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(marginX, h / 2 - attackLineDist);
    ctx.lineTo(w - marginX, h / 2 - attackLineDist);
    ctx.stroke();

    // DataVolley Grid subdivisions
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;

    // Lanes (Vertical)
    const colW = cw / 3;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(marginX + colW * i, marginY);
      ctx.lineTo(marginX + colW * i, h - marginY);
      ctx.stroke();
    }

    // Zones (Horizontal)
    const rowH = halfH / 3;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(marginX, h / 2 + rowH * i);
      ctx.lineTo(w - marginX, h / 2 + rowH * i);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(marginX, h / 2 - rowH * i);
      ctx.lineTo(w - marginX, h / 2 - rowH * i);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  };

  const drawThermalHeatmap = (ctx, w, h) => {
    const marginX = 16;
    const marginY = 40;
    const cw = w - marginX * 2;
    const ch = h - marginY * 2;

    // Draw Glowing Density Heat Blobs
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w * (window.devicePixelRatio || 1);
    offCanvas.height = h * (window.devicePixelRatio || 1);
    const offCtx = offCanvas.getContext('2d');
    offCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    offCtx.globalCompositeOperation = 'screen';

    filteredEvents.forEach(e => {
      const rawCx = marginX + (e.start_x / COURT_MAX_X) * cw;
      const rawCy = marginY + (e.start_y / COURT_MAX_Y) * ch;
      const cx = Math.max(10, Math.min(w - 10, rawCx));
      const cy = Math.max(10, Math.min(h - 10, rawCy));

      const color = getSkillColorHex(e.skill);
      const radius = 28;

      const grad = offCtx.createRadialGradient(cx, cy, 2, cx, cy, radius);
      grad.addColorStop(0, `${color}88`);
      grad.addColorStop(0.2, `${color}44`);
      grad.addColorStop(1, `${color}00`);

      offCtx.fillStyle = grad;
      offCtx.beginPath();
      offCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      offCtx.fill();
    });

    ctx.drawImage(offCanvas, 0, 0, w, h);
  };

  const drawEventPaths = (ctx, w, h) => {
    const marginX = 16;
    const marginY = 40;
    const cw = w - marginX * 2;
    const ch = h - marginY * 2;

    filteredEvents.forEach(e => {
      const rawCx = marginX + (e.start_x / COURT_MAX_X) * cw;
      const rawCy = marginY + (e.start_y / COURT_MAX_Y) * ch;
      const cx = Math.max(10, Math.min(w - 10, rawCx));
      const cy = Math.max(10, Math.min(h - 10, rawCy));

      const color = getSkillColorHex(e.skill);
      const hasEnd = e.end_x !== null && e.end_y !== null;

      if (hasEnd && (e.skill === 'Serve' || e.skill === 'Attack')) {
        const rawEx = marginX + (e.end_x / COURT_MAX_X) * cw;
        const rawEy = marginY + (e.end_y / COURT_MAX_Y) * ch;
        const ex = Math.max(10, Math.min(w - 10, rawEx));
        const ey = Math.max(10, Math.min(h - 10, rawEy));

        // Path
        ctx.strokeStyle = `${color}99`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Arrow head landing
        drawArrowhead(ctx, cx, cy, ex, ey, 6, color);

        // Contact point
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Contact Dot
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
  };

  const drawArrowhead = (context, fromx, fromy, tox, toy, radius, color) => {
    const angle = Math.atan2(toy - fromy, tox - fromx);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(tox, toy);
    context.lineTo(tox - radius * Math.cos(angle - Math.PI / 6), toy - radius * Math.sin(angle - Math.PI / 6));
    context.lineTo(tox - radius * Math.cos(angle + Math.PI / 6), toy - radius * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fill();
  };

  const drawHighlightedEventPoint = (ctx, e, w, h, borderHex, isPulse = false) => {
    const marginX = 16;
    const marginY = 40;
    const cw = w - marginX * 2;
    const ch = h - marginY * 2;

    const rawCx = marginX + (e.start_x / COURT_MAX_X) * cw;
    const rawCy = marginY + (e.start_y / COURT_MAX_Y) * ch;
    const cx = Math.max(10, Math.min(w - 10, rawCx));
    const cy = Math.max(10, Math.min(h - 10, rawCy));

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = isPulse ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, isPulse ? 9 : 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = getSkillColorHex(e.skill);
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const getSkillColorHex = (skill) => {
    switch (skill?.toLowerCase()) {
      case 'serve': return '#a855f7';
      case 'reception': return '#10b981';
      case 'set': return '#f59e0b';
      case 'attack': return '#f43f5e';
      case 'dig': return '#06b6d4';
      case 'block': return '#0ea5e9';
      default: return '#ffffff';
    }
  };

  // --- 3. INTERACTIVE CANVAS METHODS ---
  const getEventAtPosition = (mouseX, mouseY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const marginX = 16;
    const marginY = 40;
    const cw = w - marginX * 2;
    const ch = h - marginY * 2;

    const hitBox = 10;
    let closest = null;
    let minDist = Infinity;

    filteredEvents.forEach(e => {
      const rawCx = marginX + (e.start_x / COURT_MAX_X) * cw;
      const rawCy = marginY + (e.start_y / COURT_MAX_Y) * ch;
      const cx = Math.max(10, Math.min(w - 10, rawCx));
      const cy = Math.max(10, Math.min(h - 10, rawCy));

      const dist = Math.hypot(mouseX - cx, mouseY - cy);
      if (dist < hitBox && dist < minDist) {
        minDist = dist;
        closest = e;
      }
    });

    return closest;
  };

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const event = getEventAtPosition(mouseX, mouseY);

    if (event) {
      canvas.style.cursor = 'pointer';
      setHoveredEvent(event);
      setTooltip({
        show: true,
        x: e.clientX + 16,
        y: e.clientY - 40,
        event
      });
    } else {
      canvas.style.cursor = 'default';
      setHoveredEvent(null);
      setTooltip(prev => ({ ...prev, show: false }));
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredEvent(null);
    setTooltip(prev => ({ ...prev, show: false }));
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const event = getEventAtPosition(mouseX, mouseY);
    if (event) {
      triggerEventSelection(event);
    }
  };

  const triggerEventSelection = (e) => {
    setSelectedEvent(e);
    
    // Auto-seek video time (3.5 seconds lead context)
    const video = videoRef.current;
    if (video && video.src) {
      const seek = Math.max(0, e.video_time - 3.5);
      video.currentTime = seek;
      video.play();
    }
  };

  // --- VIDEO SHUNTS ---
  const handleVideoSeek = (action) => {
    const video = videoRef.current;
    if (!video || !video.src) return;

    if (action === 'play') {
      if (video.paused) {
        if (selectedEvent) {
          const nextEvent = activeEvents
            .filter(ev => ev.video_time > selectedEvent.video_time)
            .sort((a, b) => a.video_time - b.video_time)[0];
          let clipEndTime = selectedEvent.video_time + 4.5;
          if (nextEvent) {
            const gap = nextEvent.video_time - selectedEvent.video_time;
            if (gap < 12) {
              clipEndTime = nextEvent.video_time + 0.8;
            } else {
              clipEndTime = selectedEvent.video_time + 5.0;
            }
          }
          if (video.currentTime >= clipEndTime - 0.1) {
            video.currentTime = Math.max(0, selectedEvent.video_time - 3.5);
          }
        }
        video.play();
      } else {
        video.pause();
      }
    }
  };

  // --- 4. VIDEO CLIP AUTO-PAUSE & PLAYBACK STATE CONTROLLER ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    const handleTimeUpdate = () => {
      setVideoCurrentTime(video.currentTime);
      
      if (selectedEvent) {
        const nextEvent = activeEvents
          .filter(e => e.video_time > selectedEvent.video_time)
          .sort((a, b) => a.video_time - b.video_time)[0];

        const clipStartTime = Math.max(0, selectedEvent.video_time - 3.5);
        let clipEndTime = selectedEvent.video_time + 4.5;
        if (nextEvent) {
          const gap = nextEvent.video_time - selectedEvent.video_time;
          if (gap < 12) {
            clipEndTime = nextEvent.video_time + 0.8;
          } else {
            clipEndTime = selectedEvent.video_time + 5.0;
          }
        }

        if (video.currentTime >= clipEndTime) {
          video.pause();
          video.currentTime = clipEndTime; // Hold at the exact end of the clip
        }
        
        if (video.currentTime < clipStartTime) {
          video.currentTime = clipStartTime; // Prevent drifting before start
        }
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    // Initial sync
    setIsPlaying(!video.paused);
    setVideoCurrentTime(video.currentTime);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [selectedEvent, activeEvents, activeMatchId]);

  // Format digital timestamp
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Dynamic Clip calculation
  let clipStartTime = 0;
  let clipEndTime = 0;
  let isClipActive = false;
  
  if (selectedEvent) {
    clipStartTime = Math.max(0, selectedEvent.video_time - 3.5);
    const nextEvent = activeEvents
      .filter(e => e.video_time > selectedEvent.video_time)
      .sort((a, b) => a.video_time - b.video_time)[0];

    clipEndTime = selectedEvent.video_time + 4.5;
    if (nextEvent) {
      const gap = nextEvent.video_time - selectedEvent.video_time;
      if (gap < 12) {
        clipEndTime = nextEvent.video_time + 0.8;
      } else {
        clipEndTime = selectedEvent.video_time + 5.0;
      }
    }
    isClipActive = true;
  }

  return (
    <div className="app-container">
      {/* 1. BRAND HEADER */}
      <header>
        <div className="brand">
          {renderTeamLogo('ucsd', 36)}
          <div className="brand-text">
            <h1 id="app-title">UCSD WOMEN'S VOLLEYBALL</h1>
            <div className="brand-subtitle">Interactive Scouter & Analytics Heatmap</div>
          </div>
        </div>

        <div className="header-stats">
          <button
            className="theme-toggle"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
              </svg>
            )}
          </button>
          <div className="stat-item-matchup">
            {activeMatch && (
              <div className="active-logos-container">
                {renderTeamLogo('ucsd', 26)}
                <span className="logo-sep">×</span>
                {renderTeamLogo(activeMatch.opponent, 26)}
              </div>
            )}
            <div className="stat-item" style={{ alignItems: 'flex-end' }}>
              <div className="stat-val" id="active-match-title" style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                {activeMatch ? `vs. ${activeMatch.opponent}` : 'Select Match'}
              </div>
              <div className="stat-lbl">Active Match</div>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-val" id="total-events-badge">
              {filteredEvents.length}
            </div>
            <div className="stat-lbl">Filtered Events</div>
          </div>
        </div>
      </header>

      {/* 2. DASHBOARD BODY GRIDS */}
      <main
        className="dashboard-grid"
        style={isDesktop ? {
          gridTemplateColumns: `${leftWidth}px 8px 1fr 8px ${rightWidth}px`,
          gridTemplateRows: `1fr 8px auto`,
          height: `${dashboardHeight}px`
        } : undefined}
      >
        
        {/* LEFT COLUMN: Match Selector Feed */}
        <section className="panel match-panel">
          <div className="panel-header">
            <div className="panel-title">
              <svg style={{ width: '16px', height: '16px', fill: 'currentColor' }} viewBox="0 0 24 24">
                <path d="M19,19H5V8H19M16,1H8V3H16M19,5H5C3.89,5 3,5.9 3,7V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7A2,2 0 0,0 19,5Z"/>
              </svg>
              Select Match
            </div>
          </div>
          <div className="panel-body">
            <div className="search-box">
              <svg viewBox="0 0 24 24">
                <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
              </svg>
              <input 
                type="text" 
                placeholder="Search opponents..."
                value={searchGameQuery}
                onChange={(e) => setSearchGameQuery(e.target.value)}
              />
            </div>
            
            <div className="game-list scrollable-panel" id="games-list-feed">
              {Object.values(allMatches)
                .filter(m => !searchGameQuery || m.opponent.toLowerCase().includes(searchGameQuery.toLowerCase()))
                .map(m => (
                  <div 
                    key={m.match_id}
                    className={`game-card ${m.match_id === activeMatchId ? 'active' : ''}`}
                    onClick={() => {
                      setActiveMatchId(m.match_id);
                      setSelectedEvent(null);
                      setHoveredEvent(null);
                    }}
                  >
                    <div className="game-card-matchup">
                      {renderTeamLogo('ucsd', 28)}
                      <span className="game-card-vs">VS</span>
                      {renderTeamLogo(m.opponent, 28)}
                    </div>
                    <div className="game-opp">vs. {m.opponent}</div>
                    <div className="game-meta">
                      <span className="game-date">
                        <svg style={{ width: '11px', height: '11px', marginRight: '4px', fill: 'currentColor' }} viewBox="0 0 24 24">
                          <path d="M19,19H5V8H19M16,1H8V3H16M19,5H5C3.89,5 3,5.9 3,7V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7A2,2 0 0,0 19,5Z"/>
                        </svg>
                        {m.date}
                      </span>
                      <span className="game-count">
                        <svg style={{ width: '11px', height: '11px', marginRight: '4px', fill: 'currentColor' }} viewBox="0 0 24 24">
                          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,14.4 18.9,16.5 17.2,18L15.8,16.6C17.2,15.4 18,13.8 18,12A6,6 0 0,0 12,6V4A8,8 0 0,1 12,4M12,8A4,4 0 0,1 16,12C16,13.2 15.5,14.3 14.6,15L13.2,13.6C13.7,13.2 14,12.6 14,12A2,2 0 0,0 12,10V8A4,4 0 0,1 12,8Z"/>
                        </svg>
                        {m.events.length} clips
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
        
        <div className="resize-handle left-handle" onMouseDown={handleLeftMouseDown} />

        {/* CENTER COLUMN: Volleyball Canvas Interactive Scouter Map */}
        <section className="panel court-panel">
          <div className="panel-header">
            <div className="panel-title">
              Interactive Court Map
            </div>

            <div className="court-modes" id="visual-modes">
              <button 
                className={`mode-btn ${visualMode === 'paths' ? 'active' : ''}`} 
                onClick={() => setVisualMode('paths')}
              >
                Vector Paths
              </button>
              <button 
                className={`mode-btn ${visualMode === 'density' ? 'active' : ''}`} 
                onClick={() => setVisualMode('density')}
              >
                Thermal Heatmap
              </button>
            </div>
          </div>
          
          <div className="panel-body">
            <div className="court-area">
              <div className="canvas-container">
                <canvas 
                  ref={canvasRef}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={handleCanvasMouseLeave}
                  onClick={handleCanvasClick}
                />
              </div>
              
              {/* Ultra-compact Premium Court Map Legend Bar */}
              <div className="court-legend-compact">
                <div className="legend-group">
                  <span className="legend-label">COURT SIDES:</span>
                  <span className="legend-pill"><span className="legend-dot home"></span>Home (Bottom)</span>
                  <span className="legend-pill"><span className="legend-dot opp"></span>Opp (Top)</span>
                </div>
                <div className="legend-divider"></div>
                <div className="legend-group">
                  <span className="legend-label">ACTIONS:</span>
                  <span className="legend-pill"><span className="legend-dot serve"></span>Serve</span>
                  <span className="legend-pill"><span className="legend-dot reception"></span>Pass</span>
                  <span className="legend-pill"><span className="legend-dot set"></span>Set</span>
                  <span className="legend-pill"><span className="legend-dot attack"></span>Attack</span>
                  <span className="legend-pill"><span className="legend-dot dig"></span>Dig</span>
                  <span className="legend-pill"><span className="legend-dot block"></span>Block</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        <div className="resize-handle right-handle" onMouseDown={handleRightMouseDown} />

        {/* RIGHT COLUMN: Video Seek and Live Scouter Feed */}
        <section className="panel breakdown-panel">
          <div className="panel-header">
            <div className="panel-title">
              <svg style={{ width: '16px', height: '16px', fill: 'currentColor' }} viewBox="0 0 24 24">
                <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/>
              </svg>
              Video & Breakdown
            </div>
          </div>
          
          <div className="panel-body" style={{ overflow: 'hidden' }}>
            {/* Custom styled video frame card */}
            <div className="video-wrapper">
              {activeMatch && activeMatch.stream_url ? (
                <div style={{ width: '100%', height: '100%' }}>
                  <video 
                    ref={videoRef} 
                    src={activeMatch.stream_url} 
                    playsInline 
                    key={activeMatch.stream_url}
                  />
                </div>
              ) : (
                <div className="video-placeholder">
                  <svg viewBox="0 0 24 24">
                    <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/>
                  </svg>
                  <div>No stream video URL available for this match</div>
                </div>
              )}
            </div>

            {/* Premium Custom Media Controls Overlay */}
            {activeMatch && activeMatch.stream_url && (
              isClipActive ? (
                <div className="custom-media-controls">
                  <div className="clip-info-badge" style={{ color: getSkillColorHex(selectedEvent.skill) }}>
                    <span className="dot" style={{ backgroundColor: getSkillColorHex(selectedEvent.skill) }}></span>
                    {(selectedEvent.skill || 'Play').toUpperCase()} CLIP — {selectedEvent.player_name || 'UCSD Player'}
                  </div>
                  
                  <div className="media-row">
                    <button 
                      className="play-pause-btn" 
                      onClick={() => handleVideoSeek('play')}
                      title={isPlaying ? "Pause" : "Play"}
                      style={{ color: getSkillColorHex(selectedEvent.skill) }}
                    >
                      {isPlaying ? (
                        <svg viewBox="0 0 24 24"><path d="M14,19H18V5H14M6,19H10V5H6V19Z"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24"><path d="M8,5V19L19,12L8,5Z"/></svg>
                      )}
                    </button>
                    
                    <div 
                      className="progress-bar-container"
                      onClick={(e) => {
                        const video = videoRef.current;
                        if (!video) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const percent = (e.clientX - rect.left) / rect.width;
                        const duration = clipEndTime - clipStartTime;
                        video.currentTime = clipStartTime + percent * duration;
                      }}
                    >
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          width: `${Math.min(100, Math.max(0, ((videoCurrentTime - clipStartTime) / (clipEndTime - clipStartTime)) * 100))}%`,
                          backgroundColor: getSkillColorHex(selectedEvent.skill)
                        }}
                      />
                    </div>
                    
                    <div className="clip-time-display">
                      {formatTime(Math.max(0, videoCurrentTime - clipStartTime))} / {formatTime(clipEndTime - clipStartTime)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="custom-media-controls disabled">
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', width: '100%', fontFamily: 'var(--font-mono)' }}>
                    SELECT AN EVENT TO PLAY ITS ISOLATED CLIP
                  </div>
                </div>
              )
            )}

            {/* Scrollable details and list feed */}
            <div className="right-panel-scrollable scrollable-panel" style={{ flex: 1, overflowY: 'auto', marginTop: '12px', paddingRight: '4px' }}>
              {/* Selected Active event cards detail */}
              <div className="active-event-card" style={{ marginTop: 0 }}>
                <div className="event-hero">
                  <span className="event-player-name">
                    {selectedEvent ? (selectedEvent.player_name || 'UCSD Team') : 'Select an event'}
                  </span>
                  <span className={`skill-tag ${selectedEvent && selectedEvent.skill ? `skill-${selectedEvent.skill.toLowerCase()}` : ''}`}>
                    {selectedEvent ? (selectedEvent.skill || 'Play') : 'Skill'}
                  </span>
                </div>

                <div className="event-details-grid">
                  <div className="detail-item">
                    <span className="detail-lbl">Type</span>
                    <span className="detail-val">{selectedEvent ? (selectedEvent.skill_type || 'N/A') : '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-lbl">Quality</span>
                    <span className="detail-val">{selectedEvent ? (selectedEvent.evaluation || 'N/A') : '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-lbl">Score Context</span>
                    <span className="detail-val">
                      {selectedEvent 
                        ? `${selectedEvent.home_score !== null ? selectedEvent.home_score : 0} - ${selectedEvent.visiting_score !== null ? selectedEvent.visiting_score : 0} (Set ${selectedEvent.set_number || 1})`
                        : '—'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-lbl">Timestamp</span>
                    <span className="detail-val">
                      {selectedEvent 
                        ? `${formatTime(selectedEvent.video_time)} (Sec: ${selectedEvent.video_time})` 
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Event logs logs feeds */}
              <div className="logs-container">
                <div className="logs-header">Scouter Logs Feed</div>
                <div className="logs-list">
                  {filteredEvents.slice(0, 100).map((e, index) => (
                    <div 
                      key={index}
                      className={`log-row ${selectedEvent === e ? 'active' : ''}`}
                      onClick={() => triggerEventSelection(e)}
                      onMouseEnter={() => setHoveredEvent(e)}
                      onMouseLeave={() => setHoveredEvent(null)}
                    >
                      <div 
                        className="log-skill-indicator" 
                        style={{ backgroundColor: getSkillColorHex(e.skill) }}
                      />
                      <div className="log-info">
                        <strong>{e.player_name || 'UCSD Team'}</strong> - {e.skill} ({e.evaluation || 'Normal'})
                      </div>
                      <span className="log-time">{formatTime(e.video_time)}</span>
                    </div>
                  ))}
                  
                  {filteredEvents.length > 100 && (
                    <div style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      + {filteredEvents.length - 100} more events (filter to refine)
                    </div>
                  )}

                  {filteredEvents.length === 0 && (
                    <div style={{ padding: '16px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem' }}>
                      No events match filters
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Horizontal drag handle */}
        <div className="resize-handle-horizontal" onMouseDown={handleHeightMouseDown} />

        {/* 3. DYNAMIC FILTER FOOTERS SECTION */}
        <footer className="filters-panel">
          
          {/* Skill Category Pills */}
          <div className="filter-group">
            <div className="filter-lbl">Filter by Action</div>
            <div className="filter-pills">
              {[
                { id: 'all', label: 'All Actions' },
                { id: 'serve', label: 'Serves' },
                { id: 'reception', label: 'Receptions / Passes' },
                { id: 'set', label: 'Sets' },
                { id: 'attack', label: 'Attacks' },
                { id: 'dig', label: 'Digs' },
                { id: 'block', label: 'Blocks' }
              ].map(pill => (
                <button 
                  key={pill.id}
                  className={`pill-btn ${filters.skill === pill.id ? 'active' : ''}`}
                  onClick={() => setFilters(prev => ({ ...prev, skill: pill.id }))}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Level Pills */}
          <div className="filter-group">
            <div className="filter-lbl">Evaluation Quality</div>
            <div className="filter-pills">
              {[
                { id: 'all', label: 'All Grades' },
                { id: 'perf', label: 'Perfect (#)' },
                { id: 'pos', label: 'Positive (+)' },
                { id: 'ok', label: 'OK (!)' },
                { id: 'neg', label: 'Negative (-)' },
                { id: 'err', label: 'Error (=)' }
              ].map(pill => (
                <button 
                  key={pill.id}
                  className={`pill-btn ${filters.quality === pill.id ? 'active' : ''}`}
                  onClick={() => setFilters(prev => ({ ...prev, quality: pill.id }))}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Player Filter */}
          <div className="filter-group">
            <div className="filter-lbl">Active UCSD Player</div>
            <select 
              className="filter-select"
              value={filters.player}
              onChange={(e) => setFilters(prev => ({ ...prev, player: e.target.value }))}
            >
              <option value="all">All UCSD Players</option>
              {uniquePlayers.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Reset Filter Button */}
          <button className="clear-btn" onClick={resetFilters}>
            <svg style={{ width: '14px', height: '14px', fill: 'currentColor' }} viewBox="0 0 24 24">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
            Reset Filters
          </button>

        </footer>

      </main>

      {/* FLOATING HOVER TOOLTIP */}
      {tooltip.show && tooltip.event && (
        <div 
          className="court-tooltip"
          style={{ 
            left: `${tooltip.x}px`, 
            top: `${tooltip.y}px`, 
            opacity: 1,
            pointerEvents: 'none'
          }}
        >
          <div className="tooltip-title">{tooltip.event.player_name || 'UCSD Team'}</div>
          <div className="tooltip-row">
            <span className="tooltip-lbl">Skill:</span>
            <span className="tooltip-val" style={{ color: getSkillColorHex(tooltip.event.skill) }}>{tooltip.event.skill}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-lbl">Details:</span>
            <span className="tooltip-val">{tooltip.event.skill_type || '—'}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-lbl">Quality:</span>
            <span className="tooltip-val">{tooltip.event.evaluation || '—'}</span>
          </div>
          <div className="tooltip-row" style={{ marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '4px' }}>
            <span className="tooltip-lbl">Video Time:</span>
            <span className="tooltip-val">{formatTime(tooltip.event.video_time)}</span>
          </div>
        </div>
      )}

    </div>
  );
}
