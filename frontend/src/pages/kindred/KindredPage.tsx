import { useEffect } from "react";
import { BookOpen, CalendarHeart, FileText, GitBranch, Image, Users } from "lucide-react";
import { useAuthStore } from "../../stores/auth";
import { useKindredStore, type KindredTab } from "../../stores/kindred";
import { PeopleTab } from "./tabs/PeopleTab";
import { MediaTab } from "./tabs/MediaTab";

const TABS: { key: KindredTab; label: string; icon: typeof Users }[] = [
  { key: "people", label: "People", icon: Users },
  { key: "media", label: "Media", icon: Image },
  { key: "stories", label: "Stories", icon: BookOpen },
  { key: "events", label: "Events", icon: CalendarHeart },
  { key: "tree", label: "Tree", icon: GitBranch },
  { key: "sources", label: "Sources", icon: FileText },
];

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-[color:var(--color-muted)]">
      <p className="text-lg font-medium">{label}</p>
      <p className="mt-1 text-sm">Coming soon</p>
    </div>
  );
}

export function KindredPage() {
  const householdId = useAuthStore((state) => state.user?.household_id);
  const activeTab = useKindredStore((state) => state.activeTab);
  const setActiveTab = useKindredStore((state) => state.setActiveTab);
  const fetchMembers = useKindredStore((state) => state.fetchMembers);
  const fetchRelationships = useKindredStore((state) => state.fetchRelationships);
  const fetchAlbums = useKindredStore((state) => state.fetchAlbums);
  const fetchMedia = useKindredStore((state) => state.fetchMedia);

  useEffect(() => {
    if (householdId) {
      void fetchMembers(householdId);
      void fetchRelationships(householdId);
      void fetchAlbums(householdId);
      void fetchMedia(householdId);
    }
  }, [householdId, fetchMembers, fetchRelationships, fetchAlbums, fetchMedia]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Kindred Canvas</h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Preserve your family heritage — people, photos, stories, and more.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-[color:var(--color-ink)] text-white"
                  : "border border-[color:var(--color-border)] bg-white text-[color:var(--color-ink)] hover:bg-[color:var(--color-accent-soft)]"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {activeTab === "people" && <PeopleTab />}
      {activeTab === "media" && <MediaTab />}
      {activeTab === "stories" && <ComingSoon label="Stories" />}
      {activeTab === "events" && <ComingSoon label="Events" />}
      {activeTab === "tree" && <ComingSoon label="Family Tree" />}
      {activeTab === "sources" && <ComingSoon label="Sources" />}
    </div>
  );
}
