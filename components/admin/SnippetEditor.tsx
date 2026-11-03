'use client';

import { useEffect, useRef, useState } from 'react';

type Slot = { id: string; label: string; fileId: string | null; start: number; length: number };
type Track = { id: string; file: File; duration: number; buffer: AudioBuffer; waveform: number[] };
const createSlot = (id: string, label: string): Slot => ({ id, label, fileId: null, start: 0, length: 10 });
const initialSlots = (): Slot[] => [
  ...Array.from({ length: 5 }, (_, i) => createSlot('platz-' + (i + 1), 'Platz ' + (i + 1))),
  ...Array.from({ length: 3 }, (_, i) => createSlot('zonk-' + (i + 1), 'Zonk ' + (i + 1))),
];
const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
const filename = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '');
function envelope(buffer: AudioBuffer, count = 200) {
  const audio = buffer.getChannelData(0), peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.floor(i * audio.length / count), b = Math.floor((i + 1) * audio.length / count);
    let peak = 0;
    for (let j = a; j < b; j += Math.max(1, Math.floor((b-a) / 90))) peak = Math.max(peak, Math.abs(audio[j]));
    peaks.push(peak);
  }
  return peaks;
}
function wavBlob(buffer: AudioBuffer, start: number, seconds: number): Blob {
  const rate = buffer.sampleRate;
  const first = Math.floor(start * rate), frames = Math.min(Math.floor(seconds * rate), buffer.length - first);
  const channels = Math.min(buffer.numberOfChannels, 2);
  const data = new ArrayBuffer(44 + frames * channels * 2), view = new DataView(data);
  const str = (at: number, val: string) => { for (let i = 0; i < val.length; i++) view.setUint8(at+i, val.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, data.byteLength-8, true); str(8,'WAVE'); str(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true);
  view.setUint32(24,rate,true); view.setUint32(28,rate*channels*2,true);
  view.setUint16(32,channels*2,true); view.setUint16(34,16,true);
  str(36,'data'); view.setUint32(40,frames*channels*2,true);
  const source = Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
  let p=44;
  for(let i=0;i<frames;i++) for(let ch=0;ch<channels;ch++){
    const sample=clamp(source[ch][first+i] || 0,-1,1);
    view.setInt16(p,sample<0?Math.round(sample*32768):Math.round(sample*32767),true); p+=2;
  }
  return new Blob([data],{type:'audio/wav'});
}
function save(blob: Blob, name: string) {
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),120000);
}
function Waveform({ track, slot, onPosition }: { track: Track; slot: Slot; onPosition: (n:number)=>void }) {
  const svg = useRef<SVGSVGElement>(null);
  const end = slot.start + slot.length;
  return <div>
    <svg ref={svg} viewBox="0 0 800 96" preserveAspectRatio="none" role="slider" tabIndex={0}
      aria-label={'Startpunkt für ' + slot.label} aria-valuemin={0} aria-valuemax={Math.max(0,track.duration-slot.length)}
      aria-valuenow={slot.start} style={{width:'100%',height:100,cursor:'crosshair',background:'#17202c',borderRadius:10,touchAction:'none'}}
      onPointerDown={e=>{const bounds=e.currentTarget.getBoundingClientRect(); onPosition(clamp((e.clientX-bounds.left)/bounds.width*track.duration-slot.length/2,0,Math.max(0,track.duration-slot.length))); e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(e.buttons===1){const bounds=e.currentTarget.getBoundingClientRect(); onPosition(clamp((e.clientX-bounds.left)/bounds.width*track.duration-slot.length/2,0,Math.max(0,track.duration-slot.length)));}}}
      onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onPosition(clamp(slot.start+(e.key==='ArrowLeft'?-0.5:0.5),0,Math.max(0,track.duration-slot.length)));}}}>
      {track.waveform.map((h,i)=><rect key={i} x={i*4+.4} y={48-Math.max(1,h*44)} width="2.9" height={Math.max(2,h*88)} rx="1.2" fill={i/track.waveform.length*track.duration>=slot.start && i/track.waveform.length*track.duration<=end?'#ff792f':'#92a0ae'}/>)}
      <rect x={slot.start/track.duration*800} y="0" width={slot.length/track.duration*800} height="96" fill="#ff782a" fillOpacity=".14" stroke="#ff782a" strokeWidth="2" pointerEvents="none" />
    </svg>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#64748b'}}><span>00:00</span><span>{fmt(track.duration)}</span></div>
  </div>;
}
export default function SnippetEditor() {
  const [slots,setSlots]=useState<Slot[]>(initialSlots);
  const [tracks,setTracks]=useState<Track[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [playing,setPlaying]=useState<string|null>(null);
  const [exporting,setExporting]=useState(false);
  const audioContext=useRef<AudioContext|null>(null);
  const active=useRef<{source:AudioBufferSourceNode; timer:ReturnType<typeof setTimeout>}|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{if(active.current){clearTimeout(active.current.timer);try{active.current.source.stop();}catch{}};void audioContext.current?.close();},[]);
  function change(id:string,values:Partial<Slot>){setSlots(old=>old.map(s=>s.id===id?{...s,...values}:s));}
  function stop(){if(active.current){clearTimeout(active.current.timer);try{active.current.source.stop();}catch{}active.current=null;}setPlaying(null);}
  async function upload(files:FileList|null){
    if(!files?.length)return;
    stop();setBusy(true);setError('');
    try{
      const ctx=audioContext.current || new AudioContext();audioContext.current=ctx;
      const loaded:Track[]=[];const failed:string[]=[];
      for(const file of Array.from(files)){
        try{
          const buffer=await ctx.decodeAudioData(await file.arrayBuffer());
          if(buffer.duration<8)throw new Error('Datei ist kürzer als 8 Sekunden');
          loaded.push({id:crypto.randomUUID(),file,duration:buffer.duration,buffer,waveform:envelope(buffer)});
        }catch{failed.push(file.name);}
      }
      setTracks(old=>[...old,...loaded]);
      setSlots(old=>{const next=old.map(s=>({...s}));for(const track of loaded){const free=next.find(s=>!s.fileId);if(free)free.fileId=track.id;}return next;});
      if(failed.length)setError('Nicht lesbar oder zu kurz: '+failed.join(', '));
    }catch{setError('Audiodateien konnten nicht verarbeitet werden. Bitte MP3 oder WAV verwenden.');}
    finally{setBusy(false);if(fileInput.current)fileInput.current.value='';}
  }
  async function preview(s:Slot,t:Track){
    if(playing===s.id){stop();return;}
    stop();
    const ctx=audioContext.current || new AudioContext();audioContext.current=ctx;
    await ctx.resume();
    const source=ctx.createBufferSource();source.buffer=t.buffer;source.connect(ctx.destination);
    source.start(0,s.start,s.length);
    const timer=setTimeout(()=>{active.current=null;setPlaying(null);},s.length*1000+80);
    active.current={source,timer};setPlaying(s.id);
  }
  const valid=(s:Slot,t?:Track)=>Boolean(t && s.length>=8 && s.length<=12 && s.start>=0 && s.start+s.length<=t.duration+.0001);
  const ready=slots.filter(s=>valid(s,tracks.find(t=>t.id===s.fileId)));
  async function exportOne(s:Slot){
    const t=tracks.find(t=>t.id===s.fileId);if(!valid(s,t)||!t)return;
    save(wavBlob(t.buffer,s.start,s.length),filename(s.label)+'_'+filename(t.file.name.replace(/\.[^.]+$/,''))+'.wav');
  }
  async function exportAll(){
    setExporting(true);setError('');
    try{
      const JSZip=(await import('jszip')).default;
      const zip=new JSZip();
      for(const s of ready){const t=tracks.find(t=>t.id===s.fileId)!;zip.file(filename(s.label)+'_'+filename(t.file.name.replace(/\.[^.]+$/,''))+'.wav',wavBlob(t.buffer,s.start,s.length));}
      save(await zip.generateAsync({type:'blob'}),'KHS_Release_Check_Snippets.zip');
    }catch{setError('ZIP konnte nicht erstellt werden. Einzel-Downloads sind weiterhin möglich.');}
    finally{setExporting(false);}
  }
  const field:React.CSSProperties={padding:'9px 12px',border:'1px solid #cbd5e1',borderRadius:10,background:'#fff',maxWidth:'100%'};
  const action:React.CSSProperties={...field,cursor:'pointer',fontWeight:800};
  return <div style={{maxWidth:1050,margin:'0 auto',padding:'12px 0 42px'}}>
    <header style={{marginBottom:24}}>
      <p style={{color:'#ea580c',fontWeight:900,letterSpacing:2,fontSize:12}}>KNALLHART SERVIERT · RELEASE-CHECK</p>
      <h1 style={{fontSize:36,margin:'8px 0'}}>Song-Snippets</h1>
      <p style={{color:'#64748b'}}>Mehrere Songs hochladen, den Top-Plätzen und Zonks zuordnen und 8–12 Sekunden lange Ausschnitte erstellen. Die Dateien bleiben auf deinem Gerät.</p>
    </header>
    <section style={{padding:20,background:'#fff',borderRadius:18,boxShadow:'0 8px 30px #0000000a',marginBottom:20}}>
      <input ref={fileInput} type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg" multiple
        onChange={e=>void upload(e.target.files)} style={{display:'none'}} id="snippet-file-input"/>
      <button type="button" style={{...action,background:'#f05a16',color:'#fff',border:'none',padding:'14px 22px'}} disabled={busy} onClick={()=>fileInput.current?.click()}>
        {busy?'Songs werden geladen …':'＋ Songs auswählen (Mehrfach-Upload)'}
      </button>
      <span style={{marginLeft:12,color:'#64748b',fontSize:13}}>{tracks.length} Songs geladen</span>
      {tracks.length>0&&<p style={{fontSize:13,color:'#64748b',marginBottom:0}}>Neue Songs werden automatisch freien Feldern zugeordnet. Die Zuordnung lässt sich jederzeit ändern; ein Song kann auch mehrfach verwendet werden.</p>}
      {error&&<p role="alert" style={{color:'#b91c1c',fontWeight:700}}>{error}</p>}
    </section>
    <div style={{display:'grid',gap:16}}>
      {slots.map(slot=>{
        const t=tracks.find(t=>t.id===slot.fileId);
        const ok=valid(slot,t);
        return <section key={slot.id} style={{border:'1px solid #e2e8f0',borderRadius:18,padding:18,background:'#fff',boxShadow:'0 5px 20px #00000008'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,marginBottom:14}}>
            <h2 style={{fontSize:20,margin:0}}>{slot.label}</h2>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {t&&<span style={{fontSize:13,color:ok?'#15803d':'#b91c1c',fontWeight:800}}>{ok?slot.length.toFixed(1)+' Sek. ✓':'⚠ 8–12 Sekunden erforderlich'}</span>}
              {slot.id.startsWith('extra-')&&<button style={action} onClick={()=>{stop();setSlots(old=>old.filter(s=>s.id!==slot.id));}}>Entfernen</button>}
            </div>
          </div>
          <select aria-label={'Song für '+slot.label} value={slot.fileId||''} style={{...field,width:'100%',marginBottom:12}} onChange={e=>{stop();change(slot.id,{fileId:e.target.value||null,start:0,length:10});}}>
            <option value="">Song auswählen</option>
            {tracks.map(track=><option key={track.id} value={track.id}>{track.file.name} ({fmt(track.duration)})</option>)}
          </select>
          {t&&<>
            <Waveform track={t} slot={slot} onPosition={start=>{stop();change(slot.id,{start:Math.round(start*10)/10});}}/>
            <div style={{display:'flex',gap:14,alignItems:'end',flexWrap:'wrap',marginTop:12}}>
              <label style={{fontSize:13,fontWeight:750}}>Start (Sek.)<br/><input style={{...field,width:110}} type="number" min="0" max={Math.max(0,t.duration-slot.length)} step=".1" value={slot.start} onChange={e=>{stop();change(slot.id,{start:Number(e.target.value)});}}/></label>
              <label style={{fontSize:13,fontWeight:750}}>Länge (Sek.)<br/><input style={{...field,width:110}} type="number" min="0.1" max={t.duration} step=".1" value={slot.length} onChange={e=>{stop();change(slot.id,{length:Number(e.target.value)});}}/></label>
              <button style={action} disabled={!ok} onClick={()=>void preview(slot,t)}>{playing===slot.id?'■ Stop':'▶ Ausschnitt anhören'}</button>
              <button style={{...action,background:ok?'#17202c':'#e2e8f0',color:ok?'#fff':'#64748b'}} disabled={!ok} onClick={()=>void exportOne(slot)}>↓ WAV herunterladen</button>
            </div>
            {!ok&&<p role="alert" style={{fontSize:13,color:'#b91c1c',marginBottom:0}}>Der Ausschnitt muss 8 bis 12 Sekunden lang sein und vollständig innerhalb des Songs liegen.</p>}
          </>}
        </section>;
      })}
    </div>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',marginTop:22}}>
      <button style={action} onClick={()=>setSlots(old=>[...old,createSlot('extra-'+crypto.randomUUID(),'Platz '+(old.filter(x=>x.id.startsWith('platz-')||x.id.startsWith('extra-')).length+1))])}>＋ Weiteren Platz hinzufügen</button>
      <button style={{...action,background:'#f05a16',color:'#fff',border:'none',padding:'13px 18px'}} disabled={!ready.length||exporting} onClick={()=>void exportAll()}>{exporting?'ZIP wird erstellt …':`↓ Alle fertigen Snippets als ZIP (${ready.length})`}</button>
    </div>
    <p style={{fontSize:13,color:'#64748b',marginTop:18}}>Export als unkomprimierte WAV-Datei in Original-Samplerate (16 Bit). Damit vermeidest du einen Qualitätsverlust durch erneutes MP3-Encoding. Die meisten Schnittprogramme und Riverside-Workflows akzeptieren WAV.</p>
  </div>;
}
