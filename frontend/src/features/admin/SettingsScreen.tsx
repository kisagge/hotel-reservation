"use client";

import { BlocksCard } from "@/components/admin/BlocksCard";
import { RulePreview } from "@/components/admin/RulePreview";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { useToast } from "@/components/ui/Toast";
import { useAdminSettings, useSaveSettings } from "@/lib/api/adminQueries";
import { ApiError } from "@/lib/api/queries";
import { errorMessage } from "@/lib/errors";

/** A3 · 요금·운영 설정 (Figma 12:100). */
export function SettingsScreen() {
  const settings = useAdminSettings();
  const save = useSaveSettings();
  const toast = useToast();
  if (!settings.data) return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
  return (
    <SettingsForm
      key={JSON.stringify(settings.data)}
      initial={settings.data}
      saving={save.isPending}
      onSave={(v) => save.mutate(v, {
        onSuccess: () => toast("저장했어요 · 새 예약부터 적용돼요"),
        onError: (e) => toast(e instanceof ApiError && e.status === 422 ? "설정 값을 다시 확인해 주세요" : errorMessage(null), "danger"),
      })}
      aside={(v) => <><BlocksCard /><RulePreview rules={v} /></>}
    />
  );
}
