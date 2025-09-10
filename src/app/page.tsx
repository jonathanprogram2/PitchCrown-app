"use client";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar
} from "recharts";

type PredictOut = {
  player: string;
  used_line: number;
  mean_lastn: number;
  std_lastn: number;
  p_over: number;
  p_over_novig?: number|null;
  edge_over?: number|null;
  ts_games: number[];
  ts_pts: number[];
  ts_ra7: number[];
  pdf_x: number[];
  pdf_y: number[];
};



export default function Home() {
  const [player, setPlayer] = useState("");
  const [line, setLine] = useState(24.5);
  const [overOdds, setOverOdds] = useState(-110);
  const [underOdds, setUnderOdds] = useState(-110);
  const [resp, setResp] = useState<PredictOut | null>(null);
  const [heat, setHeat] = useState<{players:string[],lines:number[],matrix:number[][]}|null>(null);
  const API = "http://127.0.0.1:8000";

  const predict = async () => {
    const r = await fetch(`${API}/predict`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ player, line, lastn: 10, over_odds: overOdds, under_odds: underOdds })
    });
    const j = await r.json(); setResp(j);
  };

  const getHeatmap = async () => {
    const r = await fetch(`${API}/heatmap`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ topN: 12, spread: 4.0, over_odds: overOdds, lastn: 10 })
    });
    const j = await r.json(); setHeat(j);
  };

  const tsData = resp
    ? resp.ts_games.map((g,i)=>({ game:g, PTS: resp.ts_pts[i], RA7: resp.ts_ra7[i] }))
    : [];

  const pdfData = resp
    ? resp.pdf_x.map((x,i)=>({ x, density: resp.pdf_y[i] }))
    : [];

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4"> Props Model (API + Next.js)</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input className="border p-2 rounded" value={player} onChange={e=>setPlayer(e.target.value)} placeholder="Player" />
        <input className="border p-2 rounded" type="number" step="0.5" value={line} onChange={e=>setLine(parseFloat(e.target.value))} placeholder="Line"/>
        <button className="bg-black text-white rounded px-4" onClick={predict}>Predict</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <input className="border p-2 rounded" type="number" value={overOdds} onChange={e=>setOverOdds(parseInt(e.target.value))} placeholder=" Over odds"/>
        <input className="border p-2 rounded" type="number" value={underOdds} onChange={e=>setUnderOdds(parseInt(e.target.value))} placeholder="Under odds"/>
        <button className="border rounded px-4" onClick={getHeatmap}>EV Heatmap</button>
      </div>

      {resp && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-6 mb-6">
            <div className="p-4 border rounded w-full md:w-[48%]">
              <h2 className="font-medium mb-2">Time Series</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={tsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="game" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="PTS" dot={false} />
                  <Line type="monotone" dataKey="RA7" dot={false} />
                  <ReferenceLine y={resp.used_line} stroke="#888" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="p-4 border rounded w-full md:w-[48%]">
              <h2 className="font-medium mb-2">Distribution (PDF)</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={pdfData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="density" dot={false} />
                  <ReferenceLine x={resp.used_line} stroke="#888" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-4 border rounded w-full md:w-[48%]">
            <h2 className="font-medium mb-2">Model vs Book</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[
                { name: "Model P(Over)", val: resp.p_over },
                { name: "No-vig P(Over)", val: resp.p_over_novig ?? 0}
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" /><YAxis domain={[0,1]} />
                <Tooltip />
                <Bar dataKey="val" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 text-sm">
              <strong>P(Over):</strong> {resp.p_over.toFixed(3)} &nbsp;
              {resp.p_over_novig != null && (<>
                <strong>No-vig:</strong> {resp.p_over_novig.toFixed(3)} &nbsp;
                <strong>Edge:</strong> {(resp.edge_over ?? 0).toFixed(3)}
              </>)}
            </div>
          </div>
        </div>
      )}

      {heat && (
        <div className="mt-6">
          <h2 className="font-medium mb-2">EV Heatmap (Over)</h2>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left">Player</th>
                  {heat.lines.map((l,i)=>(<th key={i} className="p-2">{l.toFixed(1)}</th>))}
                </tr>
              </thead>
              <tbody>
                {heat.players.map((pl,ri)=> (
                  <tr key={pl} className="border-t">
                    <td className="p-2 font-medium">{pl}</td>
                    {heat.matrix[ri].map((ev,ci)=>{
                      // simple green/red background
                      const v = Math.max(-1, Math.min(1, ev)); // clamp
                      const g = v>0 ? Math.round(255*v) : 0;
                      const r = v<0 ? Math.round(255*(-v)) : 0;
                      const bg = `rgb(${r},${g},0,0.25)`;
                      return <td key={ci} className="p-2 text-right" style={{background:bg}}>{ev.toFixed(2)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <RagChat />
    </main>
  );
}

type ChatResp = { answer: string; sources: {source:string;text:string;similarity:number}[]; trace_id: string };
const KB_API = "http://127.0.0.1:8000";

function RagChat() {
  const [q, setQ] = useState("What is EPA and how is it used?");
  const [resp, setResp] = useState<ChatResp | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = async() => {
    setLoading(true);
    try {
      const r = await fetch(`${KB_API}/chat`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ q, k: 4 })
      });
      setResp(await r.json());
    } finally {
      setLoading(false);
    }
  };

  const reindex = async () => { await fetch(`${KB_API}/kb/reindex`, {method:"POST"}); };

  return (
    <div className="mt-10 p-4 border-rounded">
      <div className="flex gap-2 mb-2">
        <input className="border p-2 flex-1 rounded" value={q} onChange={e=>setQ(e.target.value)} />
        <button className="bg-black text-white px-4 rounded" onClick={ask} disabled={loading}>
          {loading ? "Asking..." : "Ask"}
        </button>
        <button className="border px-3 rounded" onClick={reindex}>Reindex KB</button>
      </div>
      {resp && (
        <>
          <div className="mb-3 whitespace-pre-wrap">{resp.answer}</div>
          <div className="text-sm">
            <strong>Sources:</strong>
            <ul className="list-disc ml-5">
              {resp.sources.map((s,i)=>(
                <li key={i}><code>[{i+1}] {s.source}</code> (sim {s.similarity.toFixed(2)})</li>
              ))}
            </ul>
            <div className="mt-1 text-xs text-gray-500">trace: {resp.trace_id}</div>
          </div>
        </>
      )}
    </div>
  );
}
