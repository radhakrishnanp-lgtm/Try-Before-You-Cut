# Face-embedding service

A small FastAPI wrapper around [InsightFace](https://github.com/deepinsight/insightface) used by Keshkala for:

1. **Photo check:** reject uploads with zero or several faces, or a face that is too small.
2. **Identity check:** compare the ArcFace embedding of the original photo with every generated result. Below `IDENTITY_THRESHOLD` (default 0.45 cosine), the app retries once with a stricter prompt, then hides the result and refunds the credit.

Images are decoded in memory and never stored.

## Run

```bash
docker build -t keshkala-face .
docker run -p 8080:8080 -e FACE_SERVICE_TOKEN=secret keshkala-face
```

Then set `FACE_SERVICE_URL=https://your-host` and `FACE_SERVICE_TOKEN=secret` in the web app. Cloud Run, Fly.io or Railway on a 2 vCPU / 2 GB instance handles pilot volume (~0.3 to 0.6 s per image on CPU) for a few hundred rupees a month with scale-to-zero.

## Licensing

The InsightFace **code** is MIT. The pretrained `buffalo_l` **model weights** are released for non-commercial research. Before paid launch, either obtain a commercial licence from InsightFace, or swap in a commercially licensed recognition model (the API contract above stays the same). This is tracked as an open point in the main README.

## Calibrating the threshold

Run the 20-face Indian test set through `/analyse` (original vs. each generated look) and set the threshold just below the lowest same-person score where a human reviewer still agrees "that's me". ArcFace same-person scores on edited photos are typically 0.5 to 0.8; different people are usually below 0.3.
