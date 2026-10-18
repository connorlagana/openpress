export default function SiteNotFound() {
  return (
    <div className="fs-container" style={{ textAlign: "center", padding: "4rem 0" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>Page not found</h1>
      <p style={{ color: "var(--fs-muted, #666)" }}>The page you&rsquo;re looking for doesn&rsquo;t exist or isn&rsquo;t published.</p>
      <p>
        <a href="/">Go to the homepage</a>
      </p>
    </div>
  );
}
