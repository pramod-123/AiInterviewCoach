import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { FastifyBaseLogger } from "fastify";
import type { AppPaths } from "../infrastructure/AppPaths.js";
import {
  E2eInterviewPipeline,
  type E2eInterviewPipelineRunResult,
} from "../video-pipeline/E2eInterviewPipeline.js";
import type { EditorRoiDetectionService } from "../video-pipeline/editorRoiDetection.js";
import { FfmpegRunner } from "../video-pipeline/ffmpegExtract.js";
import { TesseractRunner } from "../video-pipeline/tesseractRunner.js";
import type { InterviewEvaluationPayload } from "../types/interviewEvaluation.js";
import { SpeechSegment, SpeechTranscription } from "../types/speechTranscription.js";
import { FfmpegDedupedFrameExtractor } from "./video/FfmpegDedupedFrameExtractor.js";
import type { SpeechTranscriptionEvaluationOrchestrator } from "./SpeechTranscriptionEvaluationOrchestrator.js";
import { codeSnapshotsFromTimelineSec } from "./codeSnapshotsFromTimelineSec.js";

/**
 * Runs the full e2e pipeline (ROI, FFmpeg frames, Tesseract, Whisper, rubric) for an uploaded video job
 * and persists {@link SpeechUtterance} (STT windows), {@link CodeSnapshot} (`VIDEO_OCR`),
 * derived {@link InterviewAudio}, and {@link Result}.
 * Requires ffmpeg/ffprobe/tesseract on PATH — verified at server startup via {@link assertMandatoryInterviewApiConfig}.
 */
export class VideoJobProcessor {
  constructor(
    private readonly db: PrismaClient,
    private readonly paths: AppPaths,
    private readonly speechAnalysis: SpeechTranscriptionEvaluationOrchestrator,
    private readonly log: FastifyBaseLogger,
    private readonly roiDetection: EditorRoiDetectionService,
  ) {}

  /** Processes the **full** uploaded source video (no duration cap on HTTP jobs). */
  async process(jobId: string): Promise<void> {
    const job = await this.db.job.findUnique({
      where: { id: jobId },
      include: { interviewVideo: true },
    });

    if (!job?.interviewVideo) {
      await this.failJob(jobId, "No interview video found for this job.");
      return;
    }

    await this.db.job.update({
      where: { id: jobId },
      data: { status: "PROCESSING", errorMessage: null },
    });

    const uploadDir = this.paths.jobUploadDir(jobId);
    const pipelineDir = path.join(uploadDir, "pipeline");
    const videoPath = job.interviewVideo.filePath;

    const fpsEnv = Number(process.env.VIDEO_JOB_FRAME_FPS);
    const frameExportFps =
      Number.isFinite(fpsEnv) && fpsEnv > 0 ? fpsEnv : 2;

    const pipeline = new E2eInterviewPipeline(new FfmpegRunner(), new TesseractRunner(), {
      roiDetection: this.roiDetection,
      dedupedFrames: new FfmpegDedupedFrameExtractor(),
      speechAnalysis: this.speechAnalysis,
      frameExportFps,
      onProgress: (msg) => this.log.info({ jobId, pipeline: "e2e" }, msg),
    });

    try {
      const run = await pipeline.run({
        inputVideoPath: videoPath,
        outputDir: pipelineDir,
        sttEvalJobId: jobId,
      });
      await this.persistPipelineSuccess(jobId, run);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.failJob(jobId, `Video pipeline failed: ${message}`);
      throw err;
    }
  }

  private async failJob(jobId: string, errorMessage: string): Promise<void> {
    await this.db.job.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage },
    });
  }

  private async persistPipelineSuccess(jobId: string, run: E2eInterviewPipelineRunResult): Promise<void> {
    const { transcription, evaluation, frameTimesSec, frameOcrTexts } = run;
    const durationSec = transcription.durationSec ?? 0;

    const ocrRows = codeSnapshotsFromTimelineSec(frameTimesSec, frameOcrTexts).map((r) => ({
      jobId,
      source: "VIDEO_OCR" as const,
      offsetMs: r.offsetMs,
      text: r.text,
      sequence: r.sequence,
    }));

    const sttRows = transcription.segments.map((seg, i) => this.toSttRow(jobId, seg, i));

    const audioStat = await fs.stat(run.audioWavPath).catch(() => null);
    const audioSize = audioStat ? Number(audioStat.size) : 0;

    const payload = this.buildResultPayload(
      transcription,
      sttRows.length,
      evaluation,
      run,
    );

    await this.db.$transaction(async (tx) => {
      await tx.codeSnapshot.deleteMany({ where: { jobId, source: "VIDEO_OCR" } });
      await tx.speechUtterance.deleteMany({ where: { jobId } });

      if (ocrRows.length > 0) {
        await tx.codeSnapshot.createMany({ data: ocrRows });
      }
      if (sttRows.length > 0) {
        await tx.speechUtterance.createMany({ data: sttRows });
      }

      await tx.interviewAudio.upsert({
        where: { jobId },
        create: {
          jobId,
          filePath: run.audioWavPath,
          originalFilename: "audio.wav",
          mimeType: "audio/wav",
          sizeBytes: audioSize,
          durationSeconds: durationSec > 0 ? durationSec : null,
        },
        update: {
          filePath: run.audioWavPath,
          originalFilename: "audio.wav",
          mimeType: "audio/wav",
          sizeBytes: audioSize,
          durationSeconds: durationSec > 0 ? durationSec : null,
        },
      });

      await tx.result.upsert({
        where: { jobId },
        create: { jobId, payload },
        update: { payload },
      });

      await tx.job.update({
        where: { id: jobId },
        data: { status: "COMPLETED", errorMessage: null },
      });
    });
  }

  private toSttRow(
    jobId: string,
    seg: SpeechSegment,
    sequence: number,
  ): Prisma.SpeechUtteranceCreateManyInput {
    const startMs = Math.max(0, Math.round(seg.startSec * 1000));
    let endMs = Math.max(0, Math.round(seg.endSec * 1000));
    if (endMs <= startMs) {
      endMs = startMs + 1;
    }
    return {
      jobId,
      startMs,
      endMs,
      text: seg.text,
      sequence,
    };
  }

  private buildResultPayload(
    transcription: SpeechTranscription,
    segmentCount: number,
    evaluation: InterviewEvaluationPayload,
    run: E2eInterviewPipelineRunResult,
  ): Prisma.InputJsonValue {
    return {
      stt: {
        provider: transcription.providerId,
        model: transcription.modelId,
        segmentCount,
        language: transcription.language,
      },
      evaluation,
      pipeline: {
        kind: "video",
        outputDir: run.outputDir,
        roiCrop: run.cropUsed,
        ocrFrameCount: run.frameOcrTexts.length,
        extractedFrameCount: run.extractedFrameCount,
        problemStatement: run.problemStatement,
        finalTranscript: run.finalTranscript,
        alignedTimeline: run.alignedTimeline,
      },
    };
  }
}
