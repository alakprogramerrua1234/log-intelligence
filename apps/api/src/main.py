from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routers import detections, filters

app = FastAPI(title="Log Intelligence API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api = FastAPI()
api.include_router(detections.router)
api.include_router(filters.router)

app.mount("/api/v1", api)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
