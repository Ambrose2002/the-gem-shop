export default function Footer() {
  return (
    <footer className="mt-12 mx-auto max-w-6xl px-4 pb-10 text-sm text-gray-500">
      <div className="rounded-2xl border border-gray-200 p-6">
        <p>
          © {new Date().getFullYear()} Your Brand · Handmade in small batches ·
          <a href="#" className="ml-1 underline">Returns &amp; Care</a>
        </p>
      </div>
    </footer>
  );
}