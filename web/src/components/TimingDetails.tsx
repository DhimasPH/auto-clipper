import React from "react";
import { ChevronRight, Clock } from "lucide-react";
import { devicesUsed, formatDuration, formatMemory, summarizeTimings, totalSeconds, type DeviceField } from "../lib/timings";
import { useLang } from "../lib/lang";
import { SUMMARY } from "../lib/ui";

const DEVICE_ORDER: DeviceField[] = ["whisper_device", "encoder", "tracking_engine_used"];

interface TimingDetailsProps {
  /** Job metadata: `timings` plus the devices that did the work. */
  metadata: unknown;
  className?: string;
}

/** Collapsed "Detail waktu": how long each stage took and which devices did the work. */
export const TimingDetails: React.FC<TimingDetailsProps> = ({ metadata, className = "" }) => {
  const { lang, t } = useLang();
  const rows = summarizeTimings((metadata as { timings?: unknown } | null)?.timings);
  const devices = devicesUsed(metadata);
  const deviceFields = DEVICE_ORDER.filter((field) => devices[field]);
  if (rows.length === 0 && deviceFields.length === 0) return null;

  const locale = lang === "en" ? "en-US" : "id-ID";
  const units = { hour: t("timing.unit_hour"), minute: t("timing.unit_minute"), second: t("timing.unit_second") };

  return (
    <details className={`group ${className}`}>
      <summary className={SUMMARY}>
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
        <Clock className="w-3.5 h-3.5 text-purple-600" aria-hidden="true" />
        {t("timing.summary")}
      </summary>

      <div className="mt-2 p-3 sm:p-4 rounded-xl bg-white border border-border flex flex-col gap-4">
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-text-primary border-collapse">
              <thead>
                <tr className="text-left text-xs text-text-secondary">
                  <th scope="col" className="font-semibold pb-2 pr-3">{t("timing.col_stage")}</th>
                  <th scope="col" className="font-semibold pb-2 pr-3 text-right whitespace-nowrap">{t("timing.col_time")}</th>
                  <th scope="col" className="font-semibold pb-2 text-right whitespace-nowrap">{t("timing.col_memory")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.stage} className="border-t border-border">
                    <td className="py-2 pr-3">
                      {t(`timing.stage_${row.stage}`, undefined, row.stage)}
                      {row.count > 1 && <span className="text-text-secondary"> {t("timing.times", { n: row.count })}</span>}
                      {row.failed && <span className="text-red-600"> {t("timing.stopped_here")}</span>}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{formatDuration(row.seconds, units)}</td>
                    <td className="py-2 text-right whitespace-nowrap tabular-nums">
                      {formatMemory(row.peakMb, locale) || t("timing.not_measured")}
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 1 && (
                <tfoot>
                  <tr className="border-t border-border-active font-semibold">
                    <td className="pt-2 pr-3">{t("timing.total")}</td>
                    <td className="pt-2 pr-3 text-right whitespace-nowrap tabular-nums">{formatDuration(totalSeconds(rows), units)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {deviceFields.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-text-secondary mb-2">{t("timing.devices_title")}</h4>
            <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs sm:text-sm m-0">
              {deviceFields.map((field) => (
                <React.Fragment key={field}>
                  <dt className="text-text-secondary">{t(`timing.device_${field}`, undefined, field)}</dt>
                  <dd className="m-0 text-text-primary">{t(`timing.${field}_${devices[field]}`, undefined, devices[field])}</dd>
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
