"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KidsMode } from "../../components/KidsMode";
import type { Member } from "../../components/FamilyMembersContext";

export default function KidsPage() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/family-members", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setMembers(j.members))
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!members) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(160deg, #FFF8EE 0%, #F8ECD9 100%)",
          display: "grid",
          placeItems: "center",
          color: "#5C4F3F",
          fontWeight: 800
        }}
      >
        Loading…
      </div>
    );
  }

  return <KidsMode initialMembers={members} />;
}
