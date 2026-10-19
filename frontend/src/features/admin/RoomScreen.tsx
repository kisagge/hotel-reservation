"use client";

import { ImagePlus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useDeletePhoto, useSaveRoom, useUploadPhoto, type RoomIn } from "@/lib/api/adminQueries";
import { ApiError, useRoom, type Room } from "@/lib/api/queries";
import { errorMessage } from "@/lib/errors";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

/** 객실 정보 (no Figma frame; follows the A3 card/field style). */
export function RoomScreen() {
  const room = useRoom();
  if (!room.data) return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
  return <RoomEditor key={JSON.stringify(room.data)} room={room.data} />;
}

function RoomEditor({ room }: { room: Room }) {
  const initial: RoomIn = { name: room.name, description: room.description, capacity: room.capacity, bed: room.bed, size_m2: room.size_m2, amenities: room.amenities };
  const [v, setV] = useState<RoomIn>(initial);
  const [amenity, setAmenity] = useState("");
  const save = useSaveRoom();
  const upload = useUploadPhoto();
  const remove = useDeletePhoto();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const valid = v.name.trim() && v.bed.trim() && v.capacity >= 1 && v.size_m2 >= 1;

  const addAmenity = () => {
    const a = amenity.trim();
    if (a && !v.amenities.includes(a) && v.amenities.length < 20) setV({ ...v, amenities: [...v.amenities, a] });
    setAmenity("");
  };
  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) return toast("jpg, png, webp 이미지만 올릴 수 있어요", "danger");
    if (file.size > MAX_BYTES) return toast("5MB 이하 이미지만 올릴 수 있어요", "danger");
    upload.mutate(file, {
      onSuccess: () => toast("사진을 추가했어요"),
      onError: (e) => toast(errorMessage(e instanceof ApiError ? e.code : null), "danger"),
    });
  };

  return (
    <>
      <AdminPageHeader title="객실 정보" subtitle="손님 홈 화면에 보이는 객실 소개와 사진이에요"
        actions={<>
          <Button variant="secondary" size="m" disabled={!dirty} onClick={() => setV(initial)}>되돌리기</Button>
          <Button size="m" disabled={!dirty || !valid} loading={save.isPending}
            onClick={() => save.mutate(v, { onSuccess: () => toast("객실 정보를 저장했어요"), onError: () => toast("입력한 내용을 다시 확인해 주세요", "danger") })}>
            변경사항 저장
          </Button>
        </>} />
      <div className="flex items-start gap-4">
        <section className="flex min-w-0 flex-1 flex-col gap-4 rounded-lg border border-line bg-surface p-6">
          <h2 className="text-heading-m font-bold">기본 정보</h2>
          <TextField label="객실 이름" maxLength={100} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-ink-2">설명</span>
            <textarea rows={3} maxLength={2000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })}
              className="rounded-md border border-field bg-surface px-4 py-3 text-body-l outline-none focus:border-[1.5px] focus:border-pine" />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <TextField label="최대 인원" type="number" min={1} max={10} value={v.capacity} onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })} />
            <TextField label="침대" maxLength={50} value={v.bed} onChange={(e) => setV({ ...v, bed: e.target.value })} />
            <TextField label="면적(㎡)" type="number" min={1} max={500} value={v.size_m2} onChange={(e) => setV({ ...v, size_m2: Number(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-ink-2">편의시설</span>
            <div className="flex flex-wrap gap-2">
              {v.amenities.map((a) => (
                <span key={a} className="flex items-center gap-1 rounded-full bg-pine-soft py-1 pl-3 pr-1.5 text-label font-medium text-pine">
                  {a}
                  <button type="button" aria-label={`${a} 삭제`} className="-m-1 flex size-6 items-center justify-center rounded-full" onClick={() => setV({ ...v, amenities: v.amenities.filter((x) => x !== a) })}>
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={amenity} onChange={(e) => setAmenity(e.target.value)} maxLength={30} placeholder="예: 와이파이"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAmenity(); } }}
                aria-label="편의시설 추가" className="h-11 flex-1 rounded-md border border-field bg-surface px-4 text-body-m outline-none focus:border-pine" />
              <Button variant="secondary" size="m" onClick={addAmenity}>추가</Button>
            </div>
          </div>
        </section>
        <section className="flex w-[400px] shrink-0 flex-col gap-4 rounded-lg border border-line bg-surface p-6">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-heading-m font-bold">사진</h2>
            <p className="text-caption text-ink-2">jpg · png · webp, 5MB 이하. 앞의 2장이 홈 화면에 보여요.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {room.photos.map((p, i) => (
              <div key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
                <Image src={p.url} alt={`객실 사진 ${i + 1}`} fill sizes="180px" unoptimized loading={i < 2 ? "eager" : "lazy"} className="object-cover" />
                <button type="button" aria-label={`사진 ${i + 1} 삭제`} onClick={() => remove.mutate(p.id, { onSuccess: () => toast("사진을 삭제했어요") })}
                  className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full bg-inverse/70 text-white">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={upload.isPending}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong text-ink-2 hover:bg-canvas">
              <ImagePlus className="size-6" strokeWidth={1.75} />
              <span className="text-caption">{upload.isPending ? "올리는 중…" : "사진 추가"}</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept={ACCEPT} hidden aria-label="사진 파일" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </section>
      </div>
    </>
  );
}
