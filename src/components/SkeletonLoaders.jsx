// src/components/SkeletonLoaders.jsx

// ─── Pyramid Page Loader ────────────────────────────────────────────────────

const pyramidStyles = `
  .pyramid-loader {
    position: relative;
    width: 300px;
    height: 300px;
    display: block;
    transform-style: preserve-3d;
    transform: rotateX(-20deg);
  }
  .pyramid-loader .wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    animation: pyramid-spin 4s linear infinite;
  }
  @keyframes pyramid-spin {
    100% { transform: rotateY(360deg); }
  }
  .pyramid-loader .wrapper .side {
    width: 70px;
    height: 70px;
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    margin: auto;
    transform-origin: center top;
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  }
  .pyramid-loader .wrapper .side1 {
    transform: rotateZ(-30deg) rotateY(90deg);
    background: linear-gradient(to bottom right, #1afbf0, #da00ff);
  }
  .pyramid-loader .wrapper .side2 {
    transform: rotateZ(30deg) rotateY(90deg);
    background: linear-gradient(to bottom right, #1afbf0, #da00ff);
  }
  .pyramid-loader .wrapper .side3 {
    transform: rotateX(30deg);
    background: linear-gradient(to bottom right, #1afbf0, #da00ff);
  }
  .pyramid-loader .wrapper .side4 {
    transform: rotateX(-30deg);
    background: linear-gradient(to bottom right, #1afbf0, #da00ff);
  }
  .pyramid-loader .wrapper .shadow {
    width: 60px;
    height: 60px;
    background: #8b5ad5;
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    margin: auto;
    transform: rotateX(90deg) translateZ(-40px);
    filter: blur(12px);
  }
`;

export function PyramidLoader({ label = "Loading..." }) {
  return (
    <>
      <style>{pyramidStyles}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#0f0f1a",
          gap: "2rem",
        }}
      >
        <div className="pyramid-loader">
          <div className="wrapper">
            <span className="side side1" />
            <span className="side side2" />
            <span className="side side3" />
            <span className="side side4" />
            <span className="shadow" />
          </div>
        </div>
        {label && (
          <p
            style={{
              color: "#c084fc",
              fontSize: "1rem",
              letterSpacing: "0.1em",
              fontFamily: "sans-serif",
              opacity: 0.8,
            }}
          >
            {label}
          </p>
        )}
      </div>
    </>
  );
}

// ─── Flower / Enhance Prompt Loader ─────────────────────────────────────────

const flowerStyles = `
  .enhance-loader {
    --fill-color: #5c3d99;
    --shine-color: #5c3d9933;
    transform: scale(0.5);
    width: 100px;
    height: auto;
    position: relative;
    filter: drop-shadow(0 0 10px var(--shine-color));
  }
  .enhance-loader #pegtopone {
    position: absolute;
    animation: flowe-one 1s linear infinite;
  }
  .enhance-loader #pegtoptwo {
    position: absolute;
    opacity: 0;
    transform: scale(0) translateY(-200px) translateX(-100px);
    animation: flowe-two 1s linear infinite;
    animation-delay: 0.3s;
  }
  .enhance-loader #pegtopthree {
    position: absolute;
    opacity: 0;
    transform: scale(0) translateY(-200px) translateX(100px);
    animation: flowe-three 1s linear infinite;
    animation-delay: 0.6s;
  }
  .enhance-loader svg g path:first-child {
    fill: var(--fill-color);
  }
  @keyframes flowe-one {
    0%   { transform: scale(0.5) translateY(-200px); opacity: 0; }
    25%  { transform: scale(0.75) translateY(-100px); opacity: 1; }
    50%  { transform: scale(1) translateY(0px); opacity: 1; }
    75%  { transform: scale(0.5) translateY(50px); opacity: 1; }
    100% { transform: scale(0) translateY(100px); opacity: 0; }
  }
  @keyframes flowe-two {
    0%   { transform: scale(0.5) rotateZ(-10deg) translateY(-200px) translateX(-100px); opacity: 0; }
    25%  { transform: scale(1) rotateZ(-5deg) translateY(-100px) translateX(-50px); opacity: 1; }
    50%  { transform: scale(1) rotateZ(0deg) translateY(0px) translateX(-25px); opacity: 1; }
    75%  { transform: scale(0.5) rotateZ(5deg) translateY(50px) translateX(0px); opacity: 1; }
    100% { transform: scale(0) rotateZ(10deg) translateY(100px) translateX(25px); opacity: 0; }
  }
  @keyframes flowe-three {
    0%   { transform: scale(0.5) rotateZ(10deg) translateY(-200px) translateX(100px); opacity: 0; }
    25%  { transform: scale(1) rotateZ(5deg) translateY(-100px) translateX(50px); opacity: 1; }
    50%  { transform: scale(1) rotateZ(0deg) translateY(0px) translateX(25px); opacity: 1; }
    75%  { transform: scale(0.5) rotateZ(-5deg) translateY(50px) translateX(0px); opacity: 1; }
    100% { transform: scale(0) rotateZ(-10deg) translateY(100px) translateX(-25px); opacity: 0; }
  }
`;

// Reusable petal SVG path — matches the original uiverse shape
function PetalSVG() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width="100"
      height="100"
    >
      <g>
        <path d="M50 10 C30 10, 10 30, 10 50 C10 70, 30 90, 50 90 C70 90, 90 70, 90 50 C90 30, 70 10, 50 10Z" />
        <path
          d="M50 25 C40 25, 25 40, 25 50 C25 60, 40 75, 50 75 C60 75, 75 60, 75 50 C75 40, 60 25, 50 25Z"
          fill="rgba(255,255,255,0.15)"
        />
      </g>
    </svg>
  );
}

export function EnhanceLoader({ label = "Enhancing prompt..." }) {
  return (
    <>
      <style>{flowerStyles}</style>
      <div
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <div className="enhance-loader" style={{ position: "relative", width: 100, height: 100 }}>
          <div id="pegtopone"><PetalSVG /></div>
          <div id="pegtoptwo"><PetalSVG /></div>
          <div id="pegtopthree"><PetalSVG /></div>
        </div>
        {label && (
          <span
            style={{
              color: "#5c3d99",
              fontSize: "0.75rem",
              fontFamily: "sans-serif",
              letterSpacing: "0.05em",
            }}
          >
            {label}
          </span>
        )}
      </div>
    </>
  );
}

// ─── Original skeleton utilities (unchanged) ────────────────────────────────

export function Skeleton({
  width,
  height = "1rem",
  className = "",
  variant = "rounded",
}) {
  const variantClasses = {
    rounded: "rounded",
    circle: "rounded-full",
    rectangular: "rounded-none",
  };
  return (
    <div
      className={`bg-gray-200 animate-pulse ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
    />
  );
}

export function PromptCardSkeleton() {
  return (
    <div className="prompt-card p-4 mb-4">
      <div className="flex items-start gap-3">
        <Skeleton variant="circle" width="2rem" height="2rem" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <Skeleton width="60%" height="1.25rem" className="mb-2" />
              <Skeleton width="40%" height="0.75rem" />
            </div>
            <div className="flex gap-2 ml-4">
              <Skeleton width="2rem" height="1.5rem" />
              <Skeleton width="2rem" height="1.5rem" />
              <Skeleton width="2rem" height="1.5rem" />
            </div>
          </div>
          <div className="mb-3 space-y-2">
            <Skeleton width="100%" height="1rem" />
            <Skeleton width="95%" height="1rem" />
            <Skeleton width="85%" height="1rem" />
            <Skeleton width="70%" height="1rem" />
          </div>
          <div className="flex gap-2">
            <Skeleton width="3rem" height="1.5rem" className="rounded-full" />
            <Skeleton width="4rem" height="1.5rem" className="rounded-full" />
            <Skeleton width="3.5rem" height="1.5rem" className="rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeamCardSkeleton() {
  return (
    <div className="team-item p-3 border-2 border-transparent rounded-lg mb-2">
      <div className="flex items-start gap-3">
        <Skeleton variant="circle" width="1.25rem" height="1.25rem" className="mt-1" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton width="60%" height="1rem" />
            <Skeleton width="3rem" height="1.25rem" className="rounded-full" />
          </div>
          <div className="space-y-1">
            <Skeleton width="40%" height="0.75rem" />
            <Skeleton width="35%" height="0.75rem" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchFiltersSkeleton() {
  return (
    <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton width="100%" height="2.5rem" className="flex-1" />
        <Skeleton width="8rem" height="2.5rem" />
        <Skeleton width="5rem" height="2.5rem" />
      </div>
    </div>
  );
}

export function BulkOperationsSkeleton() {
  return (
    <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Skeleton width="6rem" height="1rem" />
          <Skeleton width="4rem" height="0.75rem" />
        </div>
        <Skeleton width="5rem" height="0.75rem" />
      </div>
    </div>
  );
}

export function TeamMembersSkeleton() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width="8rem" height="1.5rem" />
        <Skeleton width="3rem" height="1rem" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Skeleton variant="circle" width="1.5rem" height="1.5rem" />
              <div>
                <Skeleton width="8rem" height="1rem" className="mb-1" />
                <Skeleton width="6rem" height="0.75rem" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton width="4rem" height="1.5rem" className="rounded-full" />
              <Skeleton width="3rem" height="1rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
      <Skeleton width="8rem" height="1.5rem" className="mb-4" />
      <div className="space-y-4">
        <div>
          <Skeleton width="3rem" height="0.875rem" className="mb-1" />
          <Skeleton width="100%" height="2.5rem" />
        </div>
        <div>
          <Skeleton width="5rem" height="0.875rem" className="mb-1" />
          <Skeleton width="100%" height="8rem" />
        </div>
        <div>
          <Skeleton width="2rem" height="0.875rem" className="mb-1" />
          <Skeleton width="100%" height="2.5rem" />
        </div>
        <div className="flex gap-3 pt-2">
          <Skeleton width="6rem" height="2.5rem" />
          <Skeleton width="4rem" height="2.5rem" />
        </div>
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="team-sidebar w-72 p-4 flex flex-col">
      <div className="flex items-center p-3 bg-gray-50 rounded-lg mb-4">
        <Skeleton variant="circle" width="2rem" height="2rem" className="mr-3" />
        <div className="flex-1">
          <Skeleton width="70%" height="0.875rem" className="mb-1" />
          <Skeleton width="40%" height="0.75rem" />
        </div>
      </div>
      <div className="mb-4">
        <Skeleton width="100%" height="4rem" />
      </div>
      <div className="flex items-center justify-between mb-3">
        <Skeleton width="5rem" height="1.25rem" />
        <Skeleton width="1rem" height="0.875rem" />
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {[1, 2, 3].map((i) => (
          <TeamCardSkeleton key={i} />
        ))}
      </div>
      <div className="border-t border-gray-200 pt-4">
        <Skeleton width="100%" height="2.5rem" className="mb-2" />
        <Skeleton width="100%" height="2.5rem" className="mb-4" />
        <Skeleton width="100%" height="2.5rem" />
      </div>
    </div>
  );
}

export function FavoritesListSkeleton() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width="8rem" height="1.5rem" />
        <Skeleton width="3rem" height="0.875rem" />
      </div>
      <Skeleton width="100%" height="2.5rem" className="mb-4" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="prompt-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <Skeleton width="70%" height="1.25rem" className="mb-2" />
                <Skeleton width="50%" height="0.75rem" />
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Skeleton width="2rem" height="1.5rem" />
                <Skeleton width="3rem" height="1.5rem" />
              </div>
            </div>
            <div className="mb-3 space-y-2">
              <Skeleton width="100%" height="0.875rem" />
              <Skeleton width="90%" height="0.875rem" />
              <Skeleton width="75%" height="0.875rem" />
            </div>
            <div className="flex flex-wrap gap-1">
              <Skeleton width="3rem" height="1.25rem" className="rounded-full" />
              <Skeleton width="4rem" height="1.25rem" className="rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="border-b p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} width="8rem" height="1rem" />
          ))}
        </div>
      </div>
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="border-b last:border-b-0 p-4">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton key={colIndex} width="8rem" height="1rem" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="app-container flex">
      <SidebarSkeleton />
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <Skeleton width="12rem" height="2rem" className="mb-2" />
          <Skeleton width="20rem" height="1rem" />
        </div>
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
          <SearchFiltersSkeleton />
          <BulkOperationsSkeleton />
          <FormSkeleton />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <PromptCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function createSkeleton(config) {
  return function CustomSkeleton() {
    return (
      <div className={config.containerClass || ""}>
        {config.elements.map((element, index) => (
          <Skeleton
            key={index}
            width={element.width}
            height={element.height}
            variant={element.variant}
            className={element.className}
          />
        ))}
      </div>
    );
  };
}
