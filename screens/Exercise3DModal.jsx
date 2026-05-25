// Exercise3DModal.jsx — full-screen 3D stick-figure exercise form viewer.
// Renders a perspective-projected 3D figure using canvas 2D (no CDN / offline-safe).
// Figures are defined as 16-joint skeletons animated between poses per slide.

import { useState, useRef, useCallback } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet,
  SafeAreaView, StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getExercise3DData } from './exercise3DData';

// ─── VIEWER HTML ─────────────────────────────────────────────────────────────
// Self-contained: perspective projection + Y-axis auto-rotation + touch drag.
// The exercise data is embedded by buildViewerHTML() so no injection is needed.

function buildViewerHTML(slideData) {
  const json = JSON.stringify(slideData);
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0A0A10;overflow:hidden;width:100vw;height:100vh;touch-action:none}
canvas{display:block}
#phase{position:absolute;top:14px;left:0;right:0;text-align:center;
  color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;
  pointer-events:none}
#cue{position:absolute;bottom:36px;left:18px;right:18px;text-align:center;
  color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  font-size:13px;line-height:1.55;pointer-events:none}
#dots{position:absolute;bottom:14px;left:0;right:0;display:flex;
  justify-content:center;gap:7px;pointer-events:none}
.dot{width:5px;height:5px;border-radius:3px;background:#2C2C35;transition:all .25s}
.dot.on{background:#FFFFFF;width:18px}
</style>
</head><body>
<div id="phase"></div>
<canvas id="c"></canvas>
<div id="cue"></div>
<div id="dots"></div>
<script>
const SLIDES = ${json};
const BONES = [
  ['head','neck'],['neck','torsoT'],['torsoT','torsoB'],
  ['torsoT','shL'],['torsoT','shR'],
  ['shL','elbL'],['shR','elbR'],
  ['elbL','wriL'],['elbR','wriR'],
  ['torsoB','hipL'],['torsoB','hipR'],
  ['hipL','kneL'],['hipR','kneR'],
  ['kneL','ankL'],['kneR','ankR'],
];
const KEYS=['head','neck','torsoT','torsoB','shL','shR','elbL','elbR','wriL','wriR','hipL','hipR','kneL','kneR','ankL','ankR'];

const c=document.getElementById('c');
const ctx=c.getContext('2d');
function resize(){c.width=window.innerWidth;c.height=window.innerHeight}
resize();window.addEventListener('resize',resize);

let fromJ=null,toJ=null,animT=1,slideIdx=0,rotY=0.5,dragging=false,lastDX=0;

function lerp3(a,b,t){
  const o={};
  for(const k of KEYS){
    const av=a[k]||[0,0,0],bv=b[k]||[0,0,0];
    o[k]=[av[0]+(bv[0]-av[0])*t,av[1]+(bv[1]-av[1])*t,av[2]+(bv[2]-av[2])*t];
  }
  return o;
}
function ease(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2}

function project(joints,ry){
  const W=c.width,H=c.height;
  const cosY=Math.cos(ry),sinY=Math.sin(ry);
  let mnX=1e9,mxX=-1e9,mnY=1e9,mxY=-1e9;
  const rot={};
  for(const k of KEYS){
    const[x,y,z]=joints[k]||[0,0,0];
    const xr=x*cosY-z*sinY,zr=x*sinY+z*cosY;
    rot[k]=[xr,y,zr];
    if(xr<mnX)mnX=xr;if(xr>mxX)mxX=xr;
    if(y<mnY)mnY=y;if(y>mxY)mxY=y;
  }
  const pad=0.72;
  const rX=mxX-mnX||1,rY=mxY-mnY||1;
  const sc=Math.min(W*pad/rX,H*0.55*pad/rY);
  const offX=W/2-((mnX+mxX)/2)*sc;
  const offY=H*0.44+((mnY+mxY)/2)*sc;
  const res={};
  for(const k of KEYS){
    const[xr,yr,zr]=rot[k];
    res[k]={x:offX+xr*sc,y:offY-yr*sc,z:zr};
  }
  return res;
}

function drawFrame(){
  const W=c.width,H=c.height;
  ctx.clearRect(0,0,W,H);

  if(!toJ){requestAnimationFrame(drawFrame);return}
  animT=Math.min(1,animT+0.06);
  const t=ease(animT);
  const pose=fromJ&&animT<1?lerp3(fromJ,toJ,t):toJ;

  if(!dragging)rotY+=0.006;
  const proj=project(pose,rotY);

  const bones2=[...BONES].map(([a,b])=>({a,b,d:(proj[a].z+proj[b].z)/2}))
    .sort((x,y)=>y.d-x.d);

  for(const{a,b,d}of bones2){
    const pa=proj[a],pb=proj[b];
    const alpha=Math.max(0.22,1-Math.max(0,d)*0.14);
    ctx.save();
    ctx.strokeStyle=\`rgba(83,74,183,\${alpha.toFixed(2)})\`;
    ctx.lineWidth=5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();
    ctx.restore();
  }

  for(const k of KEYS){
    const p=proj[k];
    const alpha=Math.max(0.28,1-Math.max(0,p.z)*0.12);
    const r=k==='head'?12:k==='torsoT'||k==='torsoB'?6:4.5;
    ctx.save();
    ctx.fillStyle=\`rgba(168,159,232,\${alpha.toFixed(2)})\`;
    if(k==='head'){
      ctx.strokeStyle=\`rgba(83,74,183,\${alpha.toFixed(2)})\`;
      ctx.lineWidth=2.5;
    }
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);
    ctx.fill();
    if(k==='head')ctx.stroke();
    ctx.restore();
  }

  requestAnimationFrame(drawFrame);
}

function updateUI(){
  const s=SLIDES[slideIdx];
  document.getElementById('phase').textContent=s.phase;
  document.getElementById('cue').textContent=s.cue;
  document.getElementById('dots').innerHTML=
    SLIDES.map((_,i)=>\`<div class="dot\${i===slideIdx?' on':''}"></div>\`).join('');
}

function goSlide(idx){
  if(idx<0||idx>=SLIDES.length)return;
  fromJ=toJ;toJ=SLIDES[idx].joints;
  animT=fromJ?0:1;slideIdx=idx;
  updateUI();
}

// Touch drag to rotate
c.addEventListener('touchstart',e=>{dragging=true;lastDX=e.touches[0].clientX});
c.addEventListener('touchmove',e=>{
  if(dragging){rotY+=(e.touches[0].clientX-lastDX)*0.009;lastDX=e.touches[0].clientX}
});
c.addEventListener('touchend',()=>{dragging=false});

// Called from React Native via injectJavaScript for slide nav
window.goSlide=goSlide;

goSlide(0);
drawFrame();
</script>
</body></html>`;
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function Exercise3DModal({ exerciseName, onClose }) {
  const data = getExercise3DData(exerciseName);
  const [slideIdx, setSlideIdx] = useState(0);
  const webRef = useRef(null);
  const totalSlides = data?.slides?.length ?? 0;

  const injectGoSlide = useCallback((idx) => {
    webRef.current?.injectJavaScript(`window.goSlide(${idx}); true;`);
  }, []);

  function prevSlide() {
    const next = Math.max(0, slideIdx - 1);
    setSlideIdx(next);
    injectGoSlide(next);
  }

  function nextSlide() {
    const next = Math.min(totalSlides - 1, slideIdx + 1);
    setSlideIdx(next);
    injectGoSlide(next);
  }

  if (!data) return null;

  const html = buildViewerHTML(data.slides);

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A10" />
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{exerciseName}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeBtnText}>Done</Text>
          </Pressable>
        </View>

        {/* 3D canvas */}
        <View style={styles.viewer}>
          <WebView
            ref={webRef}
            source={{ html }}
            style={styles.webview}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            androidLayerType="hardware"
            backgroundColor="#0A0A10"
          />
        </View>

        {/* Navigation */}
        <View style={styles.navRow}>
          <Pressable
            style={[styles.navBtn, slideIdx === 0 && styles.navBtnDisabled]}
            onPress={prevSlide}
            disabled={slideIdx === 0}
          >
            <Text style={[styles.navArrow, slideIdx === 0 && styles.navArrowDim]}>‹</Text>
            <Text style={[styles.navLabel, slideIdx === 0 && styles.navLabelDim]}>Prev</Text>
          </Pressable>

          <Text style={styles.slideCount}>{slideIdx + 1} / {totalSlides}</Text>

          <Pressable
            style={[styles.navBtn, slideIdx === totalSlides - 1 && styles.navBtnDisabled]}
            onPress={nextSlide}
            disabled={slideIdx === totalSlides - 1}
          >
            <Text style={[styles.navLabel, slideIdx === totalSlides - 1 && styles.navLabelDim]}>Next</Text>
            <Text style={[styles.navArrow, slideIdx === totalSlides - 1 && styles.navArrowDim]}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>Drag to rotate · Swipe slides with arrows</Text>

      </SafeAreaView>
    </Modal>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E1E28',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 12,
  },
  closeBtn: {
    backgroundColor: '#1A1A24',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: '#2C2C35',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewer: {
    flex: 1,
    backgroundColor: '#0A0A10',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0A0A10',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#1E1E28',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#111114',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2C2C35',
    minWidth: 80,
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  navArrow: {
    fontSize: 22,
    color: '#FFFFFF',
    lineHeight: 24,
    fontWeight: '300',
  },
  navArrowDim: {
    color: '#52525B',
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navLabelDim: {
    color: '#52525B',
  },
  slideCount: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hint: {
    textAlign: 'center',
    fontSize: 10,
    color: '#3D3D4A',
    paddingBottom: 12,
    letterSpacing: 0.3,
  },
});
