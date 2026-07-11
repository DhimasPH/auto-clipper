import React, { useContext } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { AppContext } from '../App';
import GenerateForm from '../components/GenerateForm';
import ClipsResult from '../components/ClipsResult';

export const WorkspacePage: React.FC = () => {
  const ctx = useContext(AppContext);

  return (
    <div className="p-8">
      <PageHeader 
        title="Workspace" 
        subtitle="Create clips from any video"
      />
      <div className="flex flex-col gap-8">
        <GenerateForm
          mode={ctx.mode} setMode={ctx.setMode}
          inputType={ctx.inputType} setInputType={ctx.setInputType}
          url={ctx.url} setUrl={ctx.setUrl}
          setLocalFile={ctx.setLocalFile}
          aspectRatio={ctx.aspectRatio} setAspectRatio={ctx.setAspectRatio}
          captionStyle={ctx.captionStyle} setCaptionStyle={ctx.setCaptionStyle}
          provider={ctx.provider}
          burnSubtitles={ctx.burnSubtitles} setBurnSubtitles={ctx.setBurnSubtitles}
          manualStart={ctx.manualStart} setManualStart={ctx.setManualStart}
          manualEnd={ctx.manualEnd} setManualEnd={ctx.setManualEnd}
          quality={ctx.quality} setQuality={ctx.setQuality}
          errorMsg={ctx.errorMsg}
          isRunning={ctx.isRunning}
          status={ctx.status}
          progressPct={ctx.progressPct}
          progress={ctx.progress}
          handleGenerate={ctx.handleGenerate}
          cancelJob={ctx.cancelJob}
        />

        <ClipsResult
          clips={ctx.clips}
          status={ctx.status}
          failedCount={ctx.failedCount}
          mode={ctx.mode}
          videoSrc={ctx.videoSrc}
        />
      </div>
    </div>
  );
};
