# B138B Compact Features - Usage Examples

Quick reference guide for using the compact features in your application.

## 🚀 Quick Start

### 1. Display Compact Badges on Profile

```tsx
import { CompactBadges } from '@/components/compacts/CompactBadges';

function ClinicianProfile({ clinician }) {
  const compactBadges = [
    {
      type: 'IMLC',
      status: 'ACTIVE',
      stateCount: 25,
      states: ['AL', 'AZ', 'CO', ...],
      homeState: 'CO',
    },
    {
      type: 'PSYPACT',
      status: 'ELIGIBLE',
      stateCount: 32,
      states: ['AL', 'AZ', 'AR', ...],
    },
  ];

  return (
    <div className="profile">
      <h2>{clinician.name}</h2>
      <CompactBadges compacts={compactBadges} size="md" />
    </div>
  );
}
```

### 2. Add Compact Indicator to Job Cards

```tsx
import { JobCardCompacts } from '@/components/jobs/JobCardCompacts';

function JobCard({ job }) {
  return (
    <div className="job-card">
      <h3>{job.title}</h3>
      <p>{job.description}</p>

      <JobCardCompacts
        compactAllowed={job.compactAllowed}
        preferredCompacts={job.imlcEligible ? ['IMLC'] : undefined}
        requiredStates={job.requiredStates}
      />
    </div>
  );
}
```

### 3. Add Compact Filter to Job Listings

```tsx
import { CompactFilter, matchesCompactFilter } from '@/app/org/jobs/filters/CompactFilter';
import { useState } from 'react';

function JobListings({ jobs }) {
  const [filters, setFilters] = useState({
    compactOnly: false,
    specificCompacts: { imlc: false, psypact: false, counseling: false }
  });

  const filteredJobs = jobs.filter(job => matchesCompactFilter(job, filters));

  return (
    <div>
      <div className="filters">
        <CompactFilter
          value={filters}
          onChange={setFilters}
          matchCount={filteredJobs.length}
          totalCount={jobs.length}
        />
      </div>

      <div className="job-list">
        {filteredJobs.map(job => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
```

## 📍 Navigation Links

Add these links to your navigation menu:

```tsx
// Clinician Navigation
<nav>
  <Link href="/dashboard/compacts">My Compacts</Link>
  <Link href="/dashboard/compacts/wizard">Check Eligibility</Link>
</nav>

// Organization Navigation
<nav>
  <Link href="/org/compacts/map">Clinician Map</Link>
</nav>
```

## 🔗 API Integration

### Fetch Clinician Compact Data

```tsx
async function fetchClinicianCompacts(npi: string) {
  const response = await fetch('/api/clinician/compacts');
  if (!response.ok) throw new Error('Failed to fetch compacts');
  return response.json();
}

// Usage
useEffect(() => {
  fetchClinicianCompacts(currentUser.npi)
    .then(data => setCompactData(data))
    .catch(err => console.error(err));
}, [currentUser.npi]);
```

### Fetch Org Compact Map Data

```tsx
async function fetchOrgCompactMap() {
  const response = await fetch('/api/org/compacts/clinicians-by-state');
  if (!response.ok) throw new Error('Failed to fetch map data');
  return response.json();
}
```

## 🎨 Styling Examples

### Custom Badge Colors

```tsx
<CompactBadges
  compacts={compactData}
  className="custom-spacing mt-4"
/>
```

### Compact Filter Inline Mode

```tsx
<CompactFilter
  value={filters}
  onChange={setFilters}
  compact={true}  // Inline mode
/>
```

## 🧩 Component Combinations

### Profile Header with Compacts

```tsx
function ProfileHeader({ clinician }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1>{clinician.name}</h1>
        <p className="text-gray-600">{clinician.specialty}</p>
      </div>
      <CompactBadges compacts={clinician.compacts} size="lg" />
    </div>
  );
}
```

### Job Card with Full Context

```tsx
function DetailedJobCard({ job }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{job.title}</CardTitle>
          <JobCardCompacts
            compactAllowed={job.compactAllowed}
            preferredCompacts={['IMLC', 'PSYPACT']}
          />
        </div>
      </CardHeader>
      <CardContent>
        <p>{job.description}</p>
        <div className="mt-4">
          <Badge variant="outline">{job.specialty}</Badge>
          <Badge variant="outline">{job.location}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Search Results with Compact Filter

```tsx
function SearchResults() {
  const [compactFilter, setCompactFilter] = useState({
    compactOnly: false,
    specificCompacts: { imlc: false, psypact: false, counseling: false }
  });

  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');

  const filteredJobs = jobs
    .filter(job => matchesCompactFilter(job, compactFilter))
    .filter(job => specialtyFilter === 'all' || job.specialty === specialtyFilter)
    .filter(job => !locationFilter || job.location.includes(locationFilter));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <div className="space-y-4">
          <CompactFilter value={compactFilter} onChange={setCompactFilter} />
          <SpecialtyFilter value={specialtyFilter} onChange={setSpecialtyFilter} />
          <LocationFilter value={locationFilter} onChange={setLocationFilter} />
        </div>
      </div>
      <div className="lg:col-span-3">
        <div className="space-y-4">
          {filteredJobs.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

## 🔧 Utility Functions

### Check if Job Accepts Compacts

```tsx
import { isCompactJob, getJobCompacts } from '@/components/jobs/JobCardCompacts';

// Check if job accepts any compact
if (isCompactJob(job)) {
  console.log('This job accepts compact clinicians');
}

// Get specific compact types
const compacts = getJobCompacts(job);
console.log('Accepted compacts:', compacts); // ['IMLC', 'PSYPACT']
```

### Get Filter Summary

```tsx
import { getCompactFilterSummary } from '@/app/org/jobs/filters/CompactFilter';

const summary = getCompactFilterSummary(filters);
console.log(summary); // "IMLC & PSYPACT jobs"
```

### Convert API Data to Badge Format

```tsx
import { createCompactBadges } from '@/components/compacts/CompactBadges';

const apiData = await fetchClinicianCompacts(npi);
const badges = createCompactBadges(apiData.compacts);

<CompactBadges compacts={badges} />
```

## 🎯 Common Use Cases

### 1. Clinician Dashboard Widget

```tsx
function DashboardCompactWidget() {
  const { data, loading } = useCompactData();

  if (loading) return <Skeleton className="h-32" />;

  const activeCompacts = data.compacts.filter(c => c.status === 'ACTIVE');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Compacts</CardTitle>
      </CardHeader>
      <CardContent>
        {activeCompacts.length > 0 ? (
          <>
            <CompactBadges compacts={activeCompacts} />
            <Link href="/dashboard/compacts" className="mt-4 text-sm text-blue-600">
              Manage compacts →
            </Link>
          </>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-2">
              No active compact memberships
            </p>
            <Link href="/dashboard/compacts/wizard">
              <Button size="sm">Check Eligibility</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 2. Job Application Flow

```tsx
function JobApplicationButton({ job, clinician }) {
  const hasCompact = clinician.compacts.some(c => c.status === 'ACTIVE');
  const jobRequiresCompact = isCompactJob(job);

  const canApply = !jobRequiresCompact || (jobRequiresCompact && hasCompact);

  return (
    <div>
      <Button disabled={!canApply}>
        Apply Now
      </Button>

      {!canApply && (
        <p className="text-sm text-yellow-600 mt-2">
          This job prefers compact-eligible clinicians.
          <Link href="/dashboard/compacts/wizard" className="underline ml-1">
            Check your eligibility
          </Link>
        </p>
      )}
    </div>
  );
}
```

### 3. Org Analytics Dashboard

```tsx
function OrgCompactAnalytics() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Compact Members" value={156} />
        <StatCard label="IMLC Members" value={89} />
        <StatCard label="PSYPACT Members" value={67} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geographic Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/org/compacts/map">
            <Button variant="outline">View Interactive Map →</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
```

## 📱 Responsive Layouts

### Mobile-First Badge Display

```tsx
<div className="flex flex-col sm:flex-row sm:items-center gap-2">
  <h2 className="text-xl font-bold">{clinician.name}</h2>
  <CompactBadges
    compacts={clinician.compacts}
    size="sm"
    className="sm:ml-auto"
  />
</div>
```

### Responsive Filter Sidebar

```tsx
function ResponsiveFilters() {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <>
      {/* Mobile: Toggle Button */}
      <Button
        className="lg:hidden"
        onClick={() => setShowFilters(!showFilters)}
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
      </Button>

      {/* Desktop: Always Visible */}
      <aside className={cn(
        "lg:block",
        showFilters ? "block" : "hidden"
      )}>
        <CompactFilter value={filters} onChange={setFilters} />
      </aside>
    </>
  );
}
```

## 🔍 Search and Discovery

### Compact-Based Search

```tsx
function CompactSearch() {
  const [selectedCompact, setSelectedCompact] = useState<CompactType | null>(null);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Badge
          onClick={() => setSelectedCompact('IMLC')}
          className={cn(
            'cursor-pointer',
            selectedCompact === 'IMLC' && 'ring-2 ring-blue-500'
          )}
        >
          IMLC Clinicians
        </Badge>
        <Badge
          onClick={() => setSelectedCompact('PSYPACT')}
          className={cn(
            'cursor-pointer',
            selectedCompact === 'PSYPACT' && 'ring-2 ring-purple-500'
          )}
        >
          PSYPACT Clinicians
        </Badge>
      </div>

      <ClinicianList
        filter={c => c.compacts.some(comp =>
          comp.type === selectedCompact && comp.status === 'ACTIVE'
        )}
      />
    </div>
  );
}
```

## ⚡ Performance Tips

1. **Lazy Load Map Component**

```tsx
const CompactMap = dynamic(() => import('@/app/org/compacts/map/page'), {
  loading: () => <Skeleton className="h-[600px]" />,
  ssr: false, // D3 requires client-side rendering
});
```

2. **Memoize Filter Logic**

```tsx
const filteredJobs = useMemo(
  () => jobs.filter(job => matchesCompactFilter(job, filters)),
  [jobs, filters]
);
```

3. **Virtual Scrolling for Large Lists**

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

// Use for 100+ items
const virtualizer = useVirtualizer({
  count: filteredJobs.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120,
});
```

## 📊 Data Structures

### Job with Compact Data

```typescript
interface Job {
  id: string;
  title: string;
  description: string;
  specialty: string;
  location: { city: string; state: string };
  requiredStates: string[];

  // Compact fields
  compactAllowed: boolean;
  imlcEligible?: boolean;
  psypactEligible?: boolean;
  counselingCompactEligible?: boolean;

  // Other fields...
}
```

### Clinician with Compact Data

```typescript
interface Clinician {
  npi: string;
  name: string;
  specialty: string;

  compacts: Array<{
    type: 'IMLC' | 'PSYPACT' | 'COUNSELING';
    status: 'ACTIVE' | 'ELIGIBLE' | 'PENDING' | 'NOT_ELIGIBLE';
    eligibleStates: string[];
    homeState?: string;
    dateEnrolled?: string;
    expirationDate?: string;
  }>;

  allLicensedStates: string[];
}
```

---

**Need more examples?** Check the implementation files for detailed inline documentation and additional patterns.

