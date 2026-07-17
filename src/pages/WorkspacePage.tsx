import React, { useContext } from 'react';
import { Film } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { AppContext } from '../App';
import GenerateForm from '../components/GenerateForm';
import ClipsResult from '../components/ClipsResult';

export const WorkspacePage: React.FC = () => {
  const ctx = useContext(AppContext);
  const hasClips = ctx.clips && ctx.clips.length > 0;

  return (
    <div className="p-8">
      <PageHeader
        title="Workspace"
        subtitle="Ubah video panjang jadi klip vertikal"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: configuration */}
        <div className="lg:col-span-7">
          <GenerateForm
            inputType={ctx.inputType} setInputType={ctx.setInputType}
            url={ctx.url} setUrl={ctx.setUrl}
            setLocalFile={ctx.setLocalFile}
            aspectRatio={ctx.aspectRatio} setAspectRatio={ctx.setAspectRatio}
            captionStyle={ctx.captionStyle} setCaptionStyle={ctx.setCaptionStyle}
            burnSubtitles={ctx.burnSubtitles} setBurnSubtitles={ctx.setBurnSubtitles}
            quality={ctx.quality} setQuality={ctx.setQuality}
            title={ctx.title} setTitle={ctx.setTitle}
            enableBroll={ctx.enableBroll} setEnableBroll={ctx.setEnableBroll}
            maxClips={ctx.maxClips} setMaxClips={ctx.setMaxClips}
            errorMsg={ctx.errorMsg}
            isRunning={ctx.isRunning}
            handleGenerate={ctx.handleGenerate}
          />
        </div>

        {/* Right: results */}
        <div className="lg:col-span-5">
          {hasClips ? (
            <ClipsResult
              clips={ctx.clips}
              status={ctx.status}
              failedCount={ctx.failedCount}
              videoSrc={ctx.videoSrc}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center gap-3 rounded-card border border-dashed border-border bg-bg-secondary/40 p-10 min-h-[360px]">
              <div className="p-3 bg-accent/10 rounded-full text-accent">
                <Film className="w-7 h-7" />
              </div>
              <h3 className="text-body font-medium text-text-primary">Klip kamu muncul di sini</h3>
              <p className="text-caption text-text-secondary max-w-xs">
                Masukkan URL atau video lokal, atur format, lalu generate. Hasil klip AI beserta deskripsinya akan tampil di kolom ini.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
