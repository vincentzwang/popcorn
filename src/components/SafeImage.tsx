"use client";
import Image from "next/image";
import { useState } from "react";

const PLACEHOLDER = "https://placehold.co/342x513/1a1a1e/555555?text=No+Poster";

interface Props {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export default function SafeImage({ src, alt, fill, className, sizes, priority }: Props) {
  const [errored, setErrored] = useState(false);
  const finalSrc = errored ? PLACEHOLDER : src;

  return (
    <Image
      src={finalSrc}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      priority={priority}
      onError={() => setErrored(true)}
      unoptimized={errored}
    />
  );
}
