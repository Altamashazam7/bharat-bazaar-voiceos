import { useEffect, useRef, useState } from "react";

interface AudioRecorderProps {
  disabled: boolean;
  onCapture: (file: File) => void;
  onError: (message: string) => void;
}

export function AudioRecorder({ disabled, onCapture, onError }: AudioRecorderProps) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => () => {
    recorder.current?.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("Live recording is not supported in this browser.");
      return;
    }

    setStarting(true);
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = microphone;
      chunks.current = [];
      const preferredType = ["audio/webm;codecs=opus", "audio/mp4"]
        .find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const activeRecorder = new MediaRecorder(
        microphone,
        preferredType ? { mimeType: preferredType } : undefined,
      );
      recorder.current = activeRecorder;
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      activeRecorder.onerror = () => {
        microphone.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        setRecording(false);
        onError("The microphone recording failed. Please try again.");
      };
      activeRecorder.onstop = () => {
        const type = activeRecorder.mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : "webm";
        const recordingFile = new File(
          chunks.current,
          `voice-order-${new Date().toISOString().replaceAll(":", "-")}.${extension}`,
          { type },
        );
        microphone.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        setRecording(false);
        if (recordingFile.size) onCapture(recordingFile);
        else onError("The recording was empty. Please record your order again.");
      };
      activeRecorder.start();
      setRecording(true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Microphone permission was denied.";
      onError(`Could not access the microphone. ${detail}`);
    } finally {
      setStarting(false);
    }
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return (
    <button
      className={`button ${recording ? "button-recording" : "button-secondary"}`}
      disabled={disabled || starting}
      onClick={recording ? stopRecording : () => void startRecording()}
      type="button"
    >
      <span className={recording ? "recording-dot" : "mic-symbol"} aria-hidden="true" />
      {starting ? "Starting microphone…" : recording ? "Stop recording" : "Start recording"}
    </button>
  );
}
