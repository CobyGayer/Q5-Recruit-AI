import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  /** "full" = Q5 mark + Recruit AI text; "mark" = Q5 symbol only */
  variant?: "full" | "mark";
  /** Rendered width in pixels */
  width?: number;
  /** When set, wraps the logo in a <Link> to this path */
  href?: string;
  /** Alt text for the logo image */
  alt?: string;
  className?: string;
}

// Intrinsic dimensions for aspect-ratio calculation
const VARIANTS = {
  full: { src: "/brand/logo-full.png", intrinsicW: 800, intrinsicH: 592 },
  mark: { src: "/brand/logo-mark.png", intrinsicW: 600, intrinsicH: 323 },
} as const;

export function Logo({
  variant = "full",
  width = 120,
  href,
  alt = "Q5 Recruit AI",
  className,
}: LogoProps) {
  const v = VARIANTS[variant];
  const height = Math.round(width * (v.intrinsicH / v.intrinsicW));

  const image = (
    <Image
      src={v.src}
      alt={alt}
      width={width}
      height={height}
      priority
      unoptimized
      className={className}
      style={{ height: "auto" }}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {image}
      </Link>
    );
  }

  return image;
}
