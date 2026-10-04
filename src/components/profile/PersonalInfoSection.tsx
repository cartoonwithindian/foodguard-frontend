"use client";

import { useState, useEffect } from "react";
import { User, Check } from "lucide-react";
import type { UserProfile } from "@/data/profile-data";
import type { ProfileLabels } from "@/data/profile-labels";

type PersonalInfoSectionProps = {
  profile: UserProfile;
  labels: ProfileLabels["personalInfo"];
  onSave: (updated: UserProfile) => void;
};

export function PersonalInfoSection({ profile, labels, onSave }: PersonalInfoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email,
    age: profile.age?.toString() ?? "",
    height: profile.height?.toString() ?? "",
    weight: profile.weight?.toString() ?? "",
  });

  useEffect(() => {
    setForm({
      name: profile.name,
      email: profile.email,
      age: profile.age?.toString() ?? "",
      height: profile.height?.toString() ?? "",
      weight: profile.weight?.toString() ?? "",
    });
  }, [profile.age, profile.email, profile.height, profile.name, profile.weight]);

  const handleSave = () => {
    onSave({
      ...profile,
      name: form.name,
      email: form.email,
      age: form.age ? Number(form.age) : null,
      height: form.height ? Number(form.height) : null,
      weight: form.weight ? Number(form.weight) : null,
    });
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="foodguard-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <User className="size-5 text-primary" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-foreground">{labels.title}</h2>
      </div>

      <div className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {labels.fullName}
          </label>
          {isEditing ? (
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{profile.name || "Not provided"}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {labels.email}
          </label>
          {isEditing ? (
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{profile.email || "Not provided"}</p>
          )}
        </div>

        {/* Age / Height / Weight */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {labels.age}
            </label>
            {isEditing ? (
              <input
                type="number"
                value={form.age}
                onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {profile.age ? `${profile.age} years` : "-"}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {labels.height} ({labels.heightUnit})
            </label>
            {isEditing ? (
              <input
                type="number"
                value={form.height}
                onChange={(e) => setForm((p) => ({ ...p, height: e.target.value }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {profile.height ? `${profile.height} ${labels.heightUnit}` : "-"}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {labels.weight} ({labels.weightUnit})
            </label>
            {isEditing ? (
              <input
                type="number"
                value={form.weight}
                onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {profile.weight ? `${profile.weight} ${labels.weightUnit}` : "-"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center gap-3">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Check className="size-4" aria-hidden="true" />
              {labels.saveButton}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {labels.saveButton}
          </button>
        )}
        {saved && (
          <span className="text-sm font-medium text-green-600">{labels.saved}</span>
        )}
      </div>
    </div>
  );
}
