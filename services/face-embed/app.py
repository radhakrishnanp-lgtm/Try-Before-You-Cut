"""
Try-Before-You-Cut face-embedding service.

POST /analyse (multipart field "image") ->
  {"width": int, "height": int, "faces": [{"bbox": [x1,y1,x2,y2], "det_score": float, "embedding": [512 floats]}]}

Used for (1) the server-side "exactly one face" photo check and (2) the identity
check that compares the original face with each generated result (ArcFace
cosine similarity). Images are processed in memory and never written to disk.
"""
import os

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from insightface.app import FaceAnalysis

TOKEN = os.environ.get("FACE_SERVICE_TOKEN", "")
MODEL = os.environ.get("INSIGHTFACE_MODEL", "buffalo_l")

app = FastAPI(title="tbyc-face-embed", docs_url=None, redoc_url=None)
analyzer = FaceAnalysis(name=MODEL, allowed_modules=["detection", "recognition"], providers=["CPUExecutionProvider"])
analyzer.prepare(ctx_id=-1, det_size=(640, 640))


def auth(authorization: str = Header(default="")):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL}


@app.post("/analyse", dependencies=[Depends(auth)])
async def analyse(image: UploadFile = File(...)):
    data = await image.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="image too large")
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=415, detail="unsupported image")
    faces = analyzer.get(img)
    h, w = img.shape[:2]
    return {
        "width": w,
        "height": h,
        "faces": [
            {
                "bbox": [float(v) for v in f.bbox],
                "det_score": float(f.det_score),
                "embedding": [float(v) for v in f.normed_embedding],
            }
            for f in faces
            if f.det_score >= 0.5
        ],
    }
