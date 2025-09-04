import Link from "next/link";

export default function SentPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-white-900">Request sent</h1>
      <p className="mt-2 text-white-800">We’ve emailed your cart to the store owner. They’ll reach out soon.</p>
      <Link href="/" className="mt-6 inline-block rounded-xl border px-4 py-2 text-white-700 hover:bg-gray-100">
        Back to shop
      </Link>
    </main>
  );
}