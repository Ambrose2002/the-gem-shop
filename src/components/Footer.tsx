export default function Footer() {
  return (
    <footer className="bg-black w-full mx-auto max-w-6xl px-4 pb-10 text-sm text-gray-500 flex justify-center">
      <div className="mt-6 rounded-2xl border border-gray-200 p-6">
        <p>
          © {new Date().getFullYear()} Your Brand · Timeless Design
        </p>
      </div>
    </footer>
  );
}