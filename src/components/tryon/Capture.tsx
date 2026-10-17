"use client";
import { useEffect, useRef, useState } from "react";
import { checkQuality, prepareImage, type QualityReport } from "@/lib/client/quality";

type Phase = "choose" | "camera" | "checking" | "review";

export function Capture({ busy, serverError, onSubmit }: {
  busy: boolean;
  serverError: string | null;
  onSubmit: (photo: Blob) => void;
}) {
  const [phase, setPhase] = useState<Phase>("choose");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [report, setReport] = useState<QualityReport | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopCamera, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function openCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError("We couldn't open the camera. Allow camera access, or upload a photo instead.");
    }
  }

  async function analyse(source: Blob | HTMLCanvasElement) {
    setPhase("checking");
    try {
      const { blob, canvas, original } = await prepareImage(source);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
      setReport(await checkQuality(canvas, original));
      setPhase("review");
    } catch {
      setCameraError("We couldn't read that photo. Please try a different one (JPEG or PNG).");
      setPhase("choose");
    }
  }

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    stopCamera();
    void analyse(c);
  }

  function retake() {
    setPhoto(null);
    setReport(null);
    setPreview(null);
    setPhase("choose");
  }

  const blocking = report?.blocking ?? false;

  return (
    <div className="narrow flow">
      <div className="flow-head">
        <div className="eyebrow">Step 1 of 3</div>
        <h1>Your photo</h1>
        <p className="muted">Face the camera in soft, even light. Hair off the face if you can, whole head in the frame.</p>
      </div>

      {phase === "choose" && (
        <div className="stack">
          <div className="capture-stage" style={{ display: "grid", placeItems: "center", color: "#f7f3ec" }}>
            <div className="face-guide" />
            <div className="center" style={{ padding: 24, position: "relative" }}>
              <p className="serif" style={{ fontSize: "1.4rem" }}>Front-facing · Good light · Just you</p>
            </div>
          </div>
          {cameraError && <div className="notice notice-warn">{cameraError}</div>}
          <div className="grid-2">
            <button className="btn btn-accent" onClick={openCamera}>Take a photo</button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Upload from gallery</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void analyse(f);
            }}
          />
        </div>
      )}

      {phase === "camera" && (
        <div className="stack">
          <div className="capture-stage">
            <video ref={videoRef} className="mirror" playsInline muted />
            <div className="face-guide" />
            <div className="capture-tip">Line your face up with the oval</div>
          </div>
          <div className="grid-2">
            <button className="btn btn-accent" onClick={snap}>Capture</button>
            <button className="btn btn-ghost" onClick={() => { stopCamera(); setPhase("choose"); }}>Cancel</button>
          </div>
        </div>
      )}

      {phase === "checking" && (
        <div className="card center" style={{ padding: 48 }}>
          <div className="spinner" />
          <p style={{ margin: 0 }}>Checking your photo…</p>
        </div>
      )}

      {phase === "review" && preview && report && (
        <div className="stack">
          <div className="capture-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your photo" />
          </div>
          <div className="card">
            <h3>Photo check</h3>
            <ul className="checklist">
              {report.checks.map((c) => (
                <li key={c.id}>
                  <span className={`dot dot-${c.level}`} aria-hidden>{c.level === "ok" ? "✓" : "!"}</span>
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
            {!report.faceDetector && <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>On-device face check unavailable; we'll check the face when you continue.</p>}
          </div>
          {serverError && <div className="notice notice-bad" role="alert">{serverError}</div>}
          <div className="grid-2">
            <button className="btn btn-accent" disabled={blocking || busy || !photo} onClick={() => photo && onSubmit(photo)}>
              {busy ? "Uploading…" : blocking ? "Please retake" : "Use this photo"}
            </button>
            <button className="btn btn-ghost" onClick={retake}>Retake</button>
          </div>
        </div>
      )}
    </div>
  );
}
