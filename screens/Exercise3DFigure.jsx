import { useEffect, useRef, useState } from 'react';
import { View, PanResponder } from 'react-native';
import Svg, { Line, Circle, Defs, RadialGradient, Stop, Rect, Ellipse } from 'react-native-svg';

const KEYS = ['head','neck','torsoT','torsoB','shL','shR','elbL','elbR','wriL','wriR','hipL','hipR','kneL','kneR','ankL','ankR'];

const BONES = [
  ['head','neck'],['neck','torsoT'],['torsoT','torsoB'],
  ['torsoT','shL'],['torsoT','shR'],
  ['shL','elbL'],['shR','elbR'],
  ['elbL','wriL'],['elbR','wriR'],
  ['torsoB','hipL'],['torsoB','hipR'],
  ['hipL','kneL'],['hipR','kneR'],
  ['kneL','ankL'],['kneR','ankR'],
];

const ARM_SET = new Set(['shL,elbL','shR,elbR','elbL,wriL','elbR,wriR']);
const LEG_SET = new Set(['hipL,kneL','hipR,kneR','kneL,ankL','kneR,ankR']);

function boneRgb(a, b) {
  const key = `${a},${b}`;
  if (ARM_SET.has(key)) return '96,165,250';   // blue-400
  if (LEG_SET.has(key)) return '167,139,250';  // violet-400
  return '196,181,253';                         // violet-300 (torso/spine)
}

function lerp3(a, b, t) {
  const o = {};
  for (const k of KEYS) {
    const av = a[k] || [0,0,0], bv = b[k] || [0,0,0];
    o[k] = [av[0]+(bv[0]-av[0])*t, av[1]+(bv[1]-av[1])*t, av[2]+(bv[2]-av[2])*t];
  }
  return o;
}

function ease(t) { return t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }

function project(joints, ry, W, H) {
  const cosY = Math.cos(ry), sinY = Math.sin(ry);
  let mnX=1e9, mxX=-1e9, mnY=1e9, mxY=-1e9;
  const rot = {};
  for (const k of KEYS) {
    const [x,y,z] = joints[k] || [0,0,0];
    const xr = x*cosY - z*sinY;
    const zr = x*sinY + z*cosY;
    rot[k] = [xr, y, zr];
    if (xr < mnX) mnX = xr;
    if (xr > mxX) mxX = xr;
    if (y < mnY) mnY = y;
    if (y > mxY) mxY = y;
  }
  const pad = 0.68;
  const rX = mxX-mnX||1, rY = mxY-mnY||1;
  const sc = Math.min(W*pad/rX, H*0.82*pad/rY);
  const offX = W/2 - ((mnX+mxX)/2)*sc;
  const offY = H*0.50 + ((mnY+mxY)/2)*sc;
  const res = {};
  for (const k of KEYS) {
    const [xr,yr,zr] = rot[k];
    res[k] = { x: offX+xr*sc, y: offY-yr*sc, z: zr };
  }
  return res;
}

export default function Exercise3DFigure({ joints, width = 300, height = 260, autoRotate = true, initialRotY = 0.5 }) {
  const rotYRef = useRef(initialRotY);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const animTRef = useRef(1);
  const fromJRef = useRef(null);
  const prevJointsRef = useRef(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!autoRotate) return;
    const id = setInterval(() => {
      if (!draggingRef.current) rotYRef.current += 0.018;
      forceUpdate(n => n + 1);
    }, 33);
    return () => clearInterval(id);
  }, [autoRotate]);

  useEffect(() => {
    if (prevJointsRef.current && prevJointsRef.current !== joints) {
      fromJRef.current = prevJointsRef.current;
      animTRef.current = 0;
    }
    prevJointsRef.current = joints;
  }, [joints]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        draggingRef.current = true;
        lastXRef.current = e.nativeEvent.pageX;
      },
      onPanResponderMove: (e) => {
        rotYRef.current += (e.nativeEvent.pageX - lastXRef.current) * 0.01;
        lastXRef.current = e.nativeEvent.pageX;
        forceUpdate(n => n + 1);
      },
      onPanResponderRelease: () => { draggingRef.current = false; },
      onPanResponderTerminate: () => { draggingRef.current = false; },
    })
  ).current;

  if (!joints) return null;

  if (animTRef.current < 1) animTRef.current = Math.min(1, animTRef.current + 0.08);
  const pose = fromJRef.current && animTRef.current < 1
    ? lerp3(fromJRef.current, joints, ease(animTRef.current))
    : joints;

  const proj = project(pose, rotYRef.current, width, height);

  const bones2d = BONES
    .map(([a, b]) => ({ a, b, d: (proj[a].z + proj[b].z) / 2 }))
    .sort((x, y) => y.d - x.d);

  return (
    <View style={{ width, height }} {...panResponder.panHandlers}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="bgGrad" cx="50%" cy="42%" r="65%">
            <Stop offset="0%"   stopColor="#1C1040" stopOpacity="1" />
            <Stop offset="100%" stopColor="#06060C" stopOpacity="1" />
          </RadialGradient>
        </Defs>

        {/* Background */}
        <Rect x={0} y={0} width={width} height={height} fill="url(#bgGrad)" rx={14} />

        {/* Floor shadow */}
        <Ellipse
          cx={width / 2} cy={height * 0.93}
          rx={width * 0.15} ry={height * 0.02}
          fill="rgba(130,100,255,0.2)"
        />

        {/* Glow halos behind everything */}
        {BONES.map(([a, b], i) => (
          <Line
            key={`g${i}`}
            x1={proj[a].x} y1={proj[a].y}
            x2={proj[b].x} y2={proj[b].y}
            stroke={`rgba(${boneRgb(a, b)},0.12)`}
            strokeWidth={26}
            strokeLinecap="round"
          />
        ))}

        {/* Depth-sorted bone cores */}
        {bones2d.map(({ a, b, d }, i) => {
          const alpha = Math.max(0.2, 1 - Math.max(0, d + 0.5) * 0.32);
          return (
            <Line
              key={`b${i}`}
              x1={proj[a].x} y1={proj[a].y}
              x2={proj[b].x} y2={proj[b].y}
              stroke={`rgba(${boneRgb(a, b)},${alpha.toFixed(2)})`}
              strokeWidth={7}
              strokeLinecap="round"
            />
          );
        })}

        {/* Joints */}
        {KEYS.map((k) => {
          const p = proj[k];
          const alpha = Math.max(0.28, 1 - Math.max(0, p.z + 0.3) * 0.22);
          const isHead = k === 'head';
          const isTorso = k === 'torsoT' || k === 'torsoB';
          const r = isHead ? 12 : isTorso ? 6.5 : 4.5;
          return (
            <Circle
              key={k}
              cx={p.x} cy={p.y} r={r}
              fill={`rgba(196,181,253,${alpha.toFixed(2)})`}
              stroke={isHead ? `rgba(167,139,250,${(alpha * 0.8).toFixed(2)})` : 'none'}
              strokeWidth={isHead ? 2.5 : 0}
            />
          );
        })}
      </Svg>
    </View>
  );
}
