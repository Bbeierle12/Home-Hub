import { useRef, useState } from "react";
import { FolderPlus, Image, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useAuthStore } from "../../../stores/auth";
import { useKindredStore } from "../../../stores/kindred";
import type { AiTagSuggestion, FamilyMedia } from "../../../types/api";

export function MediaTab() {
  const householdId = useAuthStore((state) => state.user?.household_id);
  const albums = useKindredStore((state) => state.albums);
  const media = useKindredStore((state) => state.media);
  const members = useKindredStore((state) => state.members);
  const isLoading = useKindredStore((state) => state.isLoadingMedia);
  const createAlbum = useKindredStore((state) => state.createAlbum);
  const deleteAlbum = useKindredStore((state) => state.deleteAlbum);
  const uploadMedia = useKindredStore((state) => state.uploadMedia);
  const updateMedia = useKindredStore((state) => state.updateMedia);
  const deleteMedia = useKindredStore((state) => state.deleteMedia);
  const requestAiTags = useKindredStore((state) => state.requestAiTags);

  const [filterAlbum, setFilterAlbum] = useState<string>("all");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadAlbum, setUploadAlbum] = useState("");
  const [expandedMedia, setExpandedMedia] = useState<string | null>(null);
  const [aiTags, setAiTags] = useState<AiTagSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredMedia =
    filterAlbum === "all"
      ? media
      : filterAlbum === "unassigned"
        ? media.filter((m) => !m.album_id)
        : media.filter((m) => m.album_id === filterAlbum);

  const handleCreateAlbum = async () => {
    if (!householdId || !newAlbumName.trim()) return;
    await createAlbum(householdId, newAlbumName.trim());
    setNewAlbumName("");
  };

  const handleUpload = async (file: File) => {
    if (!householdId) return;
    setUploading(true);
    try {
      await uploadMedia(
        householdId,
        file,
        uploadCaption || undefined,
        uploadAlbum || undefined,
      );
      setUploadCaption("");
    } finally {
      setUploading(false);
    }
  };

  const handleSuggestTags = async (item: FamilyMedia) => {
    if (!householdId) return;
    setAiLoading(true);
    setAiTags(null);
    try {
      const tags = await requestAiTags(householdId, item.id);
      setAiTags(tags);
    } finally {
      setAiLoading(false);
    }
  };

  const albumName = (id: string | null) =>
    albums.find((a) => a.id === id)?.name ?? "No album";

  const isImage = (contentType: string) => contentType.startsWith("image/");

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Left sidebar: Albums + Upload */}
      <div className="space-y-6">
        {/* Upload */}
        <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
          <div className="flex items-center gap-2">
            <Upload className="size-5 text-[color:var(--color-accent)]" />
            <h2 className="text-lg font-bold">Upload</h2>
          </div>
          <div className="mt-4 space-y-3">
            <input
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              placeholder="Caption (optional)"
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
            />
            <select
              value={uploadAlbum}
              onChange={(e) => setUploadAlbum(e.target.value)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none"
            >
              <option value="">No album</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleUpload(file);
                  e.target.value = "";
                }
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              <Plus className="size-4" />
              {uploading ? "Uploading…" : "Choose file"}
            </button>
          </div>
        </section>

        {/* Albums */}
        <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
          <div className="flex items-center gap-2">
            <FolderPlus className="size-5 text-[color:var(--color-accent)]" />
            <h2 className="text-lg font-bold">Albums</h2>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
              placeholder="New album"
              className="flex-1 rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
              onKeyDown={(e) => e.key === "Enter" && void handleCreateAlbum()}
            />
            <button
              type="button"
              onClick={() => void handleCreateAlbum()}
              className="rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 text-white"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <div className="mt-3 space-y-1">
            <button
              type="button"
              onClick={() => setFilterAlbum("all")}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                filterAlbum === "all" ? "bg-[color:var(--color-accent-soft)] font-medium" : "hover:bg-white/70"
              }`}
            >
              All media ({media.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterAlbum("unassigned")}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                filterAlbum === "unassigned" ? "bg-[color:var(--color-accent-soft)] font-medium" : "hover:bg-white/70"
              }`}
            >
              Unassigned ({media.filter((m) => !m.album_id).length})
            </button>
            {albums.map((a) => (
              <div key={a.id} className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setFilterAlbum(a.id)}
                  className={`flex-1 rounded-xl px-3 py-2 text-left text-sm ${
                    filterAlbum === a.id ? "bg-[color:var(--color-accent-soft)] font-medium" : "hover:bg-white/70"
                  }`}
                >
                  {a.name} ({media.filter((m) => m.album_id === a.id).length})
                </button>
                <button
                  type="button"
                  onClick={() => householdId && void deleteAlbum(householdId, a.id)}
                  className="px-1 text-[color:var(--color-muted)] hover:text-red-600"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right: Media grid */}
      <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
        <div className="flex items-center gap-2">
          <Image className="size-5 text-[color:var(--color-accent)]" />
          <h2 className="text-lg font-bold">
            Media{" "}
            <span className="text-sm font-normal text-[color:var(--color-muted)]">
              ({filteredMedia.length})
            </span>
          </h2>
        </div>

        {isLoading ? (
          <p className="mt-8 text-center text-sm text-[color:var(--color-muted)]">Loading…</p>
        ) : filteredMedia.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-2 text-[color:var(--color-muted)]">
            <Image className="size-10 opacity-40" />
            <p className="text-sm">No media yet</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredMedia.map((item) => {
              const isExpanded = expandedMedia === item.id;

              return (
                <div key={item.id} className="group relative">
                  <button
                    type="button"
                    className="w-full"
                    onClick={() => {
                      setExpandedMedia(isExpanded ? null : item.id);
                      setAiTags(null);
                    }}
                  >
                    {isImage(item.content_type) ? (
                      <img
                        src={`/uploads/${item.file_name}`}
                        alt={item.caption ?? "Media"}
                        className="aspect-square w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-gray-100">
                        <span className="text-xs text-gray-500">Video</span>
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => householdId && void deleteMedia(householdId, item.id)}
                    className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block"
                  >
                    <X className="size-3" />
                  </button>
                  {item.caption && (
                    <p className="mt-1 truncate text-xs text-[color:var(--color-muted)]">
                      {item.caption}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Expanded media detail */}
        {expandedMedia && (() => {
          const item = media.find((m) => m.id === expandedMedia);
          if (!item) return null;

          const peopleTags: string[] = item.ai_people_tags ? JSON.parse(item.ai_people_tags) : [];
          const placeTags: string[] = item.ai_place_tags ? JSON.parse(item.ai_place_tags) : [];
          const eventTags: string[] = item.ai_event_tags ? JSON.parse(item.ai_event_tags) : [];

          return (
            <div className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-white p-5">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{item.caption || "Untitled"}</h3>
                <button
                  type="button"
                  onClick={() => setExpandedMedia(null)}
                  className="text-[color:var(--color-muted)]"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-2 space-y-1 text-xs text-[color:var(--color-muted)]">
                <p>Album: {albumName(item.album_id)}</p>
                {item.location && <p>Location: {item.location}</p>}
                {item.taken_at && (
                  <p>Taken: {new Date(item.taken_at).toLocaleDateString()}</p>
                )}
                <p>Type: {item.content_type}</p>
                <p>Uploaded: {new Date(item.created_at).toLocaleDateString()}</p>
              </div>

              {/* AI tag suggestions */}
              <div className="mt-4">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void handleSuggestTags(item)}
                  className="flex items-center gap-1.5 rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--color-accent-soft)] disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" />
                  {aiLoading ? "Analyzing…" : "Suggest Tags with AI"}
                </button>

                {aiTags && (
                  <div className="mt-3 space-y-2">
                    {aiTags.status === "stub" && (
                      <p className="text-xs text-amber-600">
                        AI tagging is a stub — connect an AI provider for real suggestions.
                      </p>
                    )}
                    {aiTags.people.length > 0 && (
                      <div>
                        <p className="text-xs font-medium">People</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {aiTags.people.map((tag) => (
                            <span key={tag} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiTags.places.length > 0 && (
                      <div>
                        <p className="text-xs font-medium">Places</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {aiTags.places.map((tag) => (
                            <span key={tag} className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiTags.events.length > 0 && (
                      <div>
                        <p className="text-xs font-medium">Events</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {aiTags.events.map((tag) => (
                            <span key={tag} className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] text-purple-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Existing AI tags on item */}
              {(peopleTags.length > 0 || placeTags.length > 0 || eventTags.length > 0) && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium">Saved Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {peopleTags.map((t) => (
                      <span key={t} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">{t}</span>
                    ))}
                    {placeTags.map((t) => (
                      <span key={t} className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] text-green-600">{t}</span>
                    ))}
                    {eventTags.map((t) => (
                      <span key={t} className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] text-purple-600">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tag family members */}
              {members.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium">Tag Family Members</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="rounded-full border border-[color:var(--color-border)] px-2 py-0.5 text-[10px] hover:bg-[color:var(--color-accent-soft)]"
                      >
                        {m.first_name}{m.last_name ? ` ${m.last_name}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </section>
    </div>
  );
}
