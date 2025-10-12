// src/components/SkeletonLoaders.jsx

// Base skeleton component
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

// Prompt card skeleton
export function PromptCardSkeleton() {
  return (
    <div className="prompt-card p-4 mb-4">
      <div className="flex items-start gap-3">
        {/* Avatar skeleton */}
        <Skeleton variant="circle" width="2rem" height="2rem" />

        <div className="flex-1">
          {/* Title and metadata */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <Skeleton width="60%" height="1.25rem" className="mb-2" />
              <Skeleton width="40%" height="0.75rem" />
            </div>

            {/* Action buttons skeleton */}
            <div className="flex gap-2 ml-4">
              <Skeleton width="2rem" height="1.5rem" />
              <Skeleton width="2rem" height="1.5rem" />
              <Skeleton width="2rem" height="1.5rem" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="mb-3 space-y-2">
            <Skeleton width="100%" height="1rem" />
            <Skeleton width="95%" height="1rem" />
            <Skeleton width="85%" height="1rem" />
            <Skeleton width="70%" height="1rem" />
          </div>

          {/* Tags skeleton */}
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

// Team card skeleton
export function TeamCardSkeleton() {
  return (
    <div className="team-item p-3 border-2 border-transparent rounded-lg mb-2">
      <div className="flex items-start gap-3">
        <Skeleton
          variant="circle"
          width="1.25rem"
          height="1.25rem"
          className="mt-1"
        />

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

// Search filters skeleton
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

// Bulk operations skeleton
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

// Team members skeleton
export function TeamMembersSkeleton() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width="8rem" height="1.5rem" />
        <Skeleton width="3rem" height="1rem" />
      </div>

      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
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

// Form skeleton
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

// Sidebar skeleton
export function SidebarSkeleton() {
  return (
    <div className="team-sidebar w-72 p-4 flex flex-col">
      {/* User profile skeleton */}
      <div className="flex items-center p-3 bg-gray-50 rounded-lg mb-4">
        <Skeleton
          variant="circle"
          width="2rem"
          height="2rem"
          className="mr-3"
        />
        <div className="flex-1">
          <Skeleton width="70%" height="0.875rem" className="mb-1" />
          <Skeleton width="40%" height="0.75rem" />
        </div>
      </div>

      {/* Favorites button skeleton */}
      <div className="mb-4">
        <Skeleton width="100%" height="4rem" />
      </div>

      {/* Teams header */}
      <div className="flex items-center justify-between mb-3">
        <Skeleton width="5rem" height="1.25rem" />
        <Skeleton width="1rem" height="0.875rem" />
      </div>

      {/* Teams list skeleton */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {[1, 2, 3].map((i) => (
          <TeamCardSkeleton key={i} />
        ))}
      </div>

      {/* Create team form skeleton */}
      <div className="border-t border-gray-200 pt-4">
        <Skeleton width="100%" height="2.5rem" className="mb-2" />
        <Skeleton width="100%" height="2.5rem" className="mb-4" />
        <Skeleton width="100%" height="2.5rem" />
      </div>
    </div>
  );
}

// Favorites list skeleton
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
              <Skeleton
                width="3rem"
                height="1.25rem"
                className="rounded-full"
              />
              <Skeleton
                width="4rem"
                height="1.25rem"
                className="rounded-full"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Table skeleton
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Table header */}
      <div className="border-b p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} width="8rem" height="1rem" />
          ))}
        </div>
      </div>

      {/* Table rows */}
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

// Page skeleton (full page loading)
export function PageSkeleton() {
  return (
    <div className="app-container flex">
      <SidebarSkeleton />

      <div className="flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <Skeleton width="12rem" height="2rem" className="mb-2" />
          <Skeleton width="20rem" height="1rem" />
        </div>

        {/* Content skeleton */}
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

// Utility function to create custom skeletons
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
