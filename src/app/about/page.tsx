import Image from "next/image";

export default function AboutPage() {
  return (
    <main className="flex flex-col items-center justify-center px-6 py-16 bg-gray-50 min-h-screen">
      <div className="max-w-3xl w-full bg-white shadow-md rounded-lg p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/brand/logo.png"
            alt="The Gem Shop Logo"
            width={100}
            height={100}
            className="rounded-full"
          />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          About The Gem Shop
        </h1>

        <p className="text-gray-700 leading-relaxed mb-4">
          At <span className="font-semibold">The Gem Shop</span>, we believe
          jewelry is more than just an accessory—it’s a story, a memory, and a
          reflection of personal style. Each piece is thoughtfully designed and
          crafted with care, blending timeless elegance with everyday wearability.
        </p>
        <p className="text-gray-700 leading-relaxed mb-4">
          Founded by <span className="font-semibold">Flora Kwafo</span> in the
          heart of Bantama, Kumasi, The Gem Shop brings together a passion for
          craftsmanship and a love of beautiful things. What began as a local
          passion project has grown into a brand that serves customers with
          unique, handmade jewelry pieces.
        </p>
        <p className="text-gray-700 leading-relaxed">
          Our mission is simple: to make every customer feel special. Whether
          you’re shopping for yourself or a loved one, The Gem Shop offers
          pieces that can be treasured for years to come.
        </p>

        <div className="mt-10 text-center">
          <a
            href="/contact"
            className="inline-block rounded-lg bg-black px-6 py-3 text-white font-medium hover:bg-gray-800 transition"
          >
            Get in Touch
          </a>
        </div>
      </div>
    </main>
  );
}