import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, CartesianGrid, Legend, ScatterChart, Scatter, ZAxis } from "recharts";

const COLORS = {
  bg: '#0a0e17', card: '#111827', border: '#1e293b',
  accent: '#10b981', red: '#ef4444', yellow: '#f59e0b', blue: '#3b82f6', purple: '#8b5cf6',
  text: '#e2e8f0', muted: '#64748b', dim: '#334155',
  win: '#10b981', loss: '#ef4444'
};

const TIER_COLORS = { S: '#f59e0b', A: '#8b5cf6', B: '#3b82f6', C: '#64748b', X: '#ef4444' };

// Load trades from PNL_ANALYTICS localStorage
function loadTrades() {
  try {
    const raw = localStorage.getItem('mchpai_pnl_analytics_v1');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

// Demo data for when no real data exists
function demoData() {
  const reasons = ['take_profit','trail_stop','hard_stop','fast_loss','emergency_time','mcts','momentum','ladder_50pct','ladder_100pct'];
  const tiers = ['S','A','B'];
  const regimes = ['EUPHORIA','ROTATION','FEAR'];
  const trades = [];
  for (let i = 0; i < 200; i++) {
    const win = Math.random() > 0.25;
    const grossPnl = win ? (Math.random() * 150 + 5) : -(Math.random() * 40 + 2);
    const conf = 0.35 + Math.random() * 0.55;
    trades.push({
      ts: Date.now() - (200-i) * 180000,
      sym: 'TOKEN' + Math.floor(Math.random()*999),
      grossPnl, netPnl: grossPnl - (grossPnl > 0 ? 12 : 8),
      pnlSOL: grossPnl * 0.005 * (0.5 + Math.random()),
      netSOL: (grossPnl - 10) * 0.005 * (0.5 + Math.random()),
      win, sizeSol: 0.02 + Math.random() * 0.08,
      holdSecs: 10 + Math.random() * 300,
      reason: reasons[Math.floor(Math.random()*reasons.length)],
      walletTier: tiers[Math.floor(Math.random()*tiers.length)],
      walletRank: Math.floor(Math.random()*100)+1,
      confidence: conf, rugProb: Math.random()*0.3, pumpScore: 0.4+Math.random()*0.5,
      regimeAtEntry: regimes[Math.floor(Math.random()*regimes.length)],
      peakRunup: grossPnl > 0 ? grossPnl * (1 + Math.random()) : Math.random()*20,
      peakDrawdown: -(Math.random()*30), partialSells: Math.random()>0.7?1:0,
      partialSOL: Math.random()>0.7 ? Math.random()*0.01 : 0, copyDelay: Math.floor(Math.random()*6),
      pool: Math.random()>0.3?'pump':'pump-amm'
    });
  }
  return trades;
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '14px 18px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: COLORS.dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function categorizeReason(reason) {
  if (!reason) return 'unknown';
  if (reason.includes('take_profit')) return 'Take Profit';
  if (reason.includes('trail') || reason.includes('smart_trail')) return 'Trail Stop';
  if (reason.includes('hard_stop')) return 'Hard Stop';
  if (reason.includes('fast_loss')) return 'Fast Loss';
  if (reason.includes('emergency_time')) return 'Time Exit';
  if (reason.includes('ladder')) return 'Ladder TP';
  if (reason.includes('mcts')) return 'MCTS';
  if (reason.includes('rl_exit')) return 'RL Agent';
  if (reason.includes('momentum')) return 'Momentum';
  if (reason.includes('liquidity')) return 'Liquidity';
  if (reason.includes('migration')) return 'Migration Arb';
  if (reason.includes('mirror')) return 'Mirror Exit';
  if (reason.includes('manual')) return 'Manual';
  if (reason.includes('safety') || reason.includes('honeypot') || reason.includes('rugcheck')) return 'Safety';
  return 'Other';
}

export default function Dashboard() {
  const [trades, setTrades] = useState([]);
  const [isDemo, setIsDemo] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const real = loadTrades();
    if (real.length >= 5) { setTrades(real); setIsDemo(false); }
    else { setTrades(demoData()); setIsDemo(true); }
  }, []);

  const stats = useMemo(() => {
    if (!trades.length) return null;
    const wins = trades.filter(t => t.win);
    const totalSOL = trades.reduce((s,t) => s + (t.netSOL || t.pnlSOL || 0), 0);
    const avgHold = trades.reduce((s,t) => s + (t.holdSecs||0), 0) / trades.length;
    const avgConf = trades.reduce((s,t) => s + (t.confidence||0), 0) / trades.length;
    const avgPeakRunup = trades.reduce((s,t) => s + (t.peakRunup||0), 0) / trades.length;
    return { total: trades.length, wins: wins.length, wr: wins.length/trades.length, totalSOL, avgHold, avgConf, avgPeakRunup };
  }, [trades]);

  // Exit reason breakdown
  const reasonData = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const cat = categorizeReason(t.reason);
      if (!map[cat]) map[cat] = { name: cat, count: 0, wins: 0, totalPnl: 0, totalHold: 0 };
      map[cat].count++;
      if (t.win) map[cat].wins++;
      map[cat].totalPnl += (t.netPnl || t.grossPnl || 0);
      map[cat].totalHold += (t.holdSecs || 0);
    });
    return Object.values(map).map(r => ({
      ...r, wr: r.wins/r.count, avgPnl: r.totalPnl/r.count, avgHold: r.totalHold/r.count
    })).sort((a,b) => b.count - a.count);
  }, [trades]);

  // Tier breakdown
  const tierData = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      const tier = t.walletTier || '?';
      if (!map[tier]) map[tier] = { name: tier, count: 0, wins: 0, totalSOL: 0 };
      map[tier].count++;
      if (t.win) map[tier].wins++;
      map[tier].totalSOL += (t.netSOL || t.pnlSOL || 0);
    });
    return Object.values(map).map(r => ({ ...r, wr: r.wins/r.count })).sort((a,b) => b.totalSOL - a.totalSOL);
  }, [trades]);

  // Confidence calibration
  const confData = useMemo(() => {
    const buckets = [
      { min: 0, max: 0.45, label: '0-45%' },
      { min: 0.45, max: 0.55, label: '45-55%' },
      { min: 0.55, max: 0.65, label: '55-65%' },
      { min: 0.65, max: 0.75, label: '65-75%' },
      { min: 0.75, max: 1.01, label: '75%+' }
    ];
    return buckets.map(b => {
      const bt = trades.filter(t => (t.confidence||0) >= b.min && (t.confidence||0) < b.max);
      const wins = bt.filter(t => t.win).length;
      return { name: b.label, trades: bt.length, wr: bt.length ? wins/bt.length : 0, avgPnl: bt.length ? bt.reduce((s,t)=>s+(t.netPnl||0),0)/bt.length : 0 };
    });
  }, [trades]);

  // PnL over time (cumulative)
  const pnlTimeline = useMemo(() => {
    let cum = 0;
    return trades.map((t, i) => {
      cum += (t.netSOL || t.pnlSOL || 0);
      return { idx: i, cumSOL: parseFloat(cum.toFixed(4)), pnl: t.netSOL || t.pnlSOL || 0 };
    });
  }, [trades]);

  // Confidence vs PnL scatter
  const scatterData = useMemo(() => {
    return trades.map(t => ({
      confidence: ((t.confidence||0)*100).toFixed(0),
      pnl: (t.netPnl || t.grossPnl || 0),
      size: (t.sizeSol || 0.05) * 200,
      win: t.win
    }));
  }, [trades]);

  if (!stats) return <div style={{color:COLORS.muted,textAlign:'center',padding:40}}>Loading...</div>;

  const tabs = ['overview','exits','wallets','confidence','timeline'];

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', color: COLORS.text, fontFamily: "'JetBrains Mono', 'SF Mono', monospace", padding: 16 }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.accent }}>MCHPai TRENCH</div>
          <div style={{ fontSize: 11, color: COLORS.muted }}>ANALYTICS DASHBOARD {isDemo && <span style={{color:COLORS.yellow}}>• DEMO DATA</span>}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab === t ? COLORS.accent : 'transparent', color: tab === t ? '#000' : COLORS.muted,
              border: `1px solid ${tab === t ? COLORS.accent : COLORS.border}`, borderRadius: 4,
              padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, textTransform: 'uppercase'
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 16 }}>
        <StatCard label="Trades" value={stats.total} sub={`${stats.wins}W ${stats.total-stats.wins}L`} />
        <StatCard label="Win Rate" value={(stats.wr*100).toFixed(1)+'%'} color={stats.wr > 0.6 ? COLORS.win : stats.wr > 0.4 ? COLORS.yellow : COLORS.loss} />
        <StatCard label="Net P&L" value={(stats.totalSOL >= 0 ? '+' : '') + stats.totalSOL.toFixed(3) + '◎'} color={stats.totalSOL >= 0 ? COLORS.win : COLORS.loss} />
        <StatCard label="Avg Hold" value={stats.avgHold < 60 ? stats.avgHold.toFixed(0)+'s' : (stats.avgHold/60).toFixed(1)+'m'} />
        <StatCard label="Avg Conf" value={(stats.avgConf*100).toFixed(0)+'%'} color={COLORS.blue} />
        <StatCard label="Avg Peak" value={'+'+stats.avgPeakRunup.toFixed(0)+'%'} sub="peak runup before exit" color={COLORS.purple} />
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Cumulative PnL */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8, textTransform: 'uppercase' }}>Cumulative P&L (SOL)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={pnlTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.dim} />
                <XAxis dataKey="idx" tick={false} />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 11 }} />
                <Line type="monotone" dataKey="cumSOL" stroke={COLORS.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* PnL Distribution */}
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8, textTransform: 'uppercase' }}>Exit Reason Breakdown</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={reasonData.slice(0,8)} layout="vertical">
                <XAxis type="number" tick={{ fill: COLORS.muted, fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: COLORS.text, fontSize: 9 }} width={80} />
                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 11 }}
                  formatter={(v,n) => n === 'count' ? v + ' trades' : (v*100).toFixed(0)+'%'} />
                <Bar dataKey="count" fill={COLORS.blue} radius={[0,3,3,0]}>
                  {reasonData.slice(0,8).map((r,i) => <Cell key={i} fill={r.avgPnl >= 0 ? COLORS.win : COLORS.loss} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'exits' && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14, overflowX: 'auto' }}>
          <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10, textTransform: 'uppercase' }}>Exit Reason Performance</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {['Reason','Count','WR','Avg Net PnL','Avg Hold','Verdict'].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: COLORS.muted, fontWeight: 500 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{reasonData.map((r,i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${COLORS.dim}` }}>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{r.name}</td>
                <td style={{ padding: '6px 8px' }}>{r.count}</td>
                <td style={{ padding: '6px 8px', color: r.wr > 0.5 ? COLORS.win : COLORS.loss }}>{(r.wr*100).toFixed(0)}%</td>
                <td style={{ padding: '6px 8px', color: r.avgPnl >= 0 ? COLORS.win : COLORS.loss }}>{r.avgPnl >= 0 ? '+' : ''}{r.avgPnl.toFixed(1)}%</td>
                <td style={{ padding: '6px 8px' }}>{r.avgHold < 60 ? r.avgHold.toFixed(0)+'s' : (r.avgHold/60).toFixed(1)+'m'}</td>
                <td style={{ padding: '6px 8px', color: r.avgPnl >= 0 ? COLORS.win : r.avgPnl > -10 ? COLORS.yellow : COLORS.loss }}>
                  {r.avgPnl >= 5 ? '✅ Profitable' : r.avgPnl >= 0 ? '➖ Breakeven' : r.avgPnl > -10 ? '⚠️ Bleeding' : '🔴 Hemorrhaging'}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === 'wallets' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10, textTransform: 'uppercase' }}>Tier Performance</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tierData}>
                <XAxis dataKey="name" tick={{ fill: COLORS.text, fontSize: 11 }} />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 11 }} />
                <Bar dataKey="totalSOL" name="Net SOL" radius={[4,4,0,0]}>
                  {tierData.map((t,i) => <Cell key={i} fill={TIER_COLORS[t.name] || COLORS.blue} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10, textTransform: 'uppercase' }}>Tier Win Rates</div>
            {tierData.map((t,i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 28, fontWeight: 700, color: TIER_COLORS[t.name] || COLORS.muted }}>{t.name}</span>
                <div style={{ flex: 1, height: 18, background: COLORS.dim, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: (t.wr*100)+'%', height: '100%', background: t.wr > 0.5 ? COLORS.win : COLORS.loss, borderRadius: 4 }}/>
                  <span style={{ position: 'absolute', left: 6, top: 1, fontSize: 10, fontWeight: 600, color: '#fff' }}>{(t.wr*100).toFixed(0)}% ({t.count})</span>
                </div>
                <span style={{ fontSize: 10, color: t.totalSOL >= 0 ? COLORS.win : COLORS.loss, minWidth: 60, textAlign: 'right' }}>
                  {t.totalSOL >= 0 ? '+' : ''}{t.totalSOL.toFixed(3)}◎
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'confidence' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10, textTransform: 'uppercase' }}>Confidence → Actual Win Rate</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={confData}>
                <XAxis dataKey="name" tick={{ fill: COLORS.text, fontSize: 10 }} />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} domain={[0, 1]} tickFormatter={v => (v*100)+'%'} />
                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 11 }}
                  formatter={(v) => (v*100).toFixed(0)+'%'} />
                <Bar dataKey="wr" name="Actual WR" radius={[4,4,0,0]}>
                  {confData.map((c,i) => <Cell key={i} fill={c.wr > 0.6 ? COLORS.win : c.wr > 0.4 ? COLORS.yellow : COLORS.loss} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 9, color: COLORS.dim, marginTop: 4 }}>Shows calibration: does ML confidence predict actual win rate?</div>
          </div>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10, textTransform: 'uppercase' }}>Confidence vs Net PnL</div>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.dim} />
                <XAxis dataKey="confidence" name="Confidence" tick={{ fill: COLORS.muted, fontSize: 10 }} label={{ value: 'Conf %', position: 'bottom', fill: COLORS.dim, fontSize: 9 }} />
                <YAxis dataKey="pnl" name="Net PnL %" tick={{ fill: COLORS.muted, fontSize: 10 }} />
                <ZAxis dataKey="size" range={[20, 120]} />
                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 11 }}
                  formatter={(v,n) => n === 'Confidence' ? v+'%' : v.toFixed(1)+'%'} />
                <Scatter data={scatterData.filter(d => d.win)} fill={COLORS.win} opacity={0.5} />
                <Scatter data={scatterData.filter(d => !d.win)} fill={COLORS.loss} opacity={0.5} />
              </ScatterChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 9, color: COLORS.win }}>● Wins</span>
              <span style={{ fontSize: 9, color: COLORS.loss }}>● Losses</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10, textTransform: 'uppercase' }}>Trade-by-Trade P&L</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pnlTimeline.slice(-100)}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.dim} />
              <XAxis dataKey="idx" tick={false} />
              <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 11 }}
                formatter={(v) => v.toFixed(4) + ' SOL'} />
              <Bar dataKey="pnl" name="Trade PnL">
                {pnlTimeline.slice(-100).map((t,i) => <Cell key={i} fill={t.pnl >= 0 ? COLORS.win : COLORS.loss} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 9, color: COLORS.dim, marginTop: 4 }}>Last 100 trades. Green = profit, Red = loss.</div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 9, color: COLORS.dim }}>
        MCHPai TRENCH Analytics v2.0 • {trades.length} trades loaded • {isDemo ? 'Demo data — connect to TRENCH for live analytics' : 'Live data from PNL_ANALYTICS'}
      </div>
    </div>
  );
}
