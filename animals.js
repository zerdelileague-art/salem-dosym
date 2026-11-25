// Мультяшные зверята для гонки: кошечка, зайчик, медвежонок, лисичка, панда (SVG).

export const ANIMALS = ['cat', 'bunny', 'bear', 'fox', 'panda'];

const P = {
  cat:   { body: '#ffcfae', line: '#d98868', belly: '#fff3e8', leg: '#ffd9bd', nose: '#ff8aa5' },
  bunny: { body: '#f7f3ff', line: '#a99cc9', belly: '#ffffff', leg: '#ffffff', nose: '#ff8aa5' },
  bear:  { body: '#c99a74', line: '#8a5e40', belly: '#ecd2b8', leg: '#b88660', nose: '#5a3a2a' },
  fox:   { body: '#ff9f5a', line: '#cf6a2a', belly: '#fff6ec', leg: '#5a3d36', nose: '#3a2742' },
  panda: { body: '#fbfbff', line: '#5c5c70', belly: '#ffffff', leg: '#3b3b4a', nose: '#3b3b4a' }
};

function ears(k, c) {
  const s = `stroke="${c.line}" stroke-width="2.5" stroke-linejoin="round"`;
  switch (k) {
    case 'cat': return `<path d="M26 38 L29 11 L47 27 Z" fill="${c.body}" ${s}/><path d="M31 31 L32 18 L41 26 Z" fill="#ffb3c6"/>
      <path d="M74 38 L71 11 L53 27 Z" fill="${c.body}" ${s}/><path d="M69 31 L68 18 L59 26 Z" fill="#ffb3c6"/>`;
    case 'bunny': return `<g transform="rotate(-12 39 22)"><ellipse cx="39" cy="14" rx="7.5" ry="19" fill="${c.body}" ${s}/><ellipse cx="39" cy="15" rx="3.6" ry="13" fill="#ffc2d4"/></g>
      <g transform="rotate(12 61 22)"><ellipse cx="61" cy="14" rx="7.5" ry="19" fill="${c.body}" ${s}/><ellipse cx="61" cy="15" rx="3.6" ry="13" fill="#ffc2d4"/></g>`;
    case 'bear': return `<circle cx="29" cy="27" r="9.5" fill="${c.body}" ${s}/><circle cx="29" cy="27" r="5" fill="${c.belly}"/>
      <circle cx="71" cy="27" r="9.5" fill="${c.body}" ${s}/><circle cx="71" cy="27" r="5" fill="${c.belly}"/>`;
    case 'fox': return `<path d="M25 38 L27 9 L47 27 Z" fill="${c.body}" ${s}/><path d="M27 18 L27.5 9 L35 16 Z" fill="#5a3d36"/><path d="M31 31 L31 19 L40 26 Z" fill="#fff6ec"/>
      <path d="M75 38 L73 9 L53 27 Z" fill="${c.body}" ${s}/><path d="M73 18 L72.5 9 L65 16 Z" fill="#5a3d36"/><path d="M69 31 L69 19 L60 26 Z" fill="#fff6ec"/>`;
    case 'panda': return `<circle cx="29" cy="27" r="9.5" fill="#3b3b4a"/><circle cx="71" cy="27" r="9.5" fill="#3b3b4a"/>`;
  }
  return '';
}

function tail(k, c) {
  const s = `stroke="${c.line}" stroke-width="2.5" stroke-linejoin="round"`;
  switch (k) {
    case 'cat': return `<path d="M68 82 C84 84 92 72 90 60 C89 54 84 52 82 55 C80 58 85 60 85 65 C85 74 78 78 68 76 Z" fill="${c.body}" ${s}/>`;
    case 'bunny': return `<circle cx="71" cy="82" r="6.5" fill="#fff" ${s}/>`;
    case 'bear': return `<circle cx="71" cy="83" r="5" fill="${c.body}" ${s}/>`;
    case 'fox': return `<path d="M66 82 C82 88 97 76 95 58 C94 52 88 52 87 58 C86 68 78 74 66 74 Z" fill="${c.body}" ${s}/><path d="M95 58 C94 52 88 52 87 58 C87 62 89 65 92 65 C94 63 95 61 95 58 Z" fill="#fff6ec"/>`;
    case 'panda': return `<circle cx="71" cy="83" r="4.5" fill="#3b3b4a"/>`;
  }
  return '';
}

function face(k, c) {
  let extra = '';
  let eyes = `<g class="a-eye"><ellipse cx="40" cy="46" rx="4.6" ry="5.6" fill="#3a2742"/><circle cx="38.4" cy="43.8" r="1.7" fill="#fff"/></g>
    <g class="a-eye"><ellipse cx="60" cy="46" rx="4.6" ry="5.6" fill="#3a2742"/><circle cx="58.4" cy="43.8" r="1.7" fill="#fff"/></g>`;
  if (k === 'bear') extra = `<ellipse cx="50" cy="56" rx="11" ry="8" fill="${c.belly}"/>`;
  if (k === 'fox') extra = `<path d="M26 50 C34 50 44 54 50 62 C56 54 66 50 74 50 C72 62 62 69 50 69 C38 69 28 62 26 50 Z" fill="#fff6ec"/>`;
  if (k === 'cat') extra = `<path d="M45 26 q1.5 4 0 7 M50 25 v8 M55 26 q-1.5 4 0 7" stroke="${'#f4ab84'}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
  if (k === 'panda') {
    extra = `<ellipse cx="39" cy="47" rx="7.5" ry="9.5" transform="rotate(25 39 47)" fill="#3b3b4a"/><ellipse cx="61" cy="47" rx="7.5" ry="9.5" transform="rotate(-25 61 47)" fill="#3b3b4a"/>`;
    eyes = `<g class="a-eye"><circle cx="40" cy="46" r="3.6" fill="#fff"/><circle cx="40.4" cy="46.4" r="2.2" fill="#222"/></g>
      <g class="a-eye"><circle cx="60" cy="46" r="3.6" fill="#fff"/><circle cx="59.6" cy="46.4" r="2.2" fill="#222"/></g>`;
  }
  return `${extra}${eyes}
    <ellipse cx="31" cy="56" rx="5" ry="3" fill="#ff9fb6" opacity=".65"/><ellipse cx="69" cy="56" rx="5" ry="3" fill="#ff9fb6" opacity=".65"/>
    <path d="M47 53 Q50 51 53 53 Q51.5 56 50 56 Q48.5 56 47 53 Z" fill="${c.nose}"/>
    <path d="M44.5 58 Q47.5 61.5 50 58.2 Q52.5 61.5 55.5 58" stroke="#6b3a4a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
}

export function animalSVG(kind, cls = '') {
  const k = P[kind] ? kind : 'cat';
  const c = P[k];
  const s = `stroke="${c.line}" stroke-width="2.5"`;
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <ellipse cx="50" cy="96" rx="24" ry="3.5" fill="rgba(90,40,90,.15)"/>
    ${tail(k, c)}
    <g class="leg1"><ellipse cx="40" cy="89" rx="8.5" ry="6" fill="${c.leg}" ${s}/></g>
    <g class="leg2"><ellipse cx="60" cy="89" rx="8.5" ry="6" fill="${c.leg}" ${s}/></g>
    <ellipse cx="50" cy="74" rx="21" ry="17" fill="${c.body}" ${s}/>
    <ellipse cx="50" cy="78" rx="12" ry="10" fill="${c.belly}"/>
    ${ears(k, c)}
    <ellipse cx="50" cy="46" rx="27" ry="24" fill="${c.body}" ${s}/>
    <g class="a-face">${face(k, c)}</g>
  </svg>`;
}
