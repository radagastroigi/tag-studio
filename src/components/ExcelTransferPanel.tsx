"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExcelTransferPanel({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("goalId", goalId);

    try {
      const res = await fetch("/api/excel/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Import failed.");
      else {
        setMsg(`Imported ${data.importedCount} activities into your goal.`);
        router.refresh();
      }
    } catch {
      setMsg("Network error uploading file.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  return (
    <div className="bg-white border border-[#E2E7E4] rounded-3xl p-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Excel Export &amp; AI Semantic Import</h2>
          <p className="text-xs text-[#5B6863]">Export your full SI ledger or upload any Excel/CSV habit sheet.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/excel/export"
            className="px-3.5 py-2 rounded-xl border border-[#D8DFDB] hover:bg-[#F4F6F5] text-xs font-semibold"
          >
            Export .xlsx
          </a>
          <label className="px-3.5 py-2 rounded-xl bg-[#17211E] hover:bg-[#256453] text-white text-xs font-semibold cursor-pointer">
            {importing ? "AI Parsing…" : "Import Excel/CSV"}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </div>
      {msg && <p className="text-xs text-[#256453] font-medium">{msg}</p>}
    </div>
  );
}