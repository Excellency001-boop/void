const INDIGO = "#6c63ff";
const GREEN = "#34d399";
const RED = "#f0475c";
const DIM = "#6b6b76";
const LINE = "#34343d";

const GATE_X = [150, 176, 202, 228, 254];

/// The whole product in one picture: an agent sends two actions at a vault. One clears all five
/// gates and lands. The other reaches the policy perimeter and stops, with the contract's own error
/// as the reason. Pure SVG + SMIL so it costs nothing to load; the moving parts sit under
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
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      <g fill="none" stroke={LINE} strokeWidth="1">
        <path d="M14 34V14h20M486 14h20v20M506 346v20h-20M34 366H14v-20" />
      </g>

      <g fill="none" stroke={INDIGO} strokeOpacity="0.09">
        <circle cx="380" cy="190" r="165" />
        <circle cx="380" cy="190" r="205" />
      </g>

      <circle cx="380" cy="190" r="120" fill="none" stroke={INDIGO} strokeOpacity="0.35" strokeDasharray="2 7" />
      <path
        d="M262.6 165.1A120 120 0 1 1 262.6 214.9"
        fill="none"
        stroke={INDIGO}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <text x="380" y="52" textAnchor="middle" fontSize="11.5" letterSpacing="2.4" fill={INDIGO} fontFamily="var(--font-mono), monospace">
        POLICY PERIMETER
      </text>

      <path d="M76 190H350" fill="none" stroke={GREEN} strokeOpacity="0.45" strokeWidth="1.5" />
      {GATE_X.map((x, i) => (
        <g key={x}>
          <line x1={x} y1="178" x2={x} y2="202" stroke={GREEN} strokeWidth="1.5" strokeOpacity="0.9" />
          <text x={x} y="224" textAnchor="middle" fontSize="10.5" fill={DIM} fontFamily="var(--font-mono), monospace">
            {i + 1}
          </text>
        </g>
      ))}

      <g className="hero-motion">
        {GATE_X.map((x) => {
          const t = ((x - 76) / 274) * 0.55;
          const kt = `0;${(t - 0.01).toFixed(3)};${t.toFixed(3)};${(t + 0.07).toFixed(3)};1`;
          return (
            <line key={x} x1={x} y1="174" x2={x} y2="206" stroke="#c9ffe9" strokeWidth="2.5" strokeLinecap="round" opacity="0">
              <animate attributeName="opacity" values="0;0;1;0;0" keyTimes={kt} dur="4.5s" repeatCount="indefinite" />
            </line>
          );
        })}
        <circle cx="311" cy="91" r="9" fill="none" stroke={RED} strokeWidth="1.5" opacity="0">
          <animate attributeName="r" values="9;9;9;26;26" keyTimes="0;0.55;0.58;0.8;1" dur="4.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0;0.9;0;0" keyTimes="0;0.55;0.58;0.8;1" dur="4.5s" repeatCount="indefinite" />
        </circle>
      </g>

      <path
        d="M78 184C120 120 200 84 303 90"
        fill="none"
        stroke={RED}
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeDasharray="5 5"
      />

      <g>
        <circle cx="60" cy="190" r="15" fill="#131318" stroke={INDIGO} strokeWidth="1.5" />
        <circle cx="60" cy="190" r="4.5" fill={INDIGO} />
        <text x="60" y="226" textAnchor="middle" fontSize="11.5" letterSpacing="2" fill="#a8a8b3" fontFamily="var(--font-mono), monospace">
          AGENT
        </text>
        <text x="60" y="241" textAnchor="middle" fontSize="10.5" fill={DIM} fontFamily="var(--font-mono), monospace">
          session key
        </text>
      </g>

      <g>
        <rect x="350" y="158" width="60" height="64" rx="10" fill="#131318" stroke={GREEN} strokeWidth="1.5" />
        <rect className="hero-motion" x="350" y="158" width="60" height="64" rx="10" fill={GREEN} opacity="0" filter="url(#hd-glow)">
          <animate attributeName="opacity" values="0;0;0.55;0.55;0" keyTimes="0;0.52;0.58;0.9;1" dur="4.5s" repeatCount="indefinite" />
        </rect>
        <path d="M388 190v-6a8 8 0 0 0-16 0v6" fill="none" stroke={GREEN} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="367" y="190" width="26" height="18" rx="3" fill="none" stroke={GREEN} strokeWidth="1.5" />
        <circle cx="380" cy="199" r="2" fill={GREEN} />
        <text x="380" y="246" textAnchor="middle" fontSize="11.5" letterSpacing="2" fill={GREEN} fontFamily="var(--font-mono), monospace">
          EXECUTED
        </text>
        <text x="380" y="261" textAnchor="middle" fontSize="10.5" fill={DIM} fontFamily="var(--font-mono), monospace">
          on-chain, real tx
        </text>
      </g>

      <g>
        <g fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round">
          <path d="M305 85l12 12M317 85l-12 12" />
        </g>
        <g className="hero-motion" opacity="0">
          <circle cx="311" cy="91" r="11" fill={RED} filter="url(#hd-glow)" />
          <animate attributeName="opacity" values="0;0;0.9;0.9;0" keyTimes="0;0.52;0.58;0.9;1" dur="4.5s" repeatCount="indefinite" />
        </g>
        <text x="311" y="68" textAnchor="middle" fontSize="11.5" letterSpacing="2" fill={RED} fontFamily="var(--font-mono), monospace">
          REVERTED
        </text>
        <text x="132" y="152" fontSize="10.5" fill={RED} fillOpacity="0.9" fontFamily="var(--font-mono), monospace">
          TargetSelectorNotAllowed
        </text>
      </g>

      <g className="hero-motion">
        <circle r="4" fill={GREEN}>
          <animateMotion dur="4.5s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.55;1" calcMode="linear" path="M76 190H350" />
          <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.55;0.6;1" dur="4.5s" repeatCount="indefinite" />
        </circle>
        <circle r="4" fill={RED}>
          <animateMotion dur="4.5s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.55;1" calcMode="linear" path="M78 184C120 120 200 84 303 90" />
          <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.55;0.6;1" dur="4.5s" repeatCount="indefinite" />
        </circle>
      </g>

      <text x="14" y="372" fontSize="10.5" letterSpacing="1.6" fill={DIM} fontFamily="var(--font-mono), monospace" transform="translate(18 -4)">
        validateUserOp · five gates · fixed order
      </text>
    </svg>
  );
}
