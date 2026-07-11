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
          inputType={ctx.inputType} setInputType={ctx.setInputType}
          url={ctx.url} setUrl={ctx.setUrl}
          setLocalFile={ctx.setLocalFile}
          aspectRatio={ctx.aspectRatio} setAspectRatio={ctx.setAspectRatio}
          captionStyle={ctx.captionStyle} setCaptionStyle={ctx.setCaptionStyle}
          burnSubtitles={ctx.burnSubtitles} setBurnSubtitles={ctx.setBurnSubtitles}
          quality={ctx.quality} setQuality={ctx.setQuality}
          errorMsg={ctx.errorMsg}
          isRunning={ctx.isRunning}
          handleGenerate={ctx.handleGenerate}
        />

        <ClipsResult
          clips={ctx.clips}
          status={ctx.status}
          failedCount={ctx.failedCount}
          videoSrc={ctx.videoSrc}
        />
      </div>
    </div>
  );
};
