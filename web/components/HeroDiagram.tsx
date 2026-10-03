const INDIGO = "#6c63ff";
const GREEN = "#34d399";
const RED = "#f0475c";
const EMBER = "#ff6b2c";
const DIM = "#6b6b76";
const LINE = "#34343d";
const MONO = "var(--font-mono), monospace";

const GATE_X = [150, 176, 202, 228, 254];
const LEGAL = "M76 190H350";
const ILLEGAL = "M78 184C120 120 200 84 303 90";

/// The product in one rim-lit picture. An agent sends two actions at a vault. One clears five gates
/// and lands. The other is stopped at the policy perimeter, where the contract's own error burns
/// like an ember. Pure SVG + SMIL, so it costs nothing to load; every moving part sits under
/// .hero-motion so reduced-motion users get the still diagram.
export function HeroDiagram() {
  return (
    <svg
      viewBox="0 0 520 380"
      className="h-auto w-full"
      role="img"
      aria-label="An agent sends two actions toward a vault. The legal one passes five gates and is executed. The illegal one is stopped at the policy perimeter and reverted."
    >
      <title>Agent, policy perimeter, vault</title>
      <defs>
        <filter id="hd-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="hd-wide" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="11" />
        </filter>
        <radialGradient id="hd-ember">
          <stop offset="0" stopColor={EMBER} stopOpacity="0.55" />
          <stop offset="0.45" stopColor={RED} stopOpacity="0.22" />
          <stop offset="1" stopColor={RED} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hd-vault">
          <stop offset="0" stopColor={GREEN} stopOpacity="0.28" />
          <stop offset="1" stopColor={GREEN} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hd-room">
          <stop offset="0" stopColor={INDIGO} stopOpacity="0.16" />
          <stop offset="1" stopColor={INDIGO} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="380" cy="190" r="190" fill="url(#hd-room)" />
      <circle cx="380" cy="190" r="84" fill="url(#hd-vault)" />
      <circle cx="311" cy="91" r="74" fill="url(#hd-ember)" />

      <path d="M14 34V14h20M486 14h20v20M506 346v20h-20M34 366H14v-20" fill="none" stroke={LINE} strokeWidth="1" />

      <g fill="none" stroke={INDIGO} strokeOpacity="0.1">
        <circle cx="380" cy="190" r="165" />
        <circle cx="380" cy="190" r="205" />
      </g>

      <circle cx="380" cy="190" r="120" fill="none" stroke={INDIGO} strokeOpacity="0.4" strokeDasharray="2 7" />
      <path d="M262.6 165.1A120 120 0 1 1 262.6 214.9" fill="none" stroke={INDIGO} strokeWidth="5" strokeLinecap="round" opacity="0.55" filter="url(#hd-glow)" />
      <path d="M262.6 165.1A120 120 0 1 1 262.6 214.9" fill="none" stroke="#a9a4ff" strokeWidth="1.6" strokeLinecap="round" />
      <text x="380" y="46" textAnchor="middle" fontSize="11.5" letterSpacing="2.8" fill="#a9a4ff" fontFamily={MONO}>
        POLICY PERIMETER
      </text>

      <path d={LEGAL} fill="none" stroke={GREEN} strokeOpacity="0.5" strokeWidth="1.6" />
      {GATE_X.map((x, i) => (
        <g key={x}>
          <line x1={x} y1="178" x2={x} y2="202" stroke={GREEN} strokeWidth="1.6" />
          <text x={x} y="224" textAnchor="middle" fontSize="10.5" fill={DIM} fontFamily={MONO}>
            {i + 1}
          </text>
        </g>
      ))}
      <g className="hero-motion">
        {GATE_X.map((x) => {
          const t = ((x - 76) / 274) * 0.55;
          const kt = `0;${(t - 0.01).toFixed(3)};${t.toFixed(3)};${(t + 0.07).toFixed(3)};1`;
          return (
            <line key={x} x1={x} y1="172" x2={x} y2="208" stroke="#c9ffe9" strokeWidth="3" strokeLinecap="round" opacity="0">
              <animate attributeName="opacity" values="0;0;1;0;0" keyTimes={kt} dur="4.5s" repeatCount="indefinite" />
            </line>
          );
        })}
      </g>

      <path d={ILLEGAL} fill="none" stroke={RED} strokeWidth="6" opacity="0.5" filter="url(#hd-glow)" />
      <path d={ILLEGAL} fill="none" stroke="#ff8a98" strokeWidth="1.8" strokeDasharray="6 5" />

      <g>
        <circle cx="60" cy="190" r="26" fill={INDIGO} opacity="0.18" filter="url(#hd-glow)" />
        <circle cx="60" cy="190" r="15" fill="#131318" stroke={INDIGO} strokeWidth="1.6" />
        <circle cx="60" cy="190" r="4.5" fill="#a9a4ff" />
        <text x="60" y="228" textAnchor="middle" fontSize="11.5" letterSpacing="2" fill="#a8a8b3" fontFamily={MONO}>
          AGENT
        </text>
        <text x="60" y="244" textAnchor="middle" fontSize="10.5" fill={DIM} fontFamily={MONO}>
          session key
        </text>
      </g>

      <g>
        <rect x="350" y="158" width="60" height="64" rx="11" fill={GREEN} opacity="0.2" filter="url(#hd-glow)" />
        <rect x="350" y="158" width="60" height="64" rx="11" fill="#0f1613" stroke={GREEN} strokeWidth="1.7" />
        <rect className="hero-motion" x="350" y="158" width="60" height="64" rx="11" fill={GREEN} opacity="0" filter="url(#hd-wide)">
          <animate attributeName="opacity" values="0;0;0.8;0.8;0" keyTimes="0;0.52;0.58;0.9;1" dur="4.5s" repeatCount="indefinite" />
        </rect>
        <path d="M388 190v-6a8 8 0 0 0-16 0v6" fill="none" stroke={GREEN} strokeWidth="1.7" strokeLinecap="round" />
        <rect x="367" y="190" width="26" height="18" rx="3" fill="none" stroke={GREEN} strokeWidth="1.7" />
        <circle cx="380" cy="199" r="2" fill={GREEN} />
        <rect x="336" y="238" width="88" height="22" rx="11" fill={GREEN} fillOpacity="0.12" stroke={GREEN} strokeOpacity="0.55" />
        <text x="380" y="253" textAnchor="middle" fontSize="11" letterSpacing="2" fill={GREEN} fontFamily={MONO}>
          EXECUTED
        </text>
        <text x="380" y="278" textAnchor="middle" fontSize="10.5" fill={DIM} fontFamily={MONO}>
          on-chain, real tx
        </text>
      </g>

      <g>
        <circle className="hero-motion" cx="311" cy="91" r="16" fill={EMBER} opacity="0.35" filter="url(#hd-glow)">
          <animate attributeName="opacity" values="0.25;0.55;0.25" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <path d="M304 84l14 14M318 84l-14 14" fill="none" stroke="#ff8a98" strokeWidth="2.4" strokeLinecap="round" />
        <g className="hero-motion" opacity="0">
          <circle cx="311" cy="91" r="22" fill={RED} filter="url(#hd-wide)" />
          <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.52;0.58;0.9;1" dur="4.5s" repeatCount="indefinite" />
        </g>
        <g className="hero-motion">
          <circle cx="311" cy="91" r="9" fill="none" stroke={RED} strokeWidth="1.6" opacity="0">
            <animate attributeName="r" values="9;9;9;30;30" keyTimes="0;0.55;0.58;0.82;1" dur="4.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0;0.9;0;0" keyTimes="0;0.55;0.58;0.82;1" dur="4.5s" repeatCount="indefinite" />
          </circle>
        </g>
        <rect x="262" y="52" width="98" height="22" rx="11" fill={RED} fillOpacity="0.16" stroke={RED} strokeOpacity="0.7" />
        <text x="311" y="67" textAnchor="middle" fontSize="11" letterSpacing="2" fill="#ff8a98" fontFamily={MONO}>
          REVERTED
        </text>
        <text x="128" y="154" fontSize="11" fill="#ff8a98" fontFamily={MONO}>
          TargetSelectorNotAllowed
        </text>
      </g>

      <g className="hero-motion">
        <circle r="4.5" fill={GREEN}>
          <animateMotion dur="4.5s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.55;1" calcMode="linear" path={LEGAL} />
          <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.55;0.6;1" dur="4.5s" repeatCount="indefinite" />
        </circle>
        <circle r="4.5" fill="#ff8a98">
          <animateMotion dur="4.5s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.55;1" calcMode="linear" path={ILLEGAL} />
          <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.55;0.6;1" dur="4.5s" repeatCount="indefinite" />
        </circle>
      </g>

      <text x="32" y="366" fontSize="10.5" letterSpacing="1.6" fill={DIM} fontFamily={MONO}>
        validateUserOp · five gates · fixed order
      </text>
    </svg>
  );
}
