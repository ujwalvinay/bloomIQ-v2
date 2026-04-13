"use client";

import { Camera, Leaf } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef } from "react";
import { absoluteApiUrl } from "@/lib/backend-origin";
import { usePlantDetail } from "../PlantDetailContext";
import { specimenCode } from "../plant-detail-shared";

export function PlantGalleryTab() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const { plant, busyPhoto, onPhotoPick } = usePlantDetail();

  const imgSrc = useMemo(() => {
    if (!plant?.imageUrl) return null;
    return plant.imageUrl.startsWith("/api/plants/")
      ? absoluteApiUrl(plant.imageUrl)
      : plant.imageUrl;
  }, [plant?.imageUrl]);

  if (!plant) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-forest">{plant.name}</h1>
      <p className="mt-1 text-sm text-muted">Portrait and specimen reference</p>

      <div className="relative mt-8 aspect-[3/4] max-h-[min(70vh,640px)] overflow-hidden rounded-[1.5rem] bg-stone-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-stone-200/60">
        {imgSrc ? (
          plant.imageUrl?.startsWith("/api/plants/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={imgSrc}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 42rem"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-forest/25">
            <Leaf className="h-24 w-24" strokeWidth={1} />
          </div>
        )}
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 justify-center">
          <span className="rounded-full bg-forest px-4 py-2 text-xs font-semibold tracking-wide text-white shadow-md">
            Specimen ID: {specimenCode(plant)}
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void onPhotoPick(e)}
        />
        <button
          type="button"
          disabled={busyPhoto}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest/90 disabled:opacity-50"
        >
          <Camera className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          {busyPhoto ? "Uploading…" : "Update portrait"}
        </button>
        <p className="text-sm text-muted">
          JPEG or PNG. This updates the plant everywhere in BloomIQ.
        </p>
      </div>
    </div>
  );
}
