import './App.css';
import React, { useState, useEffect } from 'react';

// ฟังก์ชันแปลงผลลัพธ์เป็น Big Road (แนวตั้ง 6 แถว)
function getBigRoad(results, maxRows = 6, maxCols) {
  // คำนวณจำนวนคอลัมน์ที่ต้องใช้จริง
  let col = 0, row = 0, last = null, tempCol = 0;
  for (let i = 0; i < results.length; i++) {
    const curr = results[i];
    if (curr !== last) {
      if (i !== 0) tempCol++;
      row = 0;
    } else {
      if (row < maxRows - 1) {
        row++;
      } else {
        tempCol++;
        row = 0;
      }
    }
    last = curr;
  }
  // เพิ่ม buffer เผื่อไว้ 2 คอลัมน์
  maxCols = Math.max(20, tempCol + 2);

  // วาด grid จริง
  const grid = Array.from({ length: maxRows }, () => Array(maxCols).fill(null));
  col = 0;
  row = 0;
  last = null;
  for (let i = 0; i < results.length && col < maxCols; i++) {
    const curr = results[i];
    if (curr !== last) {
      if (i !== 0) col++;
      row = 0;
    } else {
      if (row < maxRows - 1 && !grid[row + 1][col]) {
        row++;
      } else {
        col++;
        row = 0;
      }
    }
    if (col >= maxCols) break;
    grid[row][col] = { value: curr, index: i };
    last = curr;
  }
  return grid;
}

function App() {
  const [results, setResults] = useState([]);
  const [prediction, setPrediction] = useState('');
  const [budget, setBudget] = useState(1000); // เงินทุนเริ่มต้น
  const [betAmount, setBetAmount] = useState(100); // จำนวนเงินเดิมพันต่อไม้
  const [balance, setBalance] = useState(1000); // ยอดเงินคงเหลือ

  // เพิ่มบรรทัดนี้
  const [history, setHistory] = useState([]); // สำหรับเก็บประวัติทายถูก/ผิด
  const [showResult, setShowResult] = useState(null); // สำหรับ popup win/lose

  // ฟีเจอร์บันทึกผลรายวัน/สัปดาห์
  const [stats, setStats] = useState({}); // { '2024-06-05': { correct: 0, wrong: 0, profit: 0, bet: 0 } }
  const [showStats, setShowStats] = useState(false);

  const [isBetting, setIsBetting] = useState(false);

  // Helper: คืนวันที่ปัจจุบันในรูปแบบ yyyy-mm-dd
  const getToday = () => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  };

  // Helper: คืน array 7 วันล่าสุด
  const getLast7Days = () => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  };

  // โหลดสถิติจาก localStorage
  useEffect(() => {
    const saved = localStorage.getItem('baccarat_stats');
    if (saved) setStats(JSON.parse(saved));
  }, []);

  // บันทึกสถิติลง localStorage ทุกครั้งที่ stats เปลี่ยน
  useEffect(() => {
    localStorage.setItem('baccarat_stats', JSON.stringify(stats));
  }, [stats]);

  // Pie Chart component (ไม่ใช้ไลบรารี)
  function SimplePieChart({ data, size = 120 }) {
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    let startAngle = 0;
    const colors = { P: '#2196f3', B: '#e53935', T: '#43a047' };
    const keys = Object.keys(data);

    // สร้าง path สำหรับแต่ละ slice
    const slices = keys.map((k, i) => {
      const value = data[k];
      const angle = (value / total) * 360;
      const large = angle > 180 ? 1 : 0;
      const r = size / 2;
      const x1 = r + r * Math.cos((Math.PI / 180) * (startAngle - 90));
      const y1 = r + r * Math.sin((Math.PI / 180) * (startAngle - 90));
      const x2 = r + r * Math.cos((Math.PI / 180) * (startAngle + angle - 90));
      const y2 = r + r * Math.sin((Math.PI / 180) * (startAngle + angle - 90));
      const path = `
        M ${r},${r}
        L ${x1},${y1}
        A ${r},${r} 0 ${large} 1 ${x2},${y2}
        Z
      `;
      startAngle += angle;
      return (
        <path key={k} d={path} fill={colors[k] || '#888'} stroke="#222" strokeWidth="1" />
      );
    });

    // แสดงเปอร์เซ็นต์
    const percents = keys.map(k => (
      <div key={k} style={{ color: colors[k], fontWeight: 600, marginRight: 12 }}>
        {k === 'P' && '🔵 Player'}{k === 'B' && '🔴 Banker'}{k === 'T' && '🟢 Tie'}: {total ? ((data[k] / total) * 100).toFixed(1) : 0}%
      </div>
    ));

    return (
      <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 0 0' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices}
        </svg>
        <div style={{ marginLeft: 18, fontSize: 16 }}>{percents}</div>
      </div>
    );
  }

  // ฟังก์ชันเพิ่มผลรอบใหม่ + อัปเดต stats
  const addResult = (value) => {
    if (results.length >= 90) {
      alert('สามารถจดผลได้สูงสุด 90 ตาเท่านั้น');
      return;
    }

    // เพิ่ม logic: ถ้าไม่ได้กด "เล่นไม้นี้" ให้บันทึกผลเฉยๆ ไม่คิดเงิน/ถูกผิด
    if (results.length >= 15 && prediction && isBetting) {
      let predValue = null;
      if (prediction.includes('B (Banker)')) predValue = 'B';
      else if (prediction.includes('P (Player)')) predValue = 'P';
      else if (prediction.includes('สุ่ม')) predValue = null;

      if (predValue) {
        let isCorrect = predValue === value;
        if (value === 'T') {
          setHistory(h => [
            ...h,
            { guess: predValue, actual: value, correct: null, bet: isBetting }
          ]);
        } else {
          setHistory(h => [
            ...h,
            { guess: predValue, actual: value, correct: isCorrect, bet: isBetting }
          ]);
          setBalance(bal => isCorrect ? bal + betAmount : bal - betAmount);
          setShowResult(isCorrect ? 'win' : 'lose');
          setTimeout(() => setShowResult(null), 1200);

          // --- อัปเดต stats พร้อม detail ---
          const today = getToday();
          setStats(prev => {
            const old = prev[today] || { correct: 0, wrong: 0, profit: 0, bet: 0, detail: [] };
            return {
              ...prev,
              [today]: {
                correct: old.correct + (isCorrect ? 1 : 0),
                wrong: old.wrong + (!isCorrect ? 1 : 0),
                profit: old.profit + (isCorrect ? betAmount : -betAmount),
                bet: old.bet + betAmount,
                detail: [...(old.detail || []), value]
              }
            };
          });
        }
      }
    }
    // เพิ่ม detail แม้ไม่มี prediction (เพื่อ Pie Chart)
    const today = getToday();
    setStats(prev => {
      const old = prev[today] || { correct: 0, wrong: 0, profit: 0, bet: 0, detail: [] };
      return {
        ...prev,
        [today]: {
          ...old,
          detail: [...(old.detail || []), value]
        }
      };
    });
    setResults([...results, value]);
    setPrediction(null);
    setIsBetting(false); // reset ทุกครั้งหลังจดผล
  };

  // ฟังก์ชันคาดเดารอบถัดไป (อัตโนมัติ)
  useEffect(() => {
    if (results.length < 15) {
      setPrediction('กรุณากรอกผลให้ครบ 15 รอบ');
      return;
    }
    const countP = results.filter(r => r === 'P').length;
    const countB = results.filter(r => r === 'B').length;
    if (countP > countB) setPrediction('คาดว่า: B (Banker)');
    else if (countB > countP) setPrediction('คาดว่า: P (Player)');
    else {
      setPrediction('คาดว่า :');
      setRandomPrediction(Math.random() < 0.5 ? 'P' : 'B');
    }
  }, [results]); // <-- ต้องมีแค่ results

  // แสดงวงกลมสี
  const renderCircle = (value, idx, isTie = false) => {
    let color = '';
    if (value === 'B') color = 'red';
    else if (value === 'P') color = 'blue';
    else if (value === 'T') color = 'green';
    return (
      <div
        key={idx}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: color,
          margin: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: 20,
          border: isTie ? '2px solid #fff' : undefined,
          position: 'relative'
        }}
        title={value}
      >
        {value}
      </div>
    );
  };

  // Big Road grid
  const bigRoad = getBigRoad(results);

  // ฟังก์ชันแสดง Big Road
  const renderBigRoadCell = (cell, rowIdx, colIdx) => {
    if (!cell) return <div key={colIdx} style={{ width: 28, height: 28, margin: 1 }} />;
    return (
      <div
        key={colIdx}
        style={{ position: 'relative', cursor: 'pointer' }}
        onContextMenu={e => {
          e.preventDefault();
          removeResultAt(rowIdx, colIdx);
        }}
        title="คลิกขวาเพื่อลบผลตานี้"
      >
        {renderCircle(cell.value, `${rowIdx}-${colIdx}`)}
      </div>
    );
  };

  // ฟังก์ชันแสดงวงกลมสีสำหรับ prediction
  const renderPredictionCircle = (prediction) => {
    if (!prediction) return null;
    if (prediction.includes('B (Banker)')) return renderCircle('B', 'prediction');
    if (prediction.includes('P (Player)')) return renderCircle('P', 'prediction');
    if (prediction.includes('กรุณากรอกผล')) return <p style={{ color: 'orange' }}>{prediction}</p>;
    if (prediction.trim() === 'คาดว่า :') {
      return renderCircle(randomPrediction, 'prediction');
    }
    return null;
  };

  // นับจำนวนทายถูก/ผิด
  const correctCount = history.filter(h => h.correct).length;
  const wrongCount = history.filter(h => h.correct === false).length;

  // ฟังก์ชันรีเซ็ตงบประมาณ
  const resetBudget = () => {
    setBudget(1000);
    setBetAmount(100);
    setBalance(1000);
    setResults([]);
    setPrediction(null);
    setHistory([]);
  };

  const [showAbout, setShowAbout] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  // --- UI ส่วนแสดงผลสถิติ 7 วัน ---
  const renderStatsPopup = () => {
    const days = getLast7Days();

    // รวมผลย้อนหลัง 7 วัน
    let totalP = 0, totalB = 0, totalT = 0;
    days.forEach(day => {
      const s = stats[day] || {};
      if (s.detail) {
        s.detail.forEach(v => {
          if (v === 'P') totalP++;
          else if (v === 'B') totalB++;
          else if (v === 'T') totalT++;
        });
      }
    });

    // Pie chart data
    const pieData = { P: totalP, B: totalB, T: totalT };

    // Accuracy
    let totalGuess = 0, totalCorrect = 0;
    days.forEach(day => {
      const s = stats[day] || {};
      totalGuess += (s.correct || 0) + (s.wrong || 0);
      totalCorrect += (s.correct || 0);
    });
    const accuracy = totalGuess ? ((totalCorrect / totalGuess) * 100).toFixed(1) : 0;

    // --- ปุ่มรีเซ็ตข้อมูล ---
    const handleResetStats = () => {
      if (window.confirm('ต้องการลบสถิติย้อนหลังทั้งหมดหรือไม่?')) {
        setStats({});
        localStorage.removeItem('baccarat_stats');
      }
    };

    return (
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: '#000a',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeInBg 0.3s'
        }}
        onClick={() => setShowStats(false)}
      >
        <div
          style={{
            background: '#222',
            color: '#fff',
            padding: '32px 28px',
            borderRadius: 16,
            maxWidth: 520,
            fontSize: 16,
            boxShadow: '0 8px 32px #000a',
            position: 'relative',
            animation: 'popupZoomIn 0.3s'
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            style={{
              position: 'absolute',
              top: 12,
              right: 16,
              background: 'transparent',
              color: '#fff',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer'
            }}
            onClick={() => setShowStats(false)}
            aria-label="close"
          >×</button>
          <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 12 }}>สถิติการเล่น 7 วันล่าสุด</div>
          <SimplePieChart data={pieData} />
          <div style={{ margin: '12px 0 18px 0', fontSize: 16 }}>
            <b>Accuracy:</b> <span style={{ color: 'lime', fontWeight: 600 }}>{accuracy}%</span>
          </div>
          <table style={{ width: '100%', color: '#fff', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444' }}>
                <th style={{ textAlign: 'left', padding: 4 }}>วันที่</th>
                <th style={{ padding: 4 }}>ถูก</th>
                <th style={{ padding: 4 }}>ผิด</th>
                <th style={{ padding: 4 }}>ทุน</th>
                <th style={{ padding: 4 }}>กำไร/ขาดทุน</th>
              </tr>
            </thead>
            <tbody>
              {days.map(day => {
                const s = stats[day] || { correct: 0, wrong: 0, profit: 0, bet: 0 };
                return (
                  <tr key={day} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: 4 }}>{day}</td>
                    <td style={{ color: 'lime', textAlign: 'center' }}>{s.correct}</td>
                    <td style={{ color: 'tomato', textAlign: 'center' }}>{s.wrong}</td>
                    <td style={{ color: '#ffb700', textAlign: 'center' }}>
                      {s.bet.toLocaleString()}
                    </td>
                    <td style={{ color: s.profit >= 0 ? 'lime' : 'tomato', textAlign: 'center' }}>
                      {s.profit > 0 ? '+' : ''}{s.profit.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 16, color: '#aaa', fontSize: 14 }}>
            *ข้อมูลนี้จะช่วยให้คุณฝึกวินัยและเห็นผลลัพธ์การเล่นจริงของตัวเอง*
          </div>
          <button
            style={{
              marginTop: 18,
              background: '#ff4136',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 22px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              float: 'right'
            }}
            onClick={handleResetStats}
          >
            รีเซ็ตข้อมูล
          </button>
        </div>
      </div>
    );
  };

  // เพิ่มฟังก์ชัน removeResultAt สำหรับลบผลจดที่ตำแหน่งที่ต้องการ
  const removeResultAt = (rowIdx, colIdx) => {
    const cell = bigRoad[rowIdx][colIdx];
    if (!cell) return;
    if (window.confirm('ต้องการลบผลตานี้ใช่หรือไม่?')) {
      const idx = cell.index;
      // ลบผลที่ตำแหน่ง idx
      const newResults = results.slice(0, idx).concat(results.slice(idx + 1));
      setResults(newResults);
      setPrediction(null);

      // รีเซ็ต history และคำนวณ balance ใหม่
      let newHistory = [];
      let newBalance = budget;
      if (newResults.length >= 15) {
        // สร้าง prediction ใหม่และคำนวณผลย้อนหลัง
        for (let i = 15; i < newResults.length; i++) {
          // สมมุติใช้ logic เดิมในการทาย (อาจต้องปรับถ้ามี logic ทายซับซ้อน)
          const countP = newResults.slice(0, i).filter(r => r === 'P').length;
          const countB = newResults.slice(0, i).filter(r => r === 'B').length;
          let predValue = null;
          if (countP > countB) predValue = 'B';
          else if (countB > countP) predValue = 'P';
          else predValue = null;

          const value = newResults[i];
          if (predValue && value !== 'T') {
            const isCorrect = predValue === value;
            newHistory.push({ guess: predValue, actual: value, correct: isCorrect });
            newBalance += isCorrect ? betAmount : -betAmount;
          } else if (value === 'T') {
            newHistory.push({ guess: predValue, actual: value, correct: null });
          }
        }
      }
      setHistory(newHistory);
      setBalance(newBalance);
    }
  };

  const [randomPrediction, setRandomPrediction] = useState('P');

  return (
    <div className="App">
      <header className="App-header">
        {/* ปุ่มคู่มือการใช้งาน ซ้ายบน */}
        <button
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            background: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontSize: 16,
            cursor: 'pointer',
            zIndex: 100
          }}
          onClick={() => setShowGuide(true)}
        >
          คู่มือการใช้งาน
        </button>
        {/* ปุ่มสถิติ 7 วัน */}
        <button
          style={{
            position: 'absolute',
            top: 24,
            left: 180,
            background: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontSize: 16,
            cursor: 'pointer',
            zIndex: 100
          }}
          onClick={() => setShowStats(true)}
        >
          สถิติ 7 วัน
        </button>
        {/* Popup คู่มือการใช้งาน */}
        {showGuide && (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, width: '100vw', height: '100vh',
              background: '#000a',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadeInBg 0.3s'
            }}
            onClick={() => setShowGuide(false)}
          >
            <div
              style={{
                background: '#222',
                color: '#fff',
                padding: '32px 28px',
                borderRadius: 16,
                maxWidth: 540,
                maxHeight: '90vh', // เพิ่มบรรทัดนี้
                overflowY: 'auto', // เพิ่มบรรทัดนี้
                fontSize: 17,
                boxShadow: '0 8px 32px #000a',
                position: 'relative',
                animation: 'popupZoomIn 0.3s'
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  background: 'transparent',
                  color: '#fff',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer'
                }}
                onClick={() => setShowGuide(false)}
                aria-label="close"
              >×</button>
              <div style={{ whiteSpace: 'normal', lineHeight: 1.7 }}>
                <b>🧭 คู่มือการใช้งาน Baccarat Indicator</b><br />
                <span style={{ color: '#aaa' }}>พัฒนาโดย freecash.net</span>
                <div style={{ margin: '10px 0' }}>
                  <i>“เครื่องมือคืออาวุธ — แต่ผลลัพธ์ขึ้นอยู่กับวิธีที่คุณใช้”</i>
                </div>
                <hr style={{ border: 0, borderTop: '1px solid #444', margin: '12px 0' }} />

                {/* เพิ่มข้อความแนะนำการเดิมพัน */}
                <div style={{ 
                  background: '#333', 
                  color: '#ffeb3b', 
                  padding: '10px 16px', 
                  borderRadius: 8, 
                  marginBottom: 18, 
                  fontWeight: 600, 
                  fontSize: 16 
                }}>
                  แนะนำให้เดิมพันตาเว้นตาเพื่อความแม่นยำ<br />
                  <span style={{ color: '#fff', fontWeight: 400, fontSize: 15 }}>
                    ไม่แนะนำให้เดิมพันทุกตา
                  </span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <b>🔰 1. เริ่มต้นใช้งาน</b>
                  <ul style={{ margin: '8px 0 8px 22px', padding: 0 }}>
                    <li><b>เงินทุนรวม:</b> ใส่จำนวนเงินที่คุณพร้อมใช้ใน session นี้ (เช่น 1000)</li>
                    <li><b>จำนวนเงินเดิมพัน/ไม้:</b> ระบุจำนวนเงินที่ต้องการเดิมพันต่อ 1 ตา (เช่น 100)</li>
                  </ul>
                  <span style={{ color: '#aaa' }}>
                    ระบบจะคำนวณยอดเงินคงเหลือให้อัตโนมัติ ช่วยให้คุณมีวินัยและไม่เผลอหลุดกรอบแผนการเล่น
                  </span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <b>🧠 2. บันทึกผลเกมด้วยมือ (Manual Input)</b>
                  <ul style={{ margin: '8px 0 8px 22px', padding: 0 }}>
                    <li><span style={{ color: 'blue' }}>🔵 P</span> = Player ชนะ</li>
                    <li><span style={{ color: 'red' }}>🔴 B</span> = Banker ชนะ</li>
                    <li><span style={{ color: 'green' }}>🟢 T</span> = เสมอ (Tie)</li>
                    <li style={{ color: '#ffeb3b', marginTop: 6 }}>
                      <b>หากจดผลผิด:</b> คลิกขวาที่วงกลมผลในตาราง เพื่อลบผลตานั้น แล้วจดใหม่ได้ทันที
                    </li>
                  </ul>
                  <span style={{ color: '#aaa' }}>
                    เมื่อกด ระบบจะบันทึกผลและแสดงบนกระดานด้านล่าง เพื่อให้คุณเห็นรูปแบบเค้าไพ่แบบ visual โดยไม่ต้องตีตารางเอง
                  </span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <b>🔮 3. คาดเดารอบถัดไป</b>
                  <div style={{ margin: '8px 0 8px 22px' }}>
                    หลังจากกรอกผลไปหลายตาแล้ว ให้คุณกดปุ่ม<br />
                    <b>➡️ "คาดเดารอบถัดไป"</b><br />
                    ระบบจะวิเคราะห์ momentum และเค้าไพ่ที่เกิดขึ้น เพื่อแสดงผลลัพธ์ที่ “น่าจะเกิดขึ้นมากที่สุด” เป็นตัวอักษรใหญ่สีชัดเจน เช่น B หรือ P
                  </div>
                  <div style={{ color: '#ffb700', margin: '8px 0 0 22px', fontSize: 15 }}>
                    <b>หมายเหตุ:</b> ระบบจะเริ่มคาดเดาผลลัพธ์ตาถัดไปหลังจากคุณจดผลครบ 15 รอบแรกแล้วเท่านั้น
                  </div>
                  <span style={{ color: '#aaa' }}>
                    การทำนายไม่ใช่การการันตี แต่คือ “การให้แนวโน้ม” เพื่อประกอบการตัดสินใจอย่างมีเหตุผล
                  </span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <b>📊 4. ตรวจสอบความแม่นยำ</b>
                  <ul style={{ margin: '8px 0 8px 22px', padding: 0 }}>
                    <li>✅ ทายถูก: จำนวนตาที่ระบบเดาแล้วตรงกับผลจริง</li>
                    <li>❌ ทายผิด: จำนวนตาที่ระบบเดาแล้วไม่ตรง</li>
                  </ul>
                  <span style={{ color: '#aaa' }}>
                    สิ่งนี้จะช่วยให้คุณรู้ว่าระบบกำลัง “เข้าจังหวะ” หรือไม่ และคุณสามารถปรับการเล่นได้ตามข้อมูลที่เกิดขึ้นจริง
                  </span>
                </div>

                <div>
                  <b>🧘‍♂️ 5. วินัยคือกุญแจ</b>
                  <ul style={{ margin: '8px 0 8px 22px', padding: 0 }}>
                    <li>อย่าลืมว่า Indicator คือ “ผู้ช่วย” ไม่ใช่เจ้ามือรับประกัน</li>
                    <li>อย่าเล่นเกินแผนที่ตั้งไว้</li>
                    <li>ใช้ข้อมูลเพื่อเสริม <b>ความนิ่ง ความมั่นใจ และการตัดสินใจแบบมีเหตุผล</b></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 0 }}>
          <h2 style={{ marginBottom: 4 }}>baccarat indicator</h2>
          <div style={{ fontSize: 14, color: '#aaa', marginBottom: 16, textAlign: 'center' }}>by freecash.org</div>
        </div>
        {/* ปุ่ม About Us */}
        <button
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            background: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontSize: 16,
            cursor: 'pointer',
            zIndex: 100
          }}
          onClick={() => setShowAbout(true)}
        >
          About Us
        </button>
        {/* Popup About Us */}
        {showAbout && (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, width: '100vw', height: '100vh',
              background: '#000a',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadeInBg 0.3s'
            }}
            onClick={() => setShowAbout(false)}
          >
            <div
              style={{
                background: '#222',
                color: '#fff',
                padding: '32px 28px',
                borderRadius: 16,
                maxWidth: 480,
                maxHeight: '90vh', // เพิ่มบรรทัดนี้
                overflowY: 'auto', // เพิ่มบรรทัดนี้
                fontSize: 17,
                boxShadow: '0 8px 32px #000a',
                position: 'relative',
                animation: 'popupZoomIn 0.3s'
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  background: 'transparent',
                  color: '#fff',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer'
                }}
                onClick={() => setShowAbout(false)}
                aria-label="close"
              >×</button>
              <div style={{ whiteSpace: 'normal', lineHeight: 1.7 }}>
                <b>freecash.net presents: Baccarat Indicator</b>
                <br />
                <span style={{ fontWeight: 600, color: '#aaa' }}>เครื่องมือแห่งการทำนายที่ทรงพลังที่สุดของนักเดิมพันยุคใหม่</span>
                <hr style={{ border: 0, borderTop: '1px solid #444', margin: '12px 0' }} />
                <div style={{ marginBottom: 10 }}>
                  ในสนามเดิมพันที่เต็มไปด้วยความผันผวน มีเพียงไม่กี่คนที่รู้ว่าเบื้องหลังชัยชนะ ไม่ใช่เรื่องของดวง... แต่คือ <b>“ข้อมูล”</b> และ <b>“จังหวะ”</b>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span role="img" aria-label="target">🎯</span> <b>ออกแบบมาเพื่อชัยชนะ ไม่ใช่แค่โชคดี</b><br />
                  Baccarat Indicator by freecash.org ถูกออกแบบด้วยหลักการของสถิติ ความน่าจะเป็น และการวิเคราะห์รูปแบบ (Pattern Recognition) ที่ถูกกลั่นกรองผ่านประสบการณ์จริงในการเล่นนับพันเกม
                </div>
                <div style={{ marginBottom: 10 }}>
                  <b>จุดเด่นของระบบนี้:</b>
                  <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                    <li>✅ แสดงผลแบบ Real-time พร้อมปุ่ม P (Player), B (Banker), T (Tie) เพื่อบันทึกผล</li>
                    <li>✅ วิเคราะห์ทิศทางของเกม และคาดเดารอบถัดไปทันที</li>
                    <li>✅ วัดความแม่นยำ ของการทำนายในแต่ละตา (ทายถูก/ผิด)</li>
                    <li>✅ ระบบทุนและเดิมพันอัตโนมัติ ช่วยให้คุณควบคุมความเสี่ยงได้อย่างมีวินัย</li>
                  </ul>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span role="img" aria-label="search">🔍</span> <b>จากข้อมูล สู่การตัดสินใจที่เฉียบคม</b><br />
                  ตัว Indicator ไม่ได้เดาสุ่ม แต่ใช้แนวคิดแบบ momentum analysis ผสานกับการอ่านเค้าไพ่พื้นฐานและความถี่เชิงสถิติ เพื่อ “คาดเดาทิศ” ของเกมที่กำลังเกิดขึ้นแบบตาต่อตา<br />
                  ทุกตาที่คุณคลิกคือการสื่อสารกับข้อมูลที่ซ่อนอยู่ในระบบไพ่ ไม่ใช่แค่การเสี่ยงโชค
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span role="img" aria-label="briefcase">💼</span> <b>เหมาะสำหรับใคร?</b>
                  <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                    <li>นักเดิมพันที่ต้องการ ระบบเสริมความมั่นใจ</li>
                    <li>ผู้เล่นที่ต้องการหลุดพ้นจากการเล่นแบบตามใจ</li>
                    <li>คนที่มองหาวิธีเล่นบาคาร่าแบบมีระบบ มีเหตุผล มีหลักการ</li>
                  </ul>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span role="img" aria-label="chart">📈</span> <b>ระบบนี้ไม่ได้ให้คำตอบ แต่ให้ “กรอบคิด” ที่ได้เปรียบกว่า</b><br />
                  ในโลกของบาคาร่าที่คนส่วนใหญ่แพ้เพราะอารมณ์และความโลภ ตัว Indicator นี้คือเข็มทิศที่นำพาคุณกลับมาสู่เส้นทางของ "การควบคุม"<br />
                  <b>เพราะการควบคุมเกม เริ่มจากการควบคุมตัวเอง</b>
                </div>
                <div style={{ marginTop: 18, color: '#ffeb3b', fontWeight: 600, fontSize: 15 }}>
                  *freecash baccarat indicator คือองค์กรไม่แสวงหาผลกำไร สร้างโดยผู้เล่น เพื่อผู้เล่น*
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ส่วนฟอร์มงบประมาณ */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ marginRight: 8 }}>
            เงินทุนรวม:
            <input
              type="number"
              value={budget}
              min={1}
              style={{ width: 80, marginLeft: 4, marginRight: 16 }}
              onChange={e => {
                const val = Number(e.target.value);
                setBudget(val);
                setBalance(val); // ตั้ง balance ใหม่เมื่อเปลี่ยน budget
              }}
            />
          </label>
          <label style={{ marginRight: 8 }}>
            จำนวนเงินเดิมพัน/ไม้:
            <input
              type="number"
              value={betAmount}
              min={1}
              style={{ width: 80, marginLeft: 4 }}
              onChange={e => setBetAmount(Number(e.target.value))}
            />
          </label>
          <label style={{ marginLeft: 16, marginRight: 8 }}>
            ยอดเงินคงเหลือ:
            <input
              type="number"
              value={balance}
              style={{ width: 100, marginLeft: 4 }}
              onChange={e => setBalance(Number(e.target.value))}
            />
            <span style={{ marginLeft: 8, color: '#ffb700', fontWeight: 600 }}>
              {balance.toLocaleString()}
            </span>
          </label>
          <button
            style={{ marginLeft: 16 }}
            onClick={resetBudget}
          >
            รีเซ็ตงบประมาณ
          </button>
        </div>
        {/* ปุ่มจดผล */}
        <div>
          <button
            style={{
              background: isBetting ? '#ffb700' : '#444',
              color: isBetting ? '#222' : '#fff',
              marginRight: 12,
              padding: '8px 18px',
              borderRadius: 8,
              fontWeight: 600,
              border: 'none',
              fontSize: 16,
              cursor: 'pointer'
            }}
            onClick={() => setIsBetting(v => !v)} // toggle แทน
          >
            เล่นไม้นี้
          </button>
          <button
            style={{ background: 'blue', color: '#fff', marginRight: 8, width: 40, height: 40, fontSize: 18, borderRadius: '50%' }}
            onClick={() => addResult('P')}
          >
            P
          </button>
          <button
            style={{ background: 'red', color: '#fff', marginRight: 8, width: 40, height: 40, fontSize: 18, borderRadius: '50%' }}
            onClick={() => addResult('B')}
          >
            B
          </button>
          <button
            style={{ background: 'green', color: '#fff', width: 40, height: 40, fontSize: 18, borderRadius: '50%' }}
            onClick={() => addResult('T')}
          >
            T
          </button>
          <button
            style={{ marginLeft: 16 }}
            onClick={() => {
              setResults([]);
              setPrediction(null);
              setHistory([]);
              // ไม่ต้อง setStats({}) ในปุ่ม "เริ่มจดผลใหม่"
            }}
          >
            เริ่มจดผลใหม่
          </button>
        </div>
        {/* Popup ผลลัพธ์ */}
        {showResult && (
          <div
            style={{
              position: 'fixed',
              top: '30%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: showResult === 'win' ? '#2ecc40' : '#ff4136',
              color: '#fff',
              padding: '32px 48px',
              borderRadius: 16,
              fontSize: 32,
              fontWeight: 'bold',
              zIndex: 9999,
              boxShadow: '0 4px 32px #0008',
              transition: 'all 0.2s'
            }}
          >
            {showResult === 'win' ? 'ไม้นี้รวย' : 'ไม่เป็นไร เอาใหม่'}
          </div>
        )}
        {/* ตาราง Big Road */}
        <div
          style={{
            display: 'inline-block',
            background: '#222',
            padding: 8,
            borderRadius: 8,
            margin: '16px 0',
            // เพิ่มขนาดตาราง
            maxWidth: '100%',
            overflowX: 'auto'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bigRoad[0].length}, 38px)` }}>
            {bigRoad.map((row, rowIdx) =>
              row.map((cell, colIdx) => renderBigRoadCell(cell, rowIdx, colIdx))
            )}
          </div>
          <div style={{ color: '#ffeb3b', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
            *คลิกขวาที่วงกลมเพื่อลบผลลัพธ์*
          </div>
        </div>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 40 }}>
          {renderPredictionCircle(prediction)}
        </div>
        <div style={{ marginTop: 8, fontSize: 18, textAlign: 'center', color: '#ffeb3b', fontWeight: 600 }}>
          {prediction}
        </div>
        <div style={{ marginTop: 16, fontSize: 18 }}>
          <span style={{ color: 'lime' }}>ทายถูก: {correctCount} ตา</span>
          <span style={{ color: 'tomato', marginLeft: 16 }}>ทายผิด: {wrongCount} ตา</span>
        </div>
      </header>
      {/* ปุ่มสนับสนุนพวกเรา ล่างขวา */}
      <button
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          background: '#6c47ff',
          color: '#fff',
          border: 'none',
          borderRadius: 24,
          padding: '12px 28px',
          fontSize: 17,
          fontWeight: 'bold',
          boxShadow: '0 2px 12px #0005',
          cursor: 'pointer',
          zIndex: 1000,
          animation: 'popupZoomIn 0.3s'
        }}
        onClick={() => setShowSupport(true)}
      >
        สนับสนุนพวกเรา
      </button>
      {/* Popup สนับสนุน */}
      {showSupport && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            background: '#000a',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeInBg 0.3s'
          }}
          onClick={() => setShowSupport(false)}
        >
          <div
            style={{
              background: '#222',
              color: '#fff',
              padding: '32px 28px',
              borderRadius: 16,
              maxWidth: 380,
              fontSize: 18,
              boxShadow: '0 8px 32px #000a',
              position: 'relative',
              animation: 'popupZoomIn 0.3s'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              style={{
                position: 'absolute',
                top: 12,
                right: 16,
                background: 'transparent',
                color: '#fff',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer'
              }}
              onClick={() => setShowSupport(false)}
              aria-label="close"
            >×</button>
            <div style={{ textAlign: 'center', lineHeight: 1.8 }}>
              <b>บริจาคเพื่อสนับสนุนพวกเราได้ที่</b><br />
              <span style={{ color: '#ffeb3b' }}>บัญชี ไทยพาณิชย์/SCB :</span><br />
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: 1 }}>4058454859</span><br />
              <span>Mr. Kaiwen Li</span>
            </div>
          </div>
        </div>
      )}
      {showStats && renderStatsPopup()}
    </div>
  );
}

export default App;

// เพิ่ม CSS animation ในไฟล์ App.css หรือใน <style> global
// คุณสามารถวางไว้ใน App.css ได้เลย
/*
@keyframes fadeInBg {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes popupZoomIn {
  from { opacity: 0; transform: scale(0.85);}
  to { opacity: 1; transform: scale(1);}
}
*/
