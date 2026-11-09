import { DESPACHOS } from "@/lib/despachos";

/**
 * Ilustración original inspirada en el Centro Administrativo La Alpujarra (Medellín):
 * torre con ventanería oscura, fachada de lamas verticales, muro inclinado de concreto,
 * banderas de Colombia, Antioquia y Medellín y el Monumento a la Raza.
 * Cada despacho de SINAPSIS es un punto luminoso; las líneas animadas son las "sinapsis".
 */

const LAMAS_ALA = Array.from({ length: 58 }, (_, i) => 585 + i * 10);
const ALETAS_IZQ = Array.from({ length: 22 }, (_, i) => 18 + i * 18);
const VENTANAS = Array.from({ length: 17 }, (_, i) => 296 + i * 10.5);

// pares de despachos conectados por sinapsis
const CONEXIONES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 2],
  [1, 3],
];

function Persona({ x, y, color, s = 1, anda = 0 }: { x: number; y: number; color: string; s?: number; anda?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {anda !== 0 && (
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`${x} ${y}; ${x + anda} ${y}; ${x} ${y}`}
          dur={`${Math.abs(anda) / 4}s`}
          repeatCount="indefinite"
        />
      )}
      <g transform={`scale(${s})`}>
        <circle cx="0" cy="-34" r="4.2" fill="#3b2f2a" />
        <rect x="-5" y="-29" width="10" height="16" rx="3" fill={color} />
        <rect x="-4.5" y="-14" width="4" height="14" rx="1.5" fill="#2c3445" />
        <rect x="0.5" y="-14" width="4" height="14" rx="1.5" fill="#2c3445" />
      </g>
    </g>
  );
}

function Bandera({ x, alto, franjas, nombre, retraso }: { x: number; alto: number; franjas: { c: string; h: number }[]; nombre: string; retraso: number }) {
  const top = 640 - alto;
  // posición vertical de cada franja = suma de las alturas anteriores
  const inicios = franjas.map((_, i) => franjas.slice(0, i).reduce((s, f) => s + f.h, 0));
  return (
    <g>
      <title>{`Bandera de ${nombre}`}</title>
      <rect x={x - 1.5} y={top} width="3" height={alto} fill="#9aa3ad" />
      <circle cx={x} cy={top - 2} r="3" fill="#c9a227" />
      <g className="bandera-ondea" style={{ animationDelay: `${retraso}s` }}>
        {franjas.map((f, i) => {
          const y = top + 4 + inicios[i];
          return (
            <path
              key={i}
              d={`M ${x + 1.5} ${y} q 22 -6 44 0 t 44 0 v ${f.h} q -22 -6 -44 0 t -44 0 z`}
              fill={f.c}
              stroke="rgba(0,0,0,.08)"
              strokeWidth="0.6"
            />
          );
        })}
      </g>
    </g>
  );
}

export default function EscenaAlpujarra() {
  return (
    <svg
      viewBox="0 0 1600 900"
      role="img"
      aria-labelledby="escena-titulo escena-desc"
      className="escena block h-auto w-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <title id="escena-titulo">Edificio SINAPSIS en La Alpujarra</title>
      <desc id="escena-desc">
        Ilustración de La Alpujarra con las banderas de Colombia, Antioquia y Medellín y el Monumento a la Raza. Los puntos
        luminosos son los despachos de SINAPSIS.
      </desc>
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f7fc4" />
          <stop offset="0.55" stopColor="#8fbde6" />
          <stop offset="1" stopColor="#dcebf7" />
        </linearGradient>
        <linearGradient id="concreto" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#efe6d6" />
          <stop offset="1" stopColor="#d9cdb8" />
        </linearGradient>
        <linearGradient id="muro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1e9da" />
          <stop offset="0.7" stopColor="#ddd1bc" />
          <stop offset="1" stopColor="#cbbda5" />
        </linearGradient>
        <linearGradient id="ala" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4150" />
          <stop offset="1" stopColor="#262b36" />
        </linearGradient>
        <linearGradient id="plaza" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8cfbf" />
          <stop offset="1" stopColor="#bfb4a1" />
        </linearGradient>
        <linearGradient id="bronce" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5b564b" />
          <stop offset="0.5" stopColor="#7a7262" />
          <stop offset="1" stopColor="#3f3b33" />
        </linearGradient>
        <filter id="nube" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="brillo" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Cielo y nubes */}
      <rect width="1600" height="900" fill="url(#cielo)" />
      {[
        { x: 120, y: 110, s: 1.2, d: 120 },
        { x: 700, y: 70, s: 1.6, d: 160 },
        { x: 1150, y: 150, s: 1.1, d: 140 },
        { x: 1400, y: 60, s: 0.9, d: 110 },
      ].map((n, i) => (
        <g key={i} filter="url(#nube)" opacity="0.92">
          <animateTransform attributeName="transform" type="translate" values="0 0; 60 0; 0 0" dur={`${n.d}s`} repeatCount="indefinite" />
          <g transform={`translate(${n.x} ${n.y}) scale(${n.s})`}>
            <ellipse cx="0" cy="20" rx="110" ry="34" fill="#fff" />
            <ellipse cx="-40" cy="0" rx="55" ry="40" fill="#fff" />
            <ellipse cx="35" cy="-8" rx="65" ry="50" fill="#fff" />
            <ellipse cx="90" cy="14" rx="45" ry="30" fill="#f4f8fc" />
          </g>
        </g>
      ))}

      {/* Montañas del Valle de Aburrá */}
      <path d="M0 610 L120 560 L260 585 L420 540 L600 575 L820 530 L1000 560 L1180 520 L1360 555 L1600 525 L1600 660 L0 660 Z" fill="#9db0c2" opacity="0.8" />
      <path d="M0 640 L180 600 L360 625 L560 595 L760 620 L980 590 L1200 615 L1420 585 L1600 605 L1600 660 L0 660 Z" fill="#7f9a8f" opacity="0.85" />
      {/* Ciudad lejana */}
      <g fill="#a9b6c3" opacity="0.9">
        {[1180, 1215, 1240, 1290, 1320, 1470, 1500, 1540, 1570].map((x, i) => (
          <rect key={x} x={x} y={600 - ((i * 37) % 60)} width="24" height={60 + ((i * 37) % 60)} />
        ))}
      </g>

      {/* Aletas del ala izquierda */}
      <path d="M0 400 L420 360 L420 640 L0 640 Z" fill="url(#concreto)" />
      {ALETAS_IZQ.map((x, i) => (
        <path key={x} d={`M${x} ${398 - i * 1.8} l8 -14 l0 ${256 + i * 1.8} l-8 0 z`} fill="#c8bba4" />
      ))}

      {/* Torre principal */}
      <rect x="180" y="110" width="400" height="530" fill="url(#concreto)" />
      <rect x="180" y="110" width="400" height="14" fill="#f6efe3" />
      <rect x="290" y="160" width="180" height="300" fill="#1f2633" />
      {VENTANAS.map((x) => (
        <line key={x} x1={x} y1="160" x2={x} y2="460" stroke="#56627a" strokeWidth="1.4" />
      ))}
      {[220, 280, 340, 400].map((y) => (
        <line key={y} x1="290" y1={y} x2="470" y2={y} stroke="#3a4558" strokeWidth="1" />
      ))}
      {/* reflejos en la ventanería */}
      <rect x="300" y="170" width="40" height="280" fill="#7fb2e5" opacity="0.12" />

      {/* Ala de lamas verticales */}
      <path d="M560 225 L1160 300 L1160 640 L560 640 Z" fill="url(#ala)" />
      {LAMAS_ALA.map((x) => {
        const yTop = 225 + ((x - 560) / 600) * 75;
        return <line key={x} x1={x} y1={yTop + 8} x2={x} y2="640" stroke="#c9bfae" strokeWidth="3.2" opacity="0.9" />;
      })}
      <path d="M560 216 L1160 291 L1160 304 L560 229 Z" fill="#eadfcb" />

      {/* Muro inclinado de concreto */}
      <path d="M392 330 L700 300 L770 640 L360 640 Z" fill="url(#muro)" />
      <path d="M700 300 L770 640 L740 640 L688 312 Z" fill="#bfae92" opacity="0.6" />
      {/* sombra de la escultura sobre el muro, como en la plaza real */}
      <path d="M600 470 q 10 -60 30 -90 q 6 30 -6 70 q 20 30 10 90 q -20 10 -34 -10 z" fill="#8f826d" opacity="0.35" />

      {/* Banderas */}
      <Bandera x={985} alto={300} nombre="Antioquia" retraso={0} franjas={[{ c: "#ffffff", h: 22 }, { c: "#1f8a3b", h: 22 }]} />
      <Bandera
        x={1045}
        alto={330}
        nombre="Colombia"
        retraso={0.6}
        franjas={[
          { c: "#fcd116", h: 22 },
          { c: "#003893", h: 11 },
          { c: "#ce1126", h: 11 },
        ]}
      />
      <Bandera x={1105} alto={300} nombre="Medellín" retraso={1.2} franjas={[{ c: "#ffffff", h: 22 }, { c: "#16a34a", h: 22 }]} />

      {/* Monumento a la Raza (silueta estilizada) */}
      <g>
        <title>Monumento a la Raza</title>
        <path d="M1250 640 q 40 -40 110 -48 q 70 -6 120 30 l 0 18 z" fill="#4b4a44" />
        <path d="M1240 640 q 60 -70 170 -60 l 6 10 q -100 -4 -160 54 z" fill="#6b6658" />
        <path
          d="M1330 610 C 1300 470 1330 330 1400 210 C 1420 175 1440 140 1452 108 C 1460 150 1452 190 1440 230 C 1410 340 1395 470 1400 600 Z"
          fill="url(#bronce)"
        />
        <path d="M1452 108 l 14 -22 l -2 22 l 16 -10 l -14 22 z" fill="#5e594d" />
        {[250, 320, 390, 460, 530].map((y, i) => (
          <path key={y} d={`M${1380 - i * 6} ${y} q 18 -10 34 2 q -14 16 -34 -2 z`} fill="#3c382f" opacity="0.7" />
        ))}
      </g>

      {/* Plaza */}
      <path d="M0 640 L1600 640 L1600 900 L0 900 Z" fill="url(#plaza)" />
      {Array.from({ length: 13 }, (_, i) => (
        <line key={i} x1={800} y1={640} x2={-400 + i * 200} y2={900} stroke="#b3a893" strokeWidth="1" opacity="0.5" />
      ))}
      {[680, 730, 800, 890].map((y) => (
        <line key={y} x1="0" y1={y} x2="1600" y2={y} stroke="#b3a893" strokeWidth="1" opacity="0.4" />
      ))}
      {/* jardinera */}
      <rect x="0" y="628" width="460" height="22" fill="#c4b79f" />

      {/* Árboles */}
      {[
        { x: 70, y: 560, r: 70 },
        { x: 150, y: 590, r: 55 },
        { x: 250, y: 575, r: 62 },
      ].map((a, i) => (
        <g key={i}>
          <rect x={a.x - 5} y={a.y} width="10" height={640 - a.y} fill="#5b4636" />
          <circle cx={a.x} cy={a.y} r={a.r} fill="#2f6b3a" />
          <circle cx={a.x - a.r * 0.4} cy={a.y - a.r * 0.3} r={a.r * 0.6} fill="#3e8248" />
          <circle cx={a.x + a.r * 0.35} cy={a.y - a.r * 0.15} r={a.r * 0.5} fill="#36763f" />
        </g>
      ))}

      {/* Toldos de vendedores */}
      {[
        { x: 880, c: "#2563eb" },
        { x: 960, c: "#dc2626" },
        { x: 1180, c: "#1d4ed8" },
        { x: 1250, c: "#dc2626" },
      ].map((t, i) => (
        <g key={i}>
          <rect x={t.x - 1} y="648" width="2" height="26" fill="#6b7280" />
          <path d={`M${t.x - 28} 652 Q ${t.x} 630 ${t.x + 28} 652 Z`} fill={t.c} />
        </g>
      ))}

      {/* Personas en la plaza */}
      <Persona x={120} y={740} color="#ef4444" s={1.3} anda={40} />
      <Persona x={330} y={770} color="#f8fafc" s={1.4} />
      <Persona x={520} y={730} color="#0ea5e9" s={1.2} anda={-50} />
      <Persona x={700} y={790} color="#f97316" s={1.5} anda={30} />
      <Persona x={860} y={720} color="#64748b" s={1.1} />
      <Persona x={1080} y={760} color="#a855f7" s={1.35} anda={-40} />
      <Persona x={1300} y={735} color="#22c55e" s={1.2} anda={35} />
      <Persona x={1470} y={800} color="#e11d48" s={1.5} />

      {/* Sinapsis: conexiones entre despachos */}
      <g className="sinapsis">
        {CONEXIONES.map(([a, b], i) => {
          const A = DESPACHOS[a];
          const B = DESPACHOS[b];
          const mx = (A.x + B.x) / 2;
          const my = Math.min(A.y, B.y) - 70;
          const d = `M${A.x} ${A.y} Q ${mx} ${my} ${B.x} ${B.y}`;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="#7dd3fc" strokeWidth="2" strokeOpacity="0.55" strokeDasharray="6 8" className="sinapsis-linea" />
              <circle r="4" fill="#e0f2fe" filter="url(#brillo)">
                <animateMotion dur={`${3 + i * 0.7}s`} repeatCount="indefinite" path={d} />
              </circle>
            </g>
          );
        })}
      </g>

      {/* Despachos */}
      {DESPACHOS.map((d, i) => (
        <a key={d.id} href={d.listo ? d.ruta : "/"} className="despacho" aria-label={`${d.nombre}: ${d.descripcion}`}>
          <circle cx={d.x} cy={d.y} r="26" fill={d.color} opacity="0.25">
            <animate attributeName="r" values="18;34;18" dur="2.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.45;0;0.45" dur="2.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </circle>
          <circle cx={d.x} cy={d.y} r="11" fill={d.color} stroke="#0b1324" strokeWidth="3" filter="url(#brillo)" />
          <g className="despacho-etiqueta">
            <rect x={d.x - 92} y={d.y - 62} width="184" height="34" rx="17" fill="#0b1324" fillOpacity="0.88" stroke={d.color} strokeWidth="1.5" />
            <text x={d.x} y={d.y - 40} textAnchor="middle" fill="#f8fafc" fontSize="15" fontWeight="700" fontFamily="var(--font-jakarta), sans-serif">
              {d.nombre}
            </text>
          </g>
        </a>
      ))}
    </svg>
  );
}
