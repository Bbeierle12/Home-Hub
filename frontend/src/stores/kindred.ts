import { create } from "zustand";
import type {
  FamilyMember,
  FamilyRelationship,
  FamilyMediaAlbum,
  FamilyMedia,
  AiTagSuggestion,
} from "../types/api";
import { apiFetch } from "../api/client";
import { useAuthStore } from "./auth";

export type KindredTab = "people" | "media" | "stories" | "events" | "tree" | "sources";

type KindredState = {
  activeTab: KindredTab;
  setActiveTab: (tab: KindredTab) => void;

  // People
  members: FamilyMember[];
  relationships: FamilyRelationship[];
  isLoadingMembers: boolean;
  fetchMembers: (householdId: string) => Promise<void>;
  createMember: (
    householdId: string,
    input: { first_name: string; last_name?: string; birth_date?: string; birth_place?: string; gender?: string; bio?: string; is_living?: boolean },
  ) => Promise<void>;
  updateMember: (
    householdId: string,
    memberId: string,
    input: Partial<Omit<FamilyMember, "id" | "household_id" | "created_by" | "created_at" | "updated_at">>,
  ) => Promise<void>;
  deleteMember: (householdId: string, memberId: string) => Promise<void>;
  fetchRelationships: (householdId: string) => Promise<void>;
  createRelationship: (
    householdId: string,
    input: { from_member_id: string; to_member_id: string; rel_type: string; start_date?: string },
  ) => Promise<void>;
  deleteRelationship: (householdId: string, relId: string) => Promise<void>;

  // Media
  albums: FamilyMediaAlbum[];
  media: FamilyMedia[];
  isLoadingMedia: boolean;
  fetchAlbums: (householdId: string) => Promise<void>;
  createAlbum: (householdId: string, name: string, description?: string) => Promise<void>;
  deleteAlbum: (householdId: string, albumId: string) => Promise<void>;
  fetchMedia: (householdId: string) => Promise<void>;
  uploadMedia: (householdId: string, file: File, caption?: string, albumId?: string) => Promise<void>;
  updateMedia: (
    householdId: string,
    mediaId: string,
    input: { caption?: string; album_id?: string; location?: string },
  ) => Promise<void>;
  deleteMedia: (householdId: string, mediaId: string) => Promise<void>;
  requestAiTags: (householdId: string, mediaId: string) => Promise<AiTagSuggestion>;

  // WS
  ingestKindredEvent: (eventType: string, payload: unknown) => void;
};

export const useKindredStore = create<KindredState>((set) => ({
  activeTab: "people",
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── People ──────────────────────────────────────────────────────────────
  members: [],
  relationships: [],
  isLoadingMembers: false,

  fetchMembers: async (householdId) => {
    set({ isLoadingMembers: true });
    const response = await apiFetch<{ members: FamilyMember[] }>(
      `/households/${householdId}/kindred/members`,
    );
    set({ members: response.members, isLoadingMembers: false });
  },

  createMember: async (householdId, input) => {
    const member = await apiFetch<FamilyMember>(
      `/households/${householdId}/kindred/members`,
      { method: "POST", body: JSON.stringify(input) },
    );
    set((state) => ({ members: [member, ...state.members] }));
  },

  updateMember: async (householdId, memberId, input) => {
    const member = await apiFetch<FamilyMember>(
      `/households/${householdId}/kindred/members/${memberId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
    set((state) => ({
      members: state.members.map((m) => (m.id === member.id ? member : m)),
    }));
  },

  deleteMember: async (householdId, memberId) => {
    await apiFetch(`/households/${householdId}/kindred/members/${memberId}`, {
      method: "DELETE",
    });
    set((state) => ({
      members: state.members.filter((m) => m.id !== memberId),
    }));
  },

  fetchRelationships: async (householdId) => {
    const response = await apiFetch<{ relationships: FamilyRelationship[] }>(
      `/households/${householdId}/kindred/relationships`,
    );
    set({ relationships: response.relationships });
  },

  createRelationship: async (householdId, input) => {
    const rel = await apiFetch<FamilyRelationship>(
      `/households/${householdId}/kindred/relationships`,
      { method: "POST", body: JSON.stringify(input) },
    );
    set((state) => ({ relationships: [...state.relationships, rel] }));
  },

  deleteRelationship: async (householdId, relId) => {
    await apiFetch(`/households/${householdId}/kindred/relationships/${relId}`, {
      method: "DELETE",
    });
    set((state) => ({
      relationships: state.relationships.filter((r) => r.id !== relId),
    }));
  },

  // ── Media ───────────────────────────────────────────────────────────────
  albums: [],
  media: [],
  isLoadingMedia: false,

  fetchAlbums: async (householdId) => {
    const response = await apiFetch<{ albums: FamilyMediaAlbum[] }>(
      `/households/${householdId}/kindred/albums`,
    );
    set({ albums: response.albums });
  },

  createAlbum: async (householdId, name, description) => {
    const album = await apiFetch<FamilyMediaAlbum>(
      `/households/${householdId}/kindred/albums`,
      { method: "POST", body: JSON.stringify({ name, description }) },
    );
    set((state) => ({ albums: [...state.albums, album] }));
  },

  deleteAlbum: async (householdId, albumId) => {
    await apiFetch(`/households/${householdId}/kindred/albums/${albumId}`, {
      method: "DELETE",
    });
    set((state) => ({
      albums: state.albums.filter((a) => a.id !== albumId),
    }));
  },

  fetchMedia: async (householdId) => {
    set({ isLoadingMedia: true });
    const response = await apiFetch<{ media: FamilyMedia[] }>(
      `/households/${householdId}/kindred/media`,
    );
    set({ media: response.media, isLoadingMedia: false });
  },

  uploadMedia: async (householdId, file, caption, albumId) => {
    const token = useAuthStore.getState().accessToken;
    const formData = new FormData();
    formData.append("file", file);
    if (caption) formData.append("caption", caption);
    if (albumId) formData.append("album_id", albumId);

    const response = await fetch(
      `/api/households/${householdId}/kindred/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message ?? "Upload failed");
    }

    const media = (await response.json()) as FamilyMedia;
    set((state) => ({ media: [media, ...state.media] }));
  },

  updateMedia: async (householdId, mediaId, input) => {
    const media = await apiFetch<FamilyMedia>(
      `/households/${householdId}/kindred/media/${mediaId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
    set((state) => ({
      media: state.media.map((m) => (m.id === media.id ? media : m)),
    }));
  },

  deleteMedia: async (householdId, mediaId) => {
    await apiFetch(`/households/${householdId}/kindred/media/${mediaId}`, {
      method: "DELETE",
    });
    set((state) => ({
      media: state.media.filter((m) => m.id !== mediaId),
    }));
  },

  requestAiTags: async (householdId, mediaId) => {
    return apiFetch<AiTagSuggestion>(
      `/households/${householdId}/kindred/media/${mediaId}/ai-tags`,
      { method: "POST" },
    );
  },

  // ── WebSocket ─────────────────────────────────────────────────────────
  ingestKindredEvent: (eventType, payload) => {
    set((state) => {
      // Members
      if (eventType === "kindred_member.deleted") {
        const { id } = payload as { id: string };
        return { members: state.members.filter((m) => m.id !== id) };
      }
      if (eventType.startsWith("kindred_member.")) {
        const member = payload as FamilyMember;
        const existing = state.members.find((m) => m.id === member.id);
        if (!existing) return { members: [member, ...state.members] };
        return { members: state.members.map((m) => (m.id === member.id ? member : m)) };
      }

      // Relationships
      if (eventType === "kindred_relationship.deleted") {
        const { id } = payload as { id: string };
        return { relationships: state.relationships.filter((r) => r.id !== id) };
      }
      if (eventType === "kindred_relationship.created") {
        const rel = payload as FamilyRelationship;
        return { relationships: [...state.relationships, rel] };
      }

      // Albums
      if (eventType === "kindred_album.deleted") {
        const { id } = payload as { id: string };
        return { albums: state.albums.filter((a) => a.id !== id) };
      }
      if (eventType.startsWith("kindred_album.")) {
        const album = payload as FamilyMediaAlbum;
        const existing = state.albums.find((a) => a.id === album.id);
        if (!existing) return { albums: [...state.albums, album] };
        return { albums: state.albums.map((a) => (a.id === album.id ? album : a)) };
      }

      // Media
      if (eventType === "kindred_media.deleted") {
        const { id } = payload as { id: string };
        return { media: state.media.filter((m) => m.id !== id) };
      }
      if (eventType.startsWith("kindred_media.")) {
        const item = payload as FamilyMedia;
        const existing = state.media.find((m) => m.id === item.id);
        if (!existing) return { media: [item, ...state.media] };
        return { media: state.media.map((m) => (m.id === item.id ? item : m)) };
      }

      return {};
    });
  },
}));
