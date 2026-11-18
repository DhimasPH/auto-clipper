import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Clock } from "lucide-react";
import { toLang } from "../lib/errorInfo";
import { DeviceField, devicesUsed, formatDuration, formatMemory, summarizeTimings, totalSeconds } from "../lib/timings";

const DEVICE_ORDER: DeviceField[] = ["whisper_device", "encoder", "tracking_engine_used"];

interface TimingDetailsProps {
  /** Job metadata: `timings` plus the devices that did the work. */
  metadata: unknown;
  className?: string;
}

/** Collapsed "Detail waktu": how long each stage took and which devices did the work. */
export const TimingDetails: React.FC<TimingDetailsProps> = ({ metadata, className = "" }) => {
  const { t, i18n } = useTranslation();
  const rows = summarizeTimings((metadata as { timings?: unknown } | null)?.timings);
  const devices = devicesUsed(metadata);
  const deviceFields = DEVICE_ORDER.filter((field) => devices[field]);
  if (rows.length === 0 && deviceFields.length === 0) return null;

  const locale = toLang(i18n.language) === "en" ? "en-US" : "id-ID";
  const units = {
    hour: t("timing.unit_hour", "jam"),
    minute: t("timing.unit_minute", "mnt"),
    second: t("timing.unit_second", "dtk"),
  };

  return (
    <details className={`group ${className}`}>
      <summary className="inline-flex items-center gap-1.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-label text-text-primary hover:text-accent rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" aria-hidden="true" />
        <Clock className="w-4 h-4 text-text-secondary" aria-hidden="true" />
        {t("timing.summary", "Detail waktu")}
      </summary>

      <div className="mt-3 rounded-lg border border-border bg-bg-surface p-4 flex flex-col gap-4">
        {rows.length > 0 && (
          <table className="w-full text-body text-text-primary border-collapse">
            <thead>
              <tr className="text-left text-caption text-text-secondary">
                <th scope="col" className="font-medium pb-2 pr-3">{t("timing.col_stage", "Tahap")}</th>
                <th scope="col" className="font-medium pb-2 pr-3 text-right whitespace-nowrap">{t("timing.col_time", "Waktu")}</th>
                <th scope="col" className="font-medium pb-2 text-right whitespace-nowrap">{t("timing.col_memory", "Memori puncak")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.stage} className="border-t border-border">
                  <td className="py-2 pr-3">
                    {t(`timing.stage_${row.stage}`, { defaultValue: row.stage })}
                    {row.count > 1 && (
                      <span className="text-text-secondary"> {t("timing.times", { n: row.count, defaultValue: "({{n}} kali)" })}</span>
                    )}
                    {row.failed && (
                      <span className="text-error"> {t("timing.stopped_here", "(berhenti di sini)")}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{formatDuration(row.seconds, units)}</td>
                  <td className="py-2 text-right whitespace-nowrap tabular-nums">
                    {formatMemory(row.peakMb, locale) || t("timing.not_measured", "tidak terukur")}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 1 && (
              <tfoot>
                <tr className="border-t border-border-active font-medium">
                  <td className="pt-2 pr-3">{t("timing.total", "Total")}</td>
                  <td className="pt-2 pr-3 text-right whitespace-nowrap tabular-nums">{formatDuration(totalSeconds(rows), units)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {deviceFields.length > 0 && (
          <div>
            <h4 className="text-caption font-medium text-text-secondary mb-2">{t("timing.devices_title", "Yang mengerjakan")}</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-body m-0">
              {deviceFields.map((field) => (
                <React.Fragment key={field}>
                  <dt className="text-text-secondary">{t(`timing.device_${field}`, { defaultValue: field })}</dt>
                  <dd className="m-0 text-text-primary">
                    {t(`timing.${field}_${devices[field]}`, { defaultValue: devices[field] })}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          </div>
        )}
      </div>
    </details>
  );
};

export default TimingDetails;
