import { useState } from "react";
import { Heart, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useAuthStore } from "../../../stores/auth";
import { useKindredStore } from "../../../stores/kindred";
import type { FamilyMember } from "../../../types/api";

export function PeopleTab() {
  const householdId = useAuthStore((state) => state.user?.household_id);
  const members = useKindredStore((state) => state.members);
  const relationships = useKindredStore((state) => state.relationships);
  const isLoading = useKindredStore((state) => state.isLoadingMembers);
  const createMember = useKindredStore((state) => state.createMember);
  const updateMember = useKindredStore((state) => state.updateMember);
  const deleteMember = useKindredStore((state) => state.deleteMember);
  const createRelationship = useKindredStore((state) => state.createRelationship);
  const deleteRelationship = useKindredStore((state) => state.deleteRelationship);

  // Add member form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [gender, setGender] = useState("");
  const [bio, setBio] = useState("");
  const [isLiving, setIsLiving] = useState(true);

  // Edit member
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");

  // Relationships
  const [relFrom, setRelFrom] = useState("");
  const [relTo, setRelTo] = useState("");
  const [relType, setRelType] = useState("parent");

  const handleCreate = async () => {
    if (!householdId || !firstName.trim()) return;
    await createMember(householdId, {
      first_name: firstName.trim(),
      last_name: lastName || undefined,
      birth_date: birthDate || undefined,
      birth_place: birthPlace || undefined,
      gender: gender || undefined,
      bio: bio || undefined,
      is_living: isLiving,
    });
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setBirthPlace("");
    setGender("");
    setBio("");
    setIsLiving(true);
  };

  const handleEditSave = async (member: FamilyMember) => {
    if (!householdId) return;
    await updateMember(householdId, member.id, {
      first_name: editFirstName || undefined,
      last_name: editLastName || undefined,
    });
    setEditingId(null);
  };

  const startEdit = (member: FamilyMember) => {
    setEditingId(member.id);
    setEditFirstName(member.first_name);
    setEditLastName(member.last_name ?? "");
  };

  const handleCreateRelationship = async () => {
    if (!householdId || !relFrom || !relTo || relFrom === relTo) return;
    await createRelationship(householdId, {
      from_member_id: relFrom,
      to_member_id: relTo,
      rel_type: relType,
    });
    setRelFrom("");
    setRelTo("");
  };

  const memberName = (id: string) => {
    const m = members.find((m) => m.id === id);
    if (!m) return "Unknown";
    return m.last_name ? `${m.first_name} ${m.last_name}` : m.first_name;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      {/* Left: Add member + Relationships */}
      <div className="space-y-6">
        {/* Add member */}
        <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
          <div className="flex items-center gap-2">
            <UserPlus className="size-5 text-[color:var(--color-accent)]" />
            <h2 className="text-lg font-bold">Add Family Member</h2>
          </div>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name *"
                className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
                onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
                title="Birth date"
              />
              <input
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="Birth place"
                className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
              />
            </div>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
            >
              <option value="">Gender (optional)</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short bio (optional)"
              rows={2}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isLiving}
                onChange={(e) => setIsLiving(e.target.checked)}
                className="size-4 accent-[color:var(--color-accent)]"
              />
              Living
            </label>
            <button
              type="button"
              onClick={() => void handleCreate()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white"
            >
              <Plus className="size-4" />
              Add member
            </button>
          </div>
        </section>

        {/* Relationships */}
        <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
          <div className="flex items-center gap-2">
            <Heart className="size-5 text-[color:var(--color-accent)]" />
            <h2 className="text-lg font-bold">Relationships</h2>
          </div>
          {members.length >= 2 ? (
            <div className="mt-4 space-y-3">
              <select
                value={relFrom}
                onChange={(e) => setRelFrom(e.target.value)}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none"
              >
                <option value="">Select person</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {memberName(m.id)}
                  </option>
                ))}
              </select>
              <select
                value={relType}
                onChange={(e) => setRelType(e.target.value)}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none"
              >
                <option value="parent">is parent of</option>
                <option value="child">is child of</option>
                <option value="spouse">is spouse of</option>
                <option value="sibling">is sibling of</option>
                <option value="partner">is partner of</option>
              </select>
              <select
                value={relTo}
                onChange={(e) => setRelTo(e.target.value)}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none"
              >
                <option value="">Select person</option>
                {members
                  .filter((m) => m.id !== relFrom)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {memberName(m.id)}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => void handleCreateRelationship()}
                disabled={!relFrom || !relTo}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                <Plus className="size-4" />
                Add relationship
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--color-muted)]">
              Add at least 2 members to create relationships.
            </p>
          )}
          {relationships.length > 0 && (
            <ul className="mt-4 space-y-1">
              {relationships.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-white/70"
                >
                  <span>
                    {memberName(r.from_member_id)}{" "}
                    <span className="text-[color:var(--color-muted)]">is {r.rel_type} of</span>{" "}
                    {memberName(r.to_member_id)}
                  </span>
                  <button
                    type="button"
                    onClick={() => householdId && void deleteRelationship(householdId, r.id)}
                    className="text-[color:var(--color-muted)] hover:text-red-600"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Right: Members list */}
      <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-[color:var(--color-accent)]" />
          <h2 className="text-lg font-bold">
            Family Members{" "}
            <span className="text-sm font-normal text-[color:var(--color-muted)]">
              ({members.length})
            </span>
          </h2>
        </div>

        {isLoading ? (
          <p className="mt-8 text-center text-sm text-[color:var(--color-muted)]">Loading…</p>
        ) : members.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-2 text-[color:var(--color-muted)]">
            <Users className="size-10 opacity-40" />
            <p className="text-sm">No family members yet</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white p-4"
              >
                {editingId === member.id ? (
                  <div className="space-y-2">
                    <input
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      autoFocus
                    />
                    <input
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder="Last name"
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleEditSave(member)}
                        className="rounded-xl bg-[color:var(--color-accent)] px-3 py-1 text-xs text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-[color:var(--color-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">
                          {member.first_name}
                          {member.last_name ? ` ${member.last_name}` : ""}
                        </p>
                        {member.nickname && (
                          <p className="text-xs text-[color:var(--color-muted)]">
                            &ldquo;{member.nickname}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {member.is_living ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                            Living
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            Deceased
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs text-[color:var(--color-muted)]">
                      {member.birth_date && (
                        <p>Born: {new Date(member.birth_date).toLocaleDateString()}</p>
                      )}
                      {member.birth_place && <p>{member.birth_place}</p>}
                      {member.death_date && (
                        <p>Died: {new Date(member.death_date).toLocaleDateString()}</p>
                      )}
                      {member.gender && (
                        <p className="capitalize">{member.gender}</p>
                      )}
                    </div>
                    {member.bio && (
                      <p className="mt-2 text-xs text-[color:var(--color-muted)] line-clamp-2">
                        {member.bio}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(member)}
                        className="rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-xs hover:bg-white/70"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          householdId && void deleteMember(householdId, member.id)
                        }
                        className="text-[color:var(--color-muted)] hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
