import Image from "next/image";

interface ProductImageProps {
  /** Must already be validated; cart snapshots use trustedCartImageUrl(). */
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * Shared image slot: renders a neutral placeholder when a product has no
 * uploaded image. The parent element must be `relative` with a defined size.
 */
export function ProductImage({
  src,
  alt,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
  priority = false,
}: ProductImageProps) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-400"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-10"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover transition duration-500 group-hover:scale-105"
    />
  );
}
