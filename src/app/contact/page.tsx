import Link from "next/link";
export default function ContactPage() {
  return (
    <main className="flex flex-col items-center justify-center px-6 py-16 bg-gray-50 min-h-screen">
      <div className="max-w-2xl w-full bg-white shadow-md rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          Contact Us
        </h1>
        <p className="text-gray-600 mb-8 text-center">
          We’d love to hear from you! Reach out for inquiries, orders, or
          collaborations.
        </p>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Store Vendor</h2>
            <p className="text-gray-600">Flora Kwafo</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Location</h2>
            <p className="text-gray-600">Knust, Kumasi</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Phone</h2>
            <p className="text-gray-600">+233 247 211 471</p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="tel:+2332404431954"
            className="inline-block rounded-lg bg-black px-6 py-3 text-white font-medium hover:bg-gray-800 transition"
          >
            Call Now
          </Link>
        </div>
      </div>
    </main>
  );
}