import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24
      }}
    >
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Not found</h1>
      <p style={{ margin: 0, color: "var(--ink-3)" }}>That page doesn&apos;t live here.</p>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 12 }}>
        Back home
      </Link>
    </main>
  );
}
